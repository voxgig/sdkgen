
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

import { EntityOperation } from './EntityOperation_rb'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  // Collision-free entity CLASS name (see entityClassName): normally
  // `<Name>Entity`, disambiguated when it would clash with another entity's
  // data-type name. The snake-cased source-file name is unaffected.
  const entityColl = entityCollection(model)
  const cls = entityClassName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  // The entity's binary slots, by name; '' is its own bytes, reached with no name.
  const slots = entitySlots(entity)
  const slotDefs = Object.fromEntries(slots.map((slot: any) => [slot.name, {
    action: slot.action,
    ...(null == slot.read ? {} : { read: slot.read }),
    ...(null == slot.write ? {} : { write: slot.write }),
  }]))
  const named = slots.map((slot: any) => slot.name).filter((name: string) => '' !== name)
  const param = 0 === named.length ? '' : named.length < slots.length ? '(slot = nil)' : '(slot)'
  const slotDoc = 0 === named.length ? '' :
    '  # @param slot [String] one of ' + named.map((name: string) => JSON.stringify(name)).join(', ') +
    (named.length < slots.length ? ', or nil for its own bytes' : '') + '\n'

  const ff = Path.normalize(__dirname + '/../../../src/cmp/rb/fragment/')

  Folder({ name: 'entity' }, () => {

    File({ name: entity.name + '_entity.' + target.ext }, () => {

      const opnames = Object.keys(entity.op || {})

      const opfrags =
        (['load', 'list', 'create', 'update', 'patch', 'remove']
          .reduce((a: any, opname: string) =>
          (a['# #' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ? '' : ({ indent }: any) => {
              EntityOperation({ ff, opname, indent, entity, entrep })
            }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.rb',
        replace: {
          ...entrep,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          EntyClass: cls,

          // Feature-hook markers. jostraca's built-in `#Name-Tag` pattern is
          // hardcoded to `//` comments, so the Ruby fragment's
          // `# #<Name>-Hook` marker lines never matched it and the pipeline
          // hooks (PrePoint, PreRequest, ...) were silently dropped from the
          // generated op runner. Match the `#`-comment form explicitly.
          '/(?<indent>[ \\t]*)#[ \\t]*#(?<name>[A-Za-z0-9]+)-Hook[ \\t]*\\n?/':
            ({ name, indent }: any) =>
              `${indent}utility.feature_hook.call(ctx, "${name}")\n`,

          '# #BinaryRequire': 0 === slots.length ? '' :
            `require_relative '../utility/codec/handle_codec'`,

          '# #BinarySlot': 0 === slots.length ? '' : `BINARY_SLOTS = ${rbHash(slotDefs, '  ')}.freeze

  # An entity's bytes never enter its data: they are reached by slot.
${slotDoc}  # @return [${model.const.Name}BinaryHandle]
  def binary${param}
    ${model.const.Name}BinaryHandle.new(self, BINARY_SLOTS${'' === param ? '' : ', slot'})
  end`,

          ...opfrags,
        }
      })

    })
  })
})



function rbHash(value: any, indent: string): string {
  if ('object' !== typeof value || null == value) {
    return JSON.stringify(value)
  }
  const keys = Object.keys(value)
  if (0 === keys.length) {
    return '{}'
  }
  return '{\n' + keys.map((key) => indent + '  ' + JSON.stringify(key) + ' => ' +
    rbHash(value[key], indent + '  ') + ',').join('\n') + '\n' + indent + '}'
}


export {
  Entity
}
