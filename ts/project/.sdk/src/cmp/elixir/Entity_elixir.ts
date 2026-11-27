
import * as Path from 'node:path'

import {
  cmp, camelify,
  File, Folder, Fragment,
  entitySlots,
} from '@voxgig/sdkgen'


import { EntityOperation } from './EntityOperation_elixir'


const OPS = ['load', 'list', 'create', 'update', 'patch', 'remove']


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  const Name = model.const.Name
  const entrep = { ...stdrep }

  const ff = Path.normalize(__dirname + '/../../../src/cmp/elixir/fragment/')

  Folder({ name: 'lib' }, () => {
    Folder({ name: 'entity' }, () => {
      File({ name: entity.name + '_entity.' + target.ext }, () => {

        const opnames = Object.keys(entity.op || {})

        const opfrags =
          (OPS
            .reduce((a: any, opname: string) =>
            (a['# #' + camelify(opname) + 'Op'] =
              !opnames.includes(opname) ? '' : (_slot: any) => {
                EntityOperation({ ff, opname, entity, entrep })
              }, a), {}))

        Fragment({
          from: ff + 'Entity.fragment.ex',
          replace: {
            ...entrep,
            ProjectName: Name,
            EntityName: entity.Name,
            entityname: entity.name,
            '# #Aliases': aliases(props.ctx$.fs(), ff, Name, opnames),
            '# #BinarySlot': binarySlot(Name, entity),
            ...opfrags,
          }
        })
      })
    })
  })
})


// The entity's binary slots, by name; "" is its own bytes, reached with no name.
function binarySlot(Name: string, entity: any): string {
  const slots = entitySlots(entity)
  if (0 === slots.length) {
    return ''
  }

  const table = slots.map((slot: any) => '    ' + JSON.stringify(slot.name) + ' => %{' +
    [['action', slot.action], ['read', slot.read], ['write', slot.write]]
      .filter(([, v]) => null != v)
      .map(([k, v]) => JSON.stringify(k) + ' => ' + JSON.stringify(v)).join(', ') + '}')
  const named = slots.map((slot: any) => slot.name).filter((name: string) => '' !== name)
  const param = 0 === named.length ? '' : named.length < slots.length ? ', slot \\\\ ""' : ', slot'

  return `@binary_slots %{
${table.join(',\n')}
  }

  def binary_slots, do: @binary_slots

  # An entity's bytes never enter its data: they are reached by slot${0 === named.length ? '' :
    ', one of ' + named.map((name: string) => JSON.stringify(name)).join(', ')}.
  def binary(ent${param}),
    do: ${Name}.BinaryHandle.new(ent, @binary_slots${'' === param ? '' : ', slot'})
`
}


// Only what the emitted operations use: elixir warns on an unused alias.
function aliases(fs: any, ff: string, Name: string, opnames: string[]): string {
  const optext = OPS.filter((opname) => opnames.includes(opname))
    .map((opname) => String(fs.readFileSync(
      ff + 'Entity' + camelify(opname) + 'Op.fragment.ex', 'utf8')))
    .join('\n')
  const uses = (name: string) => new RegExp('\\b' + name + '\\.').test(optext)
  const core = ['EntityBase', ...['Context', 'Pipeline'].filter(uses)]

  return [
    ...(uses('S') ? ['alias Voxgig.Struct, as: S'] : []),
    ...(uses('H') ? ['alias ' + Name + '.Helpers, as: H'] : []),
    'alias ' + Name + (1 === core.length ? '.' + core[0] : '.{' + core.join(', ') + '}'),
  ].join('\n  ')
}


export {
  Entity
}
