import type { Naming as NamingType } from '@voxgig/sdkgen'

import { scalaCorePackage, scalaVarName } from './utility_scala'


// The names the scala code generator gives the SDK: the core package the
// client and its entity contract live in (scalaCorePackage, which Config_scala
// and Schema_scala write into), the ProjectNameSDK class and the SdkEntity
// trait of the templates (Main.fragment.scala, core/Contracts.scala), and each
// entity's accessor method (MainEntity_scala: scalaVarName).
const Naming: NamingType = (model, _target, tm) => ({
  layout: {
    module: scalaCorePackage(model),
    client: tm('ProjectNameSDK'),
    ctor: tm('ProjectNameSDK'),
    names: { entity: tm('SdkEntity') },
  },
  symbols: (e) => ({ accessor: scalaVarName(e.name), var: scalaVarName(e.name) }),
  ident: scalaVarName,
})


export {
  Naming
}
