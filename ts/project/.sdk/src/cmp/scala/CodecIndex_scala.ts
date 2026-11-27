import {
  cmp, File, Folder, Content,
  codecsUsed,
} from '@voxgig/sdkgen'

import { scalaPackage } from './utility_scala'


// GENERATED, NOT COPIED: the codec sources are trimmed to what the model's
// points use, so the index naming them is written per model.
const CodecIndex = cmp(function CodecIndex(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const used = codecsUsed(model)

  const entries: string[] = []

  if (used.form) {
    entries.push('    out.put("form", (FormCodec.encodeForm: BodyEncoder))')
  }
  if (used.multipart) {
    entries.push('    out.put("multipart", (MultipartCodec.encodeMultipart: BodyEncoder))',
      '    out.put("multipartBoundary", (MultipartCodec.multipartBoundary: CtxFn[String]))')
  }
  if (used.raw) {
    entries.push('    out.put("raw", (RawCodec.readRaw: CtxFn[Unit]))')
  }

  Folder({ name: 'utility/codec' }, () => {
    File({ name: 'CodecIndex.' + target.ext }, () => {
      Content(`package ${scalaPackage(model)}.utility

import java.util.{LinkedHashMap, Map => JMap}
import ${scalaPackage(model)}.core._

// The body codecs this model's points use; generated per model.
object CodecIndex {
  def codecs(): JMap[String, Object] = {
    val out = new LinkedHashMap[String, Object]()
${entries.join('\n')}${0 < entries.length ? '\n' : ''}    out
  }
}
`)
    })
  })
})


export {
  CodecIndex
}
