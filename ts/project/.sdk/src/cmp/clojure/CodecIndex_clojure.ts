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

  const requires: string[] = []
  const entries: string[] = []

  if (used.form) {
    requires.push('[sdk.codec.form :as form]')
    entries.push('"form" form/encode')
  }
  if (used.multipart) {
    requires.push('[sdk.codec.multipart :as multipart]')
    entries.push('"multipart" multipart/encode', '"multipart-boundary" multipart/boundary')
  }
  if (used.raw) {
    requires.push('[sdk.codec.raw :as raw]')
    entries.push('"raw" raw/read')
  }

  Folder({ name: 'src/sdk/codec' }, () => {
    File({ name: 'index.' + target.ext }, () => {
      Content(`;; ${model.const.Name} SDK body codecs this model's points use; generated per model.
(ns sdk.codec.index${0 < requires.length ? '\n  (:require ' + requires.join('\n            ') + ')' : ''})

(defn codec []
  {${entries.join('\n   ')}})
`)
    })
  })
})


export {
  CodecIndex
}
