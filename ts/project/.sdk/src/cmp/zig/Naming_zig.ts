import type { Naming as NamingType } from '@voxgig/sdkgen'

import { zigVarName } from './utility_zig'


// The names the zig code generator gives the SDK: the `sdk` module its build
// declares, ProjectNameSDK, and each entity's accessor method (MainEntity_zig:
// zigVarName).
const Naming: NamingType = (model) => ({
  layout: {
    module: 'sdk',
    client: model.const.Name + 'SDK',
    ctor: model.const.Name + 'SDK.new',
  },
  symbols: (e) => ({ accessor: zigVarName(e.name), var: zigVarName(e.name), vars: zigVarName(e.name) + 's' }),
})


export {
  Naming
}
