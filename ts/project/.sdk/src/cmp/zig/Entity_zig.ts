
import * as Path from 'node:path'

import {
  cmp, camelify,
  File, Content, Folder, Fragment,
  entityClassName, entityCollection, entitySlots,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_zig'
import { zigVarName } from './utility_zig'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  const entityColl = entityCollection(model)
  const cls = entityClassName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  const ff = Path.normalize(__dirname + '/../../../src/cmp/zig/fragment/')

  Folder({ name: 'entity' }, () => {

    File({ name: zigVarName(entity.name) + '.' + target.ext }, () => {

      const opnames = Object.keys(entity.op || {})

      // For each CRUD op: if the spec defines it, splice in the real
      // implementation. Otherwise emit a stub returning the unsupported_op
      // error. Tag-form keys (`#LoadOp`) match `// #LoadOp` and capture the
      // marker's indent, so the spliced method nests inside the struct.
      const opfrags =
        (['load', 'list', 'create', 'update', 'patch', 'remove']
          .reduce((a: any, opname: string) =>
          (a['#' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ?
              ({ indent }: any) => {
                const arg = ('create' === opname || 'update' === opname || 'patch' === opname) ?
                  'reqdata' : 'reqmatch'
                // The stub mirrors the real signature: ops resolve to the
                // ENTITY (`list` to a slice of them), so an unsupported op
                // declares the same per-entity result union.
                const ret = 'list' === opname ? 'EntListResult' : 'EntResult'
                Content({ indent }, `pub fn ${opname}(self: *${cls}, _${arg}: Value, _ctrl: Value) ${ret} {
    _ = _${arg};
    _ = _ctrl;
    return .{ .err = h.unsupported_op("${opname}", self.name) };
}
`)
                if ('list' !== opname && 'remove' !== opname) {
                  Content({ indent }, `
pub fn ${opname}_with(self: *${cls}, _${arg}: Value, _ctrl: Value, _opwith: binmod.OpWith) ${ret} {
    _ = _${arg};
    _ = _ctrl;
    _ = _opwith;
    return .{ .err = h.unsupported_op("${opname}", self.name) };
}
`)
                }
              } :
              ({ indent }: any) => {
                EntityOperation({ ff, opname, indent, entity, entrep, cls })
              }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.zig',
        replace: {
          ...entrep,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          EntyClass: cls,

          '#Entity-Hook': ({ name, indent }: any) =>
            Content({ indent }, `self.utility.feature_hook(ctx, "${name}");`),

          ...opfrags,

          '#BinarySlot': ({ indent }: any) => BinarySlots({ entity, cls, indent }),
        }
      })

    })
  })
})



// Zig has no optional argument: the unnamed slot is `binary("")`.
const BinarySlots = cmp(function BinarySlots(props: any) {
  const { entity, cls, indent } = props
  const slots = entitySlots(entity)
  if (0 === slots.length) {
    return
  }

  const opt = (v?: string) => null == v ? 'null' : '"' + v + '"'
  const rows = slots.map((s: any) =>
    `    .{ .name = ${JSON.stringify(s.name)}, .action = ${JSON.stringify(s.action)}, ` +
    `.read = ${opt(s.read)}, .write = ${opt(s.write)} },`).join('\n')

  Content({ indent }, `const handle = @import("../utility/codec/handle.zig");

pub const BINARY_SLOTS = [_]handle.BinarySlot{
${rows}
};

pub fn binary(self: *${cls}, slot: []const u8) handle.BinaryHandle(${cls}) {
    return handle.BinaryHandle(${cls}).make(self, &BINARY_SLOTS, slot);
}
`)
})


export {
  Entity
}
