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
  const pkg = model.const.Name.toLowerCase() + '_sdk.utility.codec'

  const imports: string[] = []
  const entries: string[] = []

  if (used.form) {
    imports.push(`from ${pkg}.form_codec import encode_form`)
    entries.push('    "form": encode_form,')
  }
  if (used.multipart) {
    imports.push(`from ${pkg}.multipart_codec import encode_multipart, multipart_boundary`)
    entries.push('    "multipart": encode_multipart,', '    "multipart_boundary": multipart_boundary,')
  }
  if (used.raw) {
    imports.push(`from ${pkg}.raw_codec import read_raw`)
    entries.push('    "raw": read_raw,')
  }

  Folder({ name: 'utility' }, () => {
    Folder({ name: 'codec' }, () => {
      File({ name: '__init__.' + target.ext }, () => {
        Content(`# The body codecs this model's points use; generated per model.
${imports.join('\n')}${0 < imports.length ? '\n\n' : ''}
CODEC = {
${entries.join('\n')}${0 < entries.length ? '\n' : ''}}
`)
      })
    })
  })
})


export {
  CodecIndex
}
