import { exampleVarName, packageName } from '@voxgig/sdkgen'
import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'


// The names the js code generator gives the SDK: the package Package_js
// publishes, the ProjectNameSDK class, and each entity's accessor
// (MainEntity_js: `${entity.Name}(entopts)`).
const Naming: NamingType = (model, target, tm) => ({
  layout: {
    module: packageName(model, target.name),
    client: tm('ProjectNameSDK'),
    ctor: tm('ProjectNameSDK'),
  },
  symbols: (e) => ({ accessor: nom(e, 'Name'), var: exampleVarName(e.name, 'js') }),
  ident: (name) => exampleVarName(name, 'js'),
})


export {
  Naming
}
