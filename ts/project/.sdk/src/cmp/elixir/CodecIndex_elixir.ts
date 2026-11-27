import {
  cmp, File, Folder, Content,
  codecsUsed,
} from '@voxgig/sdkgen'

import { elixirApp } from './app_elixir'


// GENERATED, NOT COPIED: the codec sources are trimmed to what the model's
// points use, so the index naming them is written per model.
const CodecIndex = cmp(function CodecIndex(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const Name = model.const.Name
  const used = codecsUsed(model)

  const entries: string[] = []

  if (used.form) {
    entries.push(`"form", &${Name}.Codec.Form.encode/3`)
  }
  if (used.multipart) {
    entries.push(`"multipart", &${Name}.Codec.Multipart.encode/3`,
      `"multipart_boundary", &${Name}.Codec.Multipart.boundary/1`)
  }
  if (used.raw) {
    entries.push(`"raw", &${Name}.Codec.Raw.read/1`)
  }

  Folder({ name: elixirApp(model, target) + '/codec' }, () => {
    File({ name: 'index.' + target.ext }, () => {
      Content(`# The body codecs this model's points use; generated per model.

defmodule ${Name}.Codec.Index do
  def codec do
    Voxgig.Struct.jm([${0 < entries.length ? '\n      ' + entries.join(',\n      ') + '\n    ' : ''}])
  end
end
`)
    })
  })
})


export {
  CodecIndex
}
