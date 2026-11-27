import {
  cmp, File, Folder, Content,
  codecsUsed,
} from '@voxgig/sdkgen'

import { kotlinPackage } from './utility_kotlin'


// GENERATED, NOT COPIED: the codec sources are trimmed to what the model's
// points use, so the index naming them is written per model.
const CodecIndex = cmp(function CodecIndex(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const kotlinpackage = kotlinPackage(model)
  const used = codecsUsed(model)

  const entries: string[] = []
  if (used.form) {
    entries.push('    "form" to FormCodec::encodeForm,')
  }
  if (used.multipart) {
    entries.push('    "multipart" to MultipartCodec::encodeMultipart,')
  }
  if (used.raw) {
    entries.push('    "raw" to RawCodec::readRaw,')
  }

  const boundary = used.multipart ? 'MultipartCodec::multipartBoundary' : 'null'

  Folder({ name: 'utility/codec' }, () => {
    File({ name: 'CodecIndex.' + target.ext }, () => {
      Content(`package ${kotlinpackage}.utility.codec

import ${kotlinpackage}.core.Context

/** The body codecs this model's points use; generated per model. */
object CodecIndex {

  fun codec(): MutableMap<String, Any?> = linkedMapOf(
${entries.join('\n')}${0 < entries.length ? '\n' : ''}  )

  fun multipartBoundary(): ((Context) -> String)? = ${boundary}
}
`)
    })
  })
})


export {
  CodecIndex
}
