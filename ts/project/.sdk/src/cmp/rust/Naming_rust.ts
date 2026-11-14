import type { Naming as NamingType } from '@voxgig/sdkgen'

import { crateIdent, rustMethodName, rustVarName } from './utility_rust'


// The names the rust code generator gives the SDK: the crate Package_rust
// declares (crateIdent), ProjectNameSDK and ProjectNameEntityBase from the
// templates (Main.fragment.rs, core/types.rs), and each entity's accessor
// method (MainEntity_rust: rustMethodName) and module (rustVarName).
const Naming: NamingType = (model, _target, tm) => ({
  layout: {
    module: crateIdent(model),
    client: tm('ProjectNameSDK'),
    ctor: tm('ProjectNameSDK::new'),
    names: { entityBase: tm('ProjectNameEntityBase') },
  },
  symbols: (e) => ({ accessor: rustMethodName(e.name), var: rustVarName(e.name) }),
  ident: rustVarName,
})


export {
  Naming
}
