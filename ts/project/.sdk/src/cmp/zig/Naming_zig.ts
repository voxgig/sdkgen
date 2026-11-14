import type { Naming as NamingType } from '@voxgig/sdkgen'

import { zigVarName } from './utility_zig'


// The names the zig code generator gives the SDK: the `sdk` module its build
// declares, ProjectNameSDK, and each entity's accessor method (MainEntity_zig:
// zigVarName).
const Naming: NamingType = (_model, _target, tm) => ({
  layout: {
    module: 'sdk',
    client: tm('ProjectNameSDK'),
    ctor: tm('ProjectNameSDK.new'),
  },
  symbols: (e) => ({ accessor: zigVarName(e.name), var: zigVarName(e.name) }),
  ident: zigVarName,
})


export {
  Naming
}
