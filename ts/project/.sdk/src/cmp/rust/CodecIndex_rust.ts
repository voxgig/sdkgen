import {
  cmp, File, Folder, Content,
  codecsUsed,
} from '@voxgig/sdkgen'


// GENERATED, NOT COPIED: the codec sources are trimmed to what the model's
// points use, so the module index naming them is written per model.
const CodecIndex = cmp(function CodecIndex(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const used = codecsUsed(model)
  const Name = model.const.Name

  const mods = (['form', 'multipart', 'raw', 'handle'] as const).filter((c) => used[c])

  const encoders: string[] = []
  if (used.form) encoders.push('        "form" => Some(form::encode_form),')
  if (used.multipart) encoders.push('        "multipart" => Some(multipart::encode_multipart),')

  Folder({ name: 'utility/codec' }, () => {
    File({ name: 'mod.' + target.ext }, () => {
      Content(`// The body codecs this model's points use; generated per model.

use std::rc::Rc;

use crate::core::context::Context;
use crate::core::error::${Name}Error;
use crate::utility::binary::Encoder;

${mods.map((m) => 'pub mod ' + m + ';\n').join('')}
pub const CODECS: &[&str] = &[${mods.map((m) => '"' + m + '"').join(', ')}];

pub type Reader = fn(&Rc<Context>) -> Result<(), ${Name}Error>;

pub fn encoder(kind: &str) -> Option<Encoder> {
    match kind {
${encoders.join('\n')}${0 < encoders.length ? '\n' : ''}        _ => None,
    }
}

pub fn reader() -> Option<Reader> {
    ${used.raw ? 'Some(raw::read_raw)' : 'None'}
}

`)
      if (used.multipart) {
        Content(`pub fn multipart_boundary(ctx: &Rc<Context>) -> String {
    multipart::multipart_boundary(ctx)
}
`)
      }
      else {
        Content(`// No point of this model sends multipart, so no boundary is drawn.
pub fn multipart_boundary(_ctx: &Rc<Context>) -> String {
    String::new()
}
`)
      }
    })
  })
})


export {
  CodecIndex
}
