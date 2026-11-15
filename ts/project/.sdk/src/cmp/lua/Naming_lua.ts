import { exampleVarName } from '@voxgig/sdkgen'
import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'

import { luaSdkModule } from './utility_lua'


// The names the lua code generator gives the SDK: the module Main_lua writes
// (luaSdkModule), the ProjectNameSDK table, the module bound to `sdk` and its
// `new`, as the generated tests require and call it (TestEntity_lua,
// TestDirect_lua), and each entity's accessor (MainEntity_lua:
// `function ProjectNameSDK:${entity.Name}(data)`).
const Naming: NamingType = (model, _target, tm) => ({
  layout: {
    module: luaSdkModule(model),
    client: tm('ProjectNameSDK'),
    ctor: 'sdk.new',
  },
  symbols: (e) => ({ accessor: nom(e, 'Name'), var: exampleVarName(e.name, 'lua') }),
  ident: (name) => exampleVarName(name, 'lua'),
})


export {
  Naming
}
