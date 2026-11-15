import type { Naming as NamingType } from '@voxgig/sdkgen'

import { CLIENT_FILE, ERROR_FILE, ocamlModule, ocamlQualified, ocamlVarName } from './utility_ocaml'


// The names the ocaml code generator gives the SDK: the client module
// Main_ocaml writes (sdk_client.ml) with its `make`, the error module of
// SdkError_ocaml, the sdk_client record type of tm/ocaml/sdk_types.ml, and
// each entity's accessor function (MainEntity_ocaml: ocamlVarName).
const Naming: NamingType = (_model, _target, _tm) => ({
  layout: {
    module: ocamlModule(CLIENT_FILE),
    client: 'sdk_client',
    ctor: ocamlQualified(CLIENT_FILE, 'make'),
    names: { error: ocamlModule(ERROR_FILE) },
  },
  symbols: (e) => ({ accessor: ocamlVarName(e.name), var: ocamlVarName(e.name) }),
  ident: ocamlVarName,
})


export {
  Naming
}
