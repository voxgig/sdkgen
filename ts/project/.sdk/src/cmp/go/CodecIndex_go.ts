import {
  cmp, File, Folder, Content,
  codecsUsed,
} from '@voxgig/sdkgen'


// GENERATED, NOT COPIED: the codec sources are trimmed to what the model's
// points use, so the index naming them is written per model.
const CodecIndex = cmp(function CodecIndex(props: any) {
  const { model } = props.ctx$
  const { target, gomodule } = props

  const used = codecsUsed(model)

  const entries: string[] = []
  if (used.form) {
    entries.push('\tForm:      EncodeForm,')
  }
  if (used.multipart) {
    entries.push('\tMultipart: EncodeMultipart,')
  }
  if (used.raw) {
    entries.push('\tRaw:       ReadRaw,')
  }

  const boundary = used.multipart ? ' = multipartBoundary' : ''

  Folder({ name: 'utility' }, () => {
    Folder({ name: 'codec' }, () => {
      File({ name: 'index.' + target.ext }, () => {
        Content(`// Package codec holds the body codecs this model's points use; this index
// is generated per model.
package codec

import "${gomodule}/core"

var CODEC = core.Codec{
${entries.join('\n')}${0 < entries.length ? '\n' : ''}}

var MultipartBoundary func(ctx *core.Context) string${boundary}
`)
      })
    })
  })
})


export {
  CodecIndex
}
