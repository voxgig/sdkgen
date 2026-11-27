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

  const imports: string[] = []
  const entries: string[] = []

  if (used.form) {
    imports.push(`const { encodeForm } = require('./FormCodec')`)
    entries.push('  form: encodeForm,')
  }
  if (used.multipart) {
    imports.push(`const { encodeMultipart, multipartBoundary } = require('./MultipartCodec')`)
    entries.push('  multipart: encodeMultipart,', '  multipartBoundary,')
  }
  if (used.raw) {
    imports.push(`const { readRaw } = require('./RawCodec')`)
    entries.push('  raw: readRaw,')
  }

  Folder({ name: 'utility/codec' }, () => {
    File({ name: 'index.' + target.ext }, () => {
      Content(`// The body codecs this model's points use; generated per model.
${imports.join('\n')}${0 < imports.length ? '\n\n' : ''}
const CODEC = {
${entries.join('\n')}${0 < entries.length ? '\n' : ''}}


module.exports = {
  CODEC
}
`)
    })
  })
})


export {
  CodecIndex
}
