import { exampleVarName } from '@voxgig/sdkgen'
import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'

import { pyPackageDir } from './utility_py'


// The names the py code generator gives the SDK: the package directory
// (Main_py: pyPackageDir), the ProjectNameSDK class, and each entity's accessor
// (MainEntity_py: `def ${entity.Name}(self, data=None)`).
const Naming: NamingType = (model) => ({
  layout: {
    module: pyPackageDir(model),
    client: model.const.Name + 'SDK',
    ctor: model.const.Name + 'SDK',
  },
  symbols: (e) => {
    const v = exampleVarName(nom(e, 'Name').toLowerCase(), 'py')
    return { accessor: nom(e, 'Name'), var: v, vars: v + 's' }
  },
})


export {
  Naming
}
