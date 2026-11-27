import {
  cmp, File, Folder, Content,
  codecsUsed,
} from '@voxgig/sdkgen'


// GENERATED, NOT COPIED: the codec sources are trimmed to what the model's
// points use, so the table naming them is written per model. The header
// tells a test which are present, since a trimmed one cannot be linked.
const CodecIndex = cmp(function CodecIndex(_props: any) {
  const { model } = _props.ctx$

  const used = codecsUsed(model)

  const decls: string[] = []
  if (used.form) {
    decls.push('voxgig_value* codec_encode_form(Context* ctx, voxgig_value* data, char** type, PNError** err);')
  }
  if (used.multipart) {
    decls.push('voxgig_value* codec_encode_multipart(Context* ctx, voxgig_value* data, char** type, PNError** err);',
      'char* codec_multipart_boundary(Context* ctx);')
  }
  if (used.raw) {
    decls.push('PNError* codec_read_raw(Context* ctx);')
  }

  const flag = (name: string, on: boolean) => `#define CODEC_HAS_${name} ${on ? 1 : 0}`

  Folder({ name: 'utility/codec' }, () => {
    File({ name: 'index.h' }, () => {
      Content(`// The body codecs this model's points use; generated per model.

#ifndef CODEC_INDEX_H
#define CODEC_INDEX_H

#include "sdk.h"

${flag('FORM', used.form)}
${flag('MULTIPART', used.multipart)}
${flag('RAW', used.raw)}
${flag('HANDLE', used.handle)}
${decls.join('\n')}${0 < decls.length ? '\n' : ''}
#endif
`)
    })

    File({ name: 'index.c' }, () => {
      Content(`// The body codecs this model's points use; generated per model.

#include "index.h"

const CodecTable codec_table = {
  ${used.form ? 'codec_encode_form' : 'NULL'},
  ${used.multipart ? 'codec_encode_multipart' : 'NULL'},
  ${used.multipart ? 'codec_multipart_boundary' : 'NULL'},
  ${used.raw ? 'codec_read_raw' : 'NULL'},
};
`)
    })
  })
})


export {
  CodecIndex
}
