import { exampleVarName } from '@voxgig/sdkgen'
import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'

import { pyPackageDir } from './utility_py'


// The names the py code generator gives the SDK: the package directory
// (Main_py: pyPackageDir), the ProjectNameSDK class, and each entity's accessor
// (MainEntity_py: `def ${entity.Name}(self, data=None)`).
const Naming: NamingType = (model, _target, tm) => ({
  layout: {
    module: pyPackageDir(model),
    client: tm('ProjectNameSDK'),
    ctor: tm('ProjectNameSDK'),
  },
  symbols: (e) => ({ accessor: nom(e, 'Name'), var: exampleVarName(e.name, 'py') }),
  ident: (name) => exampleVarName(name, 'py'),
})


export {
  Naming
}
