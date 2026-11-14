import { exampleVarName, packageName } from '@voxgig/sdkgen'
import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'


// The names the ts code generator gives the SDK: the package Package_ts
// publishes, the ProjectNameSDK class, and each entity's accessor
// (MainEntity_ts: `${entity.Name}(entopts)`).
const Naming: NamingType = (model, target) => ({
  layout: {
    module: packageName(model, target.name),
    client: model.const.Name + 'SDK',
    ctor: model.const.Name + 'SDK',
  },
  symbols: (e) => {
    const v = exampleVarName(nom(e, 'Name').toLowerCase(), 'ts')
    return { accessor: nom(e, 'Name'), var: v, vars: v + 's' }
  },
})


export {
  Naming
}
