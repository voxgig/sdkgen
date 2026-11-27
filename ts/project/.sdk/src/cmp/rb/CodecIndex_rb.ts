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
  const Name = model.const.Name

  const requires: string[] = []
  const entries: string[] = []

  if (used.form) {
    requires.push(`require_relative 'form_codec'`)
    entries.push(`    "form" => EncodeForm,`)
  }
  if (used.multipart) {
    requires.push(`require_relative 'multipart_codec'`)
    entries.push(`    "multipart" => EncodeMultipart,`, `    "multipart_boundary" => MultipartBoundary,`)
  }
  if (used.raw) {
    requires.push(`require_relative 'raw_codec'`)
    entries.push(`    "raw" => ReadRaw,`)
  }

  Folder({ name: 'utility/codec' }, () => {
    File({ name: 'index.' + target.ext }, () => {
      Content(`# ${Name} SDK utility: the body codecs this model's points use; generated per model.
${requires.join('\n')}${0 < requires.length ? '\n' : ''}
module ${Name}Utilities
  CODEC = {
${entries.join('\n')}${0 < entries.length ? '\n' : ''}  }.freeze
end
`)
    })
  })
})


export {
  CodecIndex
}
