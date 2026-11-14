import { elixirAccessor, entityCollection, exampleVarName } from '@voxgig/sdkgen'
import type { Naming as NamingType } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'

import { elixirEntityModule } from './utility_elixir'


// The names the elixir code generator gives the SDK: the ProjectName module
// and its Helpers (Main.fragment.ex), each entity's factory function on that
// module, collision-free over the WHOLE entity collection, inactive entities
// included (MainEntity_elixir: elixirAccessor), and the module its operations
// live in (Entity.fragment.ex: ProjectName.Entity.EntityName).
const Naming: NamingType = (model) => {
  const Name = model.const.Name
  const coll = entityCollection(model)
  return {
    layout: {
      module: Name,
      client: Name,
      ctor: Name + '.new',
      names: { helpers: Name + '.Helpers' },
    },
    symbols: (e) => {
      const v = exampleVarName(e.name, 'elixir')
      const module = elixirEntityModule(Name, { ...e, Name: nom(e, 'Name') })
      return { accessor: Name + '.' + elixirAccessor(e, coll), var: v, vars: v + 's', module, type: module }
    },
  }
}


export {
  Naming
}
