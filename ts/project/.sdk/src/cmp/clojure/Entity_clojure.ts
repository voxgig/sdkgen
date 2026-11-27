
import * as Path from 'node:path'

import {
  cmp, camelify,
  File, Folder, Fragment,
  entitySlots,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_clojure'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  const entrep = {
    ...stdrep,
  }

  const ff = Path.normalize(__dirname + '/../../../src/cmp/clojure/fragment/')

  Folder({ name: 'src' }, () => {
    Folder({ name: 'sdk' }, () => {
      Folder({ name: 'entity' }, () => {

        File({ name: entity.name + '.' + target.ext }, () => {

          const opnames = Object.keys(entity.op || {})

          // For each CRUD op: splice the real implementation when the spec
          // defines it; otherwise leave the slot empty (the fn is simply not
          // defined — callers of an unsupported op get an undefined-var error,
          // matching the dynamic-language donors).
          const opfrags =
            (['load', 'list', 'create', 'update', 'patch', 'remove']
              .reduce((a: any, opname: string) =>
              (a['; #' + camelify(opname) + 'Op'] =
                !opnames.includes(opname) ? '' : ({ indent }: any) => {
                  EntityOperation({ ff, opname, indent, entity, entrep })
                }, a), {}))

          Fragment({
            from: ff + 'Entity.fragment.clj',
            replace: {
              ...entrep,
              ProjectName: model.const.Name,
              EntityName: entity.Name,
              entityname: entity.name,

              // Feature-hook markers. jostraca's built-in `#Name-Tag` pattern
              // is hardcoded to `//` comments, so Clojure's `; #<Name>-Hook`
              // marker lines never match it and the pipeline hooks would be
              // silently dropped. Match the `;`-comment form explicitly.
              '/(?<indent>[ \\t]*);+[ \\t]*#(?<name>[A-Za-z0-9]+)-Hook[ \\t]*\\n?/':
                ({ name, indent }: any) =>
                  `${indent}(core/feature-hook ctx "${name}")\n`,

              ...opfrags,

              '; #BinarySlot': binarySlot(entity),
            }
          })

        })
      })
    })
  })
})


function binarySlot(entity: any): string {
  const slots = entitySlots(entity)
  if (0 === slots.length) {
    return ''
  }

  const table = slots.map((slot: any) => JSON.stringify(slot.name) + ' {' +
    [['action', slot.action], ['read', slot.read], ['write', slot.write]]
      .filter(([, v]) => null != v)
      .map(([k, v]) => JSON.stringify(k) + ' ' + JSON.stringify(v)).join(' ') + '}')
  const ops = [...new Set(slots.flatMap((slot: any) => [slot.read, slot.write]).filter(Boolean))]
    .sort().map((op: any) => JSON.stringify(op) + ' ' + op)
  const named = slots.map((slot: any) => slot.name).filter((name: string) => '' !== name)
  const arities = 0 === named.length ? ['([ent] (handle/handle ent BINARY-SLOTS BINARY-OPS))'] :
    [...(named.length < slots.length ? ['([ent] (handle/handle ent BINARY-SLOTS BINARY-OPS))'] : []),
      '([ent slot] (handle/handle ent BINARY-SLOTS BINARY-OPS slot))']

  return `(require '[sdk.codec.handle :as handle])

(def BINARY-SLOTS
  {${table.join('\n   ')}})

(def ^:private BINARY-OPS {${ops.join(' ')}})

(defn binary
  "An entity's bytes never enter its data: they are reached by slot${0 === named.length ? '' :
    ', one of ' + named.map((name: string) => JSON.stringify(name).replace(/"/g, '\\"')).join(', ')}."
  ${arities.join('\n  ')})
`
}


export {
  Entity
}
