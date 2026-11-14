import type { Naming as NamingType } from '@voxgig/sdkgen'

import { crateIdent, rustMethodName, rustVarName } from './utility_rust'


// The names the rust code generator gives the SDK: the crate Package_rust
// declares (crateIdent), ProjectNameSDK and ProjectNameEntityBase from the
// templates (Main.fragment.rs, core/types.rs), and each entity's accessor
// method (MainEntity_rust: rustMethodName) and module (rustVarName).
const Naming: NamingType = (model) => ({
  layout: {
    module: crateIdent(model),
    client: model.const.Name + 'SDK',
    ctor: model.const.Name + 'SDK::new',
    names: { entityBase: model.const.Name + 'EntityBase' },
  },
  symbols: (e) => {
    const v = rustVarName(e.name)
    return { accessor: rustMethodName(e.name), var: v, vars: v + 's' }
  },
})


export {
  Naming
}
