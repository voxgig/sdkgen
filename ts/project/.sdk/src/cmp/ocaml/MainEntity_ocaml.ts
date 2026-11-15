

import { cmp, Content } from '@voxgig/sdkgen'

import { entityModule, ocamlQualified, ocamlVarName } from './utility_ocaml'


// Entity accessor on the SDK client, injected into sdk_client.ml. Idiomatic
// usage:  Sdk_client.product client Noval  |> ... .e_list ...
const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props

  const fn = ocamlVarName(entity.name)

  Content(`
(* ${entity.Name} entity bound to a client:  ${fn} client entopts *)
let ${fn} (client : sdk_client) (entopts : value) : entity_obj =
  ${ocamlQualified(entityModule(entity.name), 'make')} client entopts
`)

})


export {
  MainEntity
}
