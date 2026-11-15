import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'

import { swiftTargetDir, swiftVarName } from './utility_swift'


// The names the swift code generator gives the SDK: the module Package_swift
// declares (swiftTargetDir), the ProjectNameSDK class and its initializer,
// each entity's accessor (MainEntity_swift: `public func ${entity.Name}(...)`),
// and local names as EntityTypes_swift spells them (swiftVarName).
const Naming: NamingType = (model, _target, tm) => ({
  layout: {
    module: swiftTargetDir(model),
    client: tm('ProjectNameSDK'),
    ctor: tm('ProjectNameSDK'),
  },
  symbols: (e) => ({ accessor: nom(e, 'Name'), var: swiftVarName(e.name) }),
  ident: (name) => swiftVarName(name),
})


export {
  Naming
}
