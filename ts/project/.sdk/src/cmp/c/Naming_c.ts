import type { Naming as NamingType } from '@voxgig/sdkgen'

import { cAccessorName, cVarName } from './utility_c'


// The names the c code generator gives the SDK: `<ident>_sdk_new`, and each
// entity's constructor `<ident>_<evar>` (MainEntity_c: cAccessorName), whose
// handle an example names by the entity's own identifier. Field identifiers
// are cVarName's too (EntityTypes_c).
const Naming: NamingType = (model, _target, tm) => ({
  layout: {
    module: 'core/api.h',
    client: tm('ProjectNameSDK'),
    ctor: tm('projectname_sdk_new'),
  },
  symbols: (e) => {
    const evar = cVarName(e.name)
    const fields: Record<string, string> = {}
    for (const f of Object.values(e.fields || {}) as any[]) if (f && f.n) fields[f.n] = cVarName(f.n)
    return { accessor: cAccessorName(model, e.name), var: evar, fields }
  },
  ident: cVarName,
})


export {
  Naming
}
