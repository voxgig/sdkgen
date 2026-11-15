import { exampleVarName } from '@voxgig/sdkgen'
import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'


// The names the perl code generator gives the SDK: the ProjectNameSDK package
// (Main.fragment.pm, in the file Main_perl writes) and its `->new`, and each
// entity's accessor method (MainEntity_perl: `sub ${entity.Name}`); the
// target's directory, where the root README finds `lib`.
const Naming: NamingType = (_model, target, tm) => ({
  layout: {
    dir: target.name,
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
