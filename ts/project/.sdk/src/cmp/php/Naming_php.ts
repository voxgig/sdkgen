import { exampleVarName, phpEntityAccessor } from '@voxgig/sdkgen'
import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'

import { phpSdkFile } from './utility_php'


// The names the php code generator gives the SDK: the entry file Main_php
// writes (phpSdkFile), the ProjectNameSDK class, and each entity's accessor
// method (MainEntity_php: phpEntityAccessor); the target's directory, which
// the root README's require_once names.
const Naming: NamingType = (model, target, tm) => ({
  layout: {
    dir: target.name,
    module: phpSdkFile(model),
    client: tm('ProjectNameSDK'),
    ctor: tm('ProjectNameSDK'),
  },
  symbols: (e) => ({ accessor: phpEntityAccessor(nom(e, 'Name')), var: exampleVarName(e.name, 'php') }),
  ident: (name) => exampleVarName(name, 'php'),
})


export {
  Naming
}
