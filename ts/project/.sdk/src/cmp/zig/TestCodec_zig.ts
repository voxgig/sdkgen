import {
  cmp, each, File, Content,
  codecsUsed, entityCollection, entitySlots,
} from '@voxgig/sdkgen'

import { zigVarName } from './utility_zig'


const CODEC_OPS = ['load', 'create', 'update', 'patch']


function codecPoints(entity: any): boolean {
  return Object.values(entity.op || {}).some((op: any) =>
    each(op?.points || []).some((pt: any) => false !== pt?.a &&
      (['form', 'multipart', 'raw'].includes(pt?.rb?.kind) || 'raw' === pt?.rs?.kind)))
}


// The entities the shipped codec suite drives, by name. A template cannot
// name an entity in zig, which dispatches statically, so this table is
// generated beside it and only when the model uses a codec.
const TestCodec = cmp(function TestCodec(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const used = codecsUsed(model)
  if (!Object.values(used).some((u) => u)) {
    return
  }

  const entities = each(entityCollection(model)).filter((e: any) => false !== e.active && codecPoints(e))

  const decls = entities.map((e: any) => {
    const m = zigVarName(e.name)
    const slots = entitySlots(e)
    const rows = slots.map((s: any) =>
      `.{ .name = ${JSON.stringify(s.name)}, .read = ${null != s.read}, .write = ${null != s.write} }`)
      .join(', ')
    const handle = 0 === slots.length ? '' : `
    fn bytes(p: *anyopaque, slot: []const u8, opts: Value, ctrl: Value) Bytes {
        return switch (of(p).binary(slot).bytes(opts, ctrl)) {
            .err => |x| .{ .err = x },
            .ok => |b| .{ .ok = b },
        };
    }
    fn put(p: *anyopaque, slot: []const u8, src: sdk.BinarySource, ctrl: Value) Same {
        return switch (of(p).binary(slot).put(src, ctrl)) {
            .err => |x| .{ .err = x },
            .ok => |got| .{ .ok = got == of(p) },
        };
    }
    fn inactive(p: *anyopaque, slot: []const u8) [3]?*Err {
        const b = of(p).binary(slot);
        return .{ b.save(), b.stream(), b.open() };
    }`
    return `const ent_${m} = struct {
    const T = @typeInfo(@typeInfo(@TypeOf(sdk.SDK.${m})).@"fn".return_type.?).pointer.child;
    const slots = [_]SlotInfo{ ${rows} };
    fn of(p: *anyopaque) *T {
        return @ptrCast(@alignCast(p));
    }
    fn op(p: *anyopaque, opname: []const u8, args: Value, ctrl: Value, opwith: sdk.OpWith) Out {
        const e = of(p);
${CODEC_OPS.map((op, i) => `        ${0 === i ? '' : '} else '}if (std.mem.eql(u8, opname, "${op}")) {
            return switch (e.${op}_with(args, ctrl, opwith)) {
                .err => |x| .{ .err = x },
                .ok => |got| .{ .ok = got.asEntity().data(null) },
            };`).join('\n')}
        }
        return .{ .err = h.unsupported_op(opname, e.name) };
    }
    fn set(p: *anyopaque, val: Value) void {
        _ = of(p).asEntity().data(val);
        _ = of(p).asEntity().matchv(val);
    }${handle}
    fn make(client: *sdk.SDK) CodecEntity {
        return .{
            .ptr = @ptrCast(client.${m}(h.vnull())),
            .op = op,
            .set = set,
            .slots = &slots,
${0 === slots.length ? '' : `            .bytes = bytes,
            .put = put,
            .inactive = inactive,
`}        };
    }
};
`
  })

  File({ name: 'codec_entities.' + target.ext }, () => {
    Content(`// The entities the codec suite drives, generated per model (see TestCodec_zig).

const std = @import("std");
const sdk = @import("sdk");
const h = sdk.h;
const Value = sdk.Value;

pub const Err = sdk.${model.const.Name}Error;

pub const Out = union(enum) {
    ok: Value,
    err: *Err,
};

pub const Bytes = union(enum) {
    ok: []const u8,
    err: *Err,
};

pub const Same = union(enum) {
    ok: bool,
    err: *Err,
};

pub const SlotInfo = struct {
    name: []const u8,
    read: bool,
    write: bool,
};

pub const CodecEntity = struct {
    ptr: *anyopaque,
    op: *const fn (*anyopaque, []const u8, Value, Value, sdk.OpWith) Out,
    set: *const fn (*anyopaque, Value) void,
    slots: []const SlotInfo,
    bytes: ?*const fn (*anyopaque, []const u8, Value, Value) Bytes = null,
    put: ?*const fn (*anyopaque, []const u8, sdk.BinarySource, Value) Same = null,
    inactive: ?*const fn (*anyopaque, []const u8) [3]?*Err = null,
};

${decls.join('\n')}
pub fn entity(client: *sdk.SDK, name: []const u8) ?CodecEntity {
${entities.map((e: any) => `    if (std.mem.eql(u8, name, "${e.name}")) return ent_${zigVarName(e.name)}.make(client);`).join('\n')}
${0 === entities.length ? '    _ = client;\n    _ = name;\n' : ''}    return null;
}
`)
  })
})


export {
  TestCodec
}
