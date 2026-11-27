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
    imports.push(`import { encodeForm } from './FormCodec'`)
    entries.push('  form: encodeForm,')
  }
  if (used.multipart) {
    imports.push(`import { encodeMultipart, multipartBoundary } from './MultipartCodec'`)
    entries.push('  multipart: encodeMultipart,', '  multipartBoundary,')
  }
  if (used.raw) {
    imports.push(`import { readRaw } from './RawCodec'`)
    entries.push('  raw: readRaw,')
  }

  Folder({ name: 'utility/codec' }, () => {
    File({ name: 'index.' + target.ext }, () => {
      Content(`// The body codecs this model's points use; generated per model.
${imports.join('\n')}${0 < imports.length ? '\n\n' : ''}
const CODEC: Record<string, any> = {
${entries.join('\n')}${0 < entries.length ? '\n' : ''}}


export {
  CODEC
}
`)
    })
  })
})


export {
  CodecIndex
}
