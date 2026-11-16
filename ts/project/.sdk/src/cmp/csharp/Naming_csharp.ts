import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'

import { csVarName } from './utility_csharp'


// The names the csharp code generator gives the SDK: the ProjectNameSdk
// namespace and the ProjectNameSDK class the templates declare
// (Main.fragment.cs), each entity's accessor (MainEntity_csharp:
// `${entity.Name}(entopts)`), and local names as TestEntity_csharp spells
// them (csVarName).
const Naming: NamingType = (_model, _target, tm) => ({
  layout: {
    module: tm('ProjectNameSdk'),
    client: tm('ProjectNameSDK'),
    ctor: tm('ProjectNameSDK'),
  },
  symbols: (e) => ({ accessor: nom(e, 'Name'), var: csVarName(e.name) }),
  ident: (name) => csVarName(name),
})


export {
  Naming
}
