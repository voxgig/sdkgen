import { goModule } from '@voxgig/sdkgen'
import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'

import { goVarName } from './utility_go'


// The names the go code generator gives the SDK: the module path (Main_go,
// Package_go: goModule), NewProjectNameSDK, and each entity's exported
// accessor (MainEntity_go: `${entity.Name}(data)`).
const Naming: NamingType = (model, target) => ({
  layout: {
    module: goModule(model, target.name),
    client: model.const.Name + 'SDK',
    ctor: 'New' + model.const.Name + 'SDK',
  },
  symbols: (e) => ({ accessor: nom(e, 'Name'), var: goVarName(e.name), vars: goVarName(e.name) + 's' }),
})


export {
  Naming
}
