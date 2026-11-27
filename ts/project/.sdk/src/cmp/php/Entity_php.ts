
import * as Path from 'node:path'

import {
  cmp, each, camelify, names,
  File, Content, Folder, Fragment, Line, FeatureHook, Slot,
  entityClassName, entityCollection, entitySlots,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_php'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  // Collision-free entity CLASS name (see entityClassName): normally
  // `<Name>Entity`, disambiguated when it would clash with another entity's
  // data-type name, compared as PHP does, ignoring case. The snake-cased
  // source-file name is unaffected.
  const entityColl = entityCollection(model)
  const cls = entityClassName(entity, entityColl, true)

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  const ff = Path.normalize(__dirname + '/../../../src/cmp/php/fragment/')

  // Entity files go to entity/ folder
  Folder({ name: 'entity' }, () => {

    File({ name: entity.name + '_entity.' + target.ext }, () => {

      const opnames = Object.keys(entity.op || {})

      const opfrags =
        (['load', 'list', 'create', 'update', 'patch', 'remove']
          .reduce((a: any, opname: string) =>
          (a['// #' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ? '' : ({ indent }: any) => {
              EntityOperation({ ff, opname, indent, entity, entrep })
            }, a), {}))

      // The entity's binary slots, by name; '' is its own bytes, reached with no name.
      const slots = entitySlots(entity)
      const slotDefs = Object.fromEntries(slots.map((slot: any) => [slot.name, {
        action: slot.action,
        ...(null == slot.read ? {} : { read: slot.read }),
        ...(null == slot.write ? {} : { write: slot.write }),
      }]))
      const named = slots.map((slot: any) => slot.name).filter((name: string) => '' !== name)
      const param = 0 === named.length ? '' : named.length < slots.length ? '?string $slot = null' : 'string $slot'
      const slotDoc = 0 === named.length ? '' : '     * @param ' + (named.length < slots.length ? '?' : '') +
        'string $slot One of ' + named.map((name: string) => phpString(name)).join(', ') +
        (named.length < slots.length ? ', or null for its own bytes' : '') + '.\n'

      Fragment({
        from: ff + 'Entity.fragment.php',
        replace: {
          ...entrep,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          // Class token decoupled from the EntityName data-type token in
          // Entity.fragment.php so the class can be renamed independently.
          EntyClass: cls,

          '#Entity-Hook': ({ name, indent }: any) =>
            Content({ indent }, `($utility->feature_hook)($ctx, "${name}");`),

          '// #BinaryRequire': 0 === slots.length ? '' :
            `require_once __DIR__ . '/../utility/codec/HandleCodec.php';`,

          '// #BinarySlot': 0 === slots.length ? '' : `private const BINARY_SLOTS = ${phpArray(slotDefs, '    ')};

    /**
     * An entity's bytes never enter its data: they are reached by slot.
${slotDoc}     */
    public function binary(${param}): ${model.const.Name}BinaryHandle
    {
        return new ${model.const.Name}BinaryHandle($this, self::BINARY_SLOTS${'' === param ? '' : ', $slot'});
    }`,

          ...opfrags,
        }
      })

    })
  })
})


function phpString(text: string): string {
  return "'" + text.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}


// A PHP array literal of string keys and values, for a constant table.
function phpArray(value: any, indent: string): string {
  if ('object' !== typeof value || null == value) {
    return phpString(String(value))
  }
  const keys = Object.keys(value)
  if (0 === keys.length) {
    return '[]'
  }
  return '[\n' + keys.map((key) => indent + '    ' + phpString(key) + ' => ' +
    phpArray(value[key], indent + '    ') + ',').join('\n') + '\n' + indent + ']'
}


export {
  Entity
}
