import {
  cmp, File, Folder, Content,
  codecsUsed,
} from '@voxgig/sdkgen'


// GENERATED, NOT COPIED: the codec headers are trimmed to what the model's
// points use, so the header naming them is written per model. The macros
// tell a test which are present, since a trimmed one cannot be included.
const CodecIndex = cmp(function CodecIndex(props: any) {
  const { model } = props.ctx$

  const used = codecsUsed(model)

  const includes = ['form', 'multipart', 'raw', 'handle']
    .filter((name) => (used as any)[name])
    .map((name) => `#include "${name}.hpp"`)

  const flag = (name: string, on: boolean) => `#define CODEC_HAS_${name} ${on ? 1 : 0}`

  Folder({ name: 'utility/codec' }, () => {
    File({ name: 'index.hpp' }, () => {
      Content(`// The body codecs this model's points use; generated per model.

#pragma once

${flag('FORM', used.form)}
${flag('MULTIPART', used.multipart)}
${flag('RAW', used.raw)}
${flag('HANDLE', used.handle)}

#include "../../core/types.hpp"
${includes.join('\n')}${0 < includes.length ? '\n' : ''}
namespace sdk {
namespace util {

inline void registerCodecs(Utility& u) {
${used.form ? '  u.codec.form = encodeForm;\n' : ''}${used.multipart ? '  u.codec.multipart = encodeMultipart;\n  u.multipartBoundary = multipartBoundary;\n' : ''}${used.raw ? '  u.codec.raw = readRaw;\n' : ''}  (void)u;
}

}  // namespace util
}  // namespace sdk
`)
    })
  })
})


export {
  CodecIndex
}
