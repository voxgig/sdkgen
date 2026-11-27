import {
  cmp, File, Folder, Content,
  codecsUsed,
} from '@voxgig/sdkgen'


// GENERATED, NOT COPIED: the codec sources are trimmed to what the model's
// points use, so the index naming them is written per model.
const CodecIndex = cmp(function CodecIndex(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const used = codecsUsed(model)
  const mods = (['form', 'multipart', 'raw', 'handle'] as const).filter((c) => used[c])

  const encoders: string[] = []
  if (used.form) encoders.push('    if (std.mem.eql(u8, kind, "form")) return form.encode_form;')
  if (used.multipart) encoders.push('    if (std.mem.eql(u8, kind, "multipart")) return multipart.encode_multipart;')

  Folder({ name: 'utility/codec' }, () => {
    File({ name: 'index.' + target.ext }, () => {
      Content(`// The body codecs this model's points use; generated per model.

const std = @import("std");
const ctxmod = @import("../../core/context.zig");
const binary = @import("../../core/binary.zig");

${mods.map((m) => 'pub const ' + m + ' = @import("' + m + '.zig");\n').join('')}
pub const CODECS = [_][]const u8{ ${mods.map((m) => '"' + m + '"').join(', ')} };

pub fn encoder(kind: []const u8) ?binary.EncodeFn {
${encoders.join('\n')}${0 < encoders.length ? '\n' : '    _ = kind;\n'}    return null;
}

pub fn reader() ?binary.ReadFn {
    return ${used.raw ? 'raw.read_raw' : 'null'};
}

`)
      if (used.multipart) {
        Content(`pub const multipart_boundary = multipart.multipart_boundary;
`)
      }
      else {
        Content(`// No point of this model sends multipart, so no boundary is drawn.
pub fn multipart_boundary(_: *ctxmod.Context) []const u8 {
    return "";
}
`)
      }
    })
  })
})


export {
  CodecIndex
}
