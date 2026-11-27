import {
  cmp, File, Content,
  codecsUsed,
} from '@voxgig/sdkgen'


// GENERATED, NOT COPIED: the codec sources are trimmed to what the model's
// points use, so the module naming them is written per model.
const CodecIndex = cmp(function CodecIndex(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const used = codecsUsed(model)

  File({ name: 'sdk_codec.' + target.ext }, () => {
    Content(`(* ${model.const.Name} SDK body codecs this model's points use; generated per model. *)

open Sdk_types

let codec () : codec = {
  cd_form = ${used.form ? 'Some Form_codec.encode' : 'None'};
  cd_multipart = ${used.multipart ? 'Some Multipart_codec.encode' : 'None'};
  cd_raw = ${used.raw ? 'Some Raw_codec.read' : 'None'};
}

let multipart_boundary : (ctx -> string) option = ${used.multipart ? 'Some Multipart_codec.boundary' : 'None'}
`)
  })
})


export {
  CodecIndex
}
