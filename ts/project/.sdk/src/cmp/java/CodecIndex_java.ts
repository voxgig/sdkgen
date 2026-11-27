import {
  cmp, File, Folder, Content,
  codecsUsed,
} from '@voxgig/sdkgen'

import { javaPackage } from './utility_java'


// GENERATED, NOT COPIED: the codec sources are trimmed to what the model's
// points use, so the index naming them is written per model.
const CodecIndex = cmp(function CodecIndex(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const javapackage = javaPackage(model)
  const used = codecsUsed(model)

  const entries: string[] = []
  if (used.form) {
    entries.push('    codec.put("form", (Utility.EncodeFn) FormCodec::encodeForm);')
  }
  if (used.multipart) {
    entries.push('    codec.put("multipart", (Utility.EncodeFn) MultipartCodec::encodeMultipart);')
  }
  if (used.raw) {
    entries.push('    codec.put("raw", (Utility.RawFn) RawCodec::readRaw);')
  }

  const boundary = used.multipart ? 'MultipartCodec::multipartBoundary' : 'null'

  Folder({ name: 'utility/codec' }, () => {
    File({ name: 'CodecIndex.' + target.ext }, () => {
      Content(`package ${javapackage}.utility.codec;

import java.util.LinkedHashMap;
import java.util.Map;

import ${javapackage}.core.Utility;

/** The body codecs this model's points use; generated per model. */
public final class CodecIndex {

  private CodecIndex() {}

  public static Map<String, Object> codec() {
    Map<String, Object> codec = new LinkedHashMap<>();
${entries.join('\n')}${0 < entries.length ? '\n' : ''}    return codec;
  }

  public static Utility.CtxFn<String> multipartBoundary() {
    return ${boundary};
  }
}
`)
    })
  })
})


export {
  CodecIndex
}
