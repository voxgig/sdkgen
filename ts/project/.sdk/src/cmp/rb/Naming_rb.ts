import { exampleVarName } from '@voxgig/sdkgen'
import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'

import { rbSdkFile } from './utility_rb'


// The names the rb code generator gives the SDK: the entry file Main_rb
// writes (rbSdkFile), the ProjectNameSDK class and its `.new`, and each
// entity's accessor (MainEntity_rb: `def ${entity.Name}(data = nil)`); the
// target's directory, which the root README's require_relative names.
const Naming: NamingType = (model, target, tm) => ({
  layout: {
    dir: target.name,
    module: rbSdkFile(model),
    client: tm('ProjectNameSDK'),
    ctor: tm('ProjectNameSDK.new'),
  },
  symbols: (e) => ({ accessor: nom(e, 'Name'), var: exampleVarName(e.name, 'rb') }),
  ident: (name) => exampleVarName(name, 'rb'),
})


export {
  Naming
}
