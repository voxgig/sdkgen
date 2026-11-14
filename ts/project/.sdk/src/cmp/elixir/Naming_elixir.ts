import { elixirAccessor, entityCollection, exampleVarName } from '@voxgig/sdkgen'
import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'

import { elixirEntityModule } from './utility_elixir'


// The names the elixir code generator gives the SDK: the ProjectName module
// and its Helpers (Main.fragment.ex), each entity's factory function on that
// module, collision-free over the WHOLE entity collection, inactive entities
// included (MainEntity_elixir: elixirAccessor), and the module its operations
// live in (Entity.fragment.ex: ProjectName.Entity.EntityName).
const Naming: NamingType = (model, _target, tm) => {
  const coll = entityCollection(model)
  return {
    layout: {
      module: tm('ProjectName'),
      client: tm('ProjectName'),
      ctor: tm('ProjectName') + '.new',
      names: { helpers: tm('ProjectName.Helpers') },
    },
    symbols: (e) => ({
      accessor: elixirAccessor(e, coll),
      var: exampleVarName(e.name, 'elixir'),
      module: elixirEntityModule(model.const.Name, { ...e, Name: nom(e, 'Name') }),
    }),
    ident: (name) => exampleVarName(name, 'elixir'),
  }
}


export {
  Naming
}
