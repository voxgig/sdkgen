import { exampleVarName } from '@voxgig/sdkgen'
import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'


// The names the perl code generator gives the SDK: the ProjectNameSDK package
// (Main.fragment.pm, in the file Main_perl writes) and its `->new`, and each
// entity's accessor method (MainEntity_perl: `sub ${entity.Name}`).
const Naming: NamingType = (_model, _target, tm) => ({
  layout: {
    module: tm('ProjectNameSDK'),
    client: tm('ProjectNameSDK'),
    ctor: tm('ProjectNameSDK->new'),
  },
  symbols: (e) => ({ accessor: nom(e, 'Name'), var: exampleVarName(e.name, 'perl') }),
  ident: (name) => exampleVarName(name, 'perl'),
})


export {
  Naming
}
