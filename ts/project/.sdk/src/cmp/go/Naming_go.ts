import { goModule } from '@voxgig/sdkgen'
import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'

import { goVarName } from './utility_go'


// The names the go code generator gives the SDK: the module path (Main_go,
// Package_go: goModule), NewProjectNameSDK, and each entity's exported
// accessor (MainEntity_go: `${entity.Name}(data)`).
const Naming: NamingType = (model, target, tm) => ({
  layout: {
    module: goModule(model, target.name),
    client: tm('ProjectNameSDK'),
    ctor: tm('NewProjectNameSDK'),
  },
  symbols: (e) => ({ accessor: nom(e, 'Name'), var: goVarName(e.name) }),
  ident: goVarName,
})


export {
  Naming
}
