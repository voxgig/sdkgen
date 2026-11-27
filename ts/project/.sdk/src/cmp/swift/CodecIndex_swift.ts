import {
  cmp, File, Folder, Content,
  codecsUsed,
} from '@voxgig/sdkgen'

import { swiftTargetDir } from './utility_swift'


// GENERATED, NOT COPIED: the codec sources are trimmed to what the model's
// points use, so the index naming them is written per model.
const CodecIndex = cmp(function CodecIndex(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const used = codecsUsed(model)

  const entries: string[] = []

  if (used.form) {
    entries.push('    "form": encodeForm as Utility.BodyEncoder,')
  }
  if (used.multipart) {
    entries.push('    "multipart": encodeMultipart as Utility.BodyEncoder,',
      '    "multipartBoundary": multipartBoundaryUtil as (Context) -> String,')
  }
  if (used.raw) {
    entries.push('    "raw": readRawUtil as (Context) throws -> Void,')
  }

  const table = 0 === entries.length ? '[:]' : '[\n' + entries.join('\n') + '\n  ]'

  Folder({ name: 'Sources' }, () => {
    Folder({ name: swiftTargetDir(model) }, () => {
      Folder({ name: 'utility/codec' }, () => {
        File({ name: 'CodecIndex.' + target.ext }, () => {
          Content(`// ${model.const.Name} SDK utility: the body codecs this model's points use; generated per model.

import Foundation

func codecIndex() -> [String: Any] {
  return ${table}
}
`)
        })
      })
    })
  })
})


export {
  CodecIndex
}
