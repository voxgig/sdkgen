import type { Naming as NamingType } from '@voxgig/sdkgen'

import { kotlinCorePackage, kotlinVarName } from './utility_kotlin'


// The names the kotlin code generator gives the SDK: the package the client
// class is generated into (Config_kotlin, Schema_kotlin: kotlinCorePackage),
// the ProjectNameSDK class, which is its own constructor, and each entity's
// accessor and local names (MainEntity_kotlin: kotlinVarName).
const Naming: NamingType = (model, _target, tm) => ({
  layout: {
    module: kotlinCorePackage(model),
    client: tm('ProjectNameSDK'),
    ctor: tm('ProjectNameSDK'),
  },
  symbols: (e) => ({ accessor: kotlinVarName(e.name), var: kotlinVarName(e.name) }),
  ident: (name) => kotlinVarName(name),
})


export {
  Naming
}
