import type { Naming as NamingType } from '@voxgig/sdkgen'

import { cppVarName } from './utility_cpp'


// The names the cpp code generator gives the SDK: the umbrella header
// tm/cpp/core/sdk.hpp, the `sdk` namespace every template opens, the
// ProjectNameSDK class (Main.fragment.cpp), and each entity's accessor
// (MainEntity_cpp: cppVarName).
const Naming: NamingType = (_model, _target, tm) => ({
  layout: {
    module: 'core/sdk.hpp',
    client: tm('ProjectNameSDK'),
    ctor: tm('ProjectNameSDK'),
    names: { namespace: 'sdk' },
  },
  symbols: (e) => ({ accessor: cppVarName(e.name), var: cppVarName(e.name) }),
  ident: cppVarName,
})


export {
  Naming
}
