
import * as Path from 'node:path'

import {
  cmp, camelify, names,
  Content, File, Folder, Fragment,
  entityClassName, entityCollection, entitySlots,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_csharp'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  // Collision-free entity CLASS name (see entityClassName): normally
  // `<Name>Entity`, but disambiguated when it would clash with another
  // entity's data-type name.
  const entityColl = entityCollection(model)
  const cls = entityClassName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  const ff = Path.normalize(__dirname + '/../../../src/cmp/csharp/fragment/')

  const binarySlot = binarySlotSource(model.const.Name, cls, entitySlots(entity))

  Folder({ name: 'entity' }, () => {

    File({ name: cls + '.' + target.ext }, () => {

      const opnames = Object.keys(entity.op || {})

      // For each CRUD op: if the spec defines it, splice in the real
      // implementation (an override). Otherwise leave the base-class
      // virtual, which throws UnsupportedOp at runtime.
      const opfrags =
        (['load', 'list', 'create', 'update', 'patch', 'remove']
          .reduce((a: any, opname: string) =>
          (a['#' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ?
              ({ indent }: any) => {
                Content({ indent },
                  `// (${opname} not defined by this API - base class throws UnsupportedOp)
`)
              } :
              ({ indent }: any) => {
                EntityOperation({ ff, opname, indent, entity, entrep, cls })
              }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.cs',
        replace: {
          ...entrep,
          ProjectNameSdk: model.const.Name + 'Sdk',
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          // Class/constructor tokens are decoupled from the EntityName
          // data-type token so the class can be renamed independently.
          EntyClass: cls,

          '#BinarySlot': ({ indent }: any) => null == binarySlot ? undefined :
            Content({ indent }, binarySlot),

          ...opfrags,
        }
      })

    })
  })
})



// A slot name as a constant identifier: its alphanumeric runs, capitalised.
function slotConst(name: string, taken: string[]): string {
  const base = name.split(/[^A-Za-z0-9]+/).filter((p) => '' !== p)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')
  const ident = /^[0-9]/.test(base) ? 'Slot' + base : '' === base ? 'Slot' : base
  let out = ident
  for (let i = 2; taken.includes(out); i++) out = ident + i
  taken.push(out)
  return out
}


// The entity's binary slots, by name; "" is its own bytes, reached with no name.
function binarySlotSource(Name: string, cls: string, slots: any[]): string | undefined {
  if (0 === slots.length) return undefined

  const lit = (v: any) => null == v ? 'null' : JSON.stringify(String(v))
  const table = slots.map((slot: any) => `        [${lit(slot.name)}] = new ${Name}BinarySlot(` +
    `${lit(slot.action)}, ${lit(slot.read)}, ${lit(slot.write)}),`).join('\n')

  const taken: string[] = []
  const named = slots.map((slot: any) => slot.name).filter((name: string) => '' !== name)
  const consts = named.map((name: string) =>
    `    public const string ${slotConst(name, taken)} = ${lit(name)};`).join('\n')

  const param = 0 === named.length ? '' :
    named.length < slots.length ? 'string? slot = null' : 'string slot'

  return `public static class BinarySlot
{
${consts}
}

private static readonly IReadOnlyDictionary<string, ${Name}BinarySlot> BinarySlots =
    new Dictionary<string, ${Name}BinarySlot>
    {
${table}
    };

// An entity's bytes never enter its data: they are reached by slot.
public ${Name}BinaryHandle<${cls}> Binary(${param})
{
    return new ${Name}BinaryHandle<${cls}>(this, entctx, BinarySlots${'' === param ? '' : ', slot'});
}
`.replace(/^public static class BinarySlot\n\{\n\n\}\n\n/, '')
}


export {
  Entity
}
