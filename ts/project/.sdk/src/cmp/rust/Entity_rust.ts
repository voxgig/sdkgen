
import * as Path from 'node:path'

import {
  cmp, camelify,
  File, Content, Folder, Fragment,
  entityClassName, entityCollection, entitySlots,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_rust'
import { rustVarName } from './utility_rust'


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

  const ff = Path.normalize(__dirname + '/../../../src/cmp/rust/fragment/')

  Folder({ name: 'entity' }, () => {

    File({ name: rustVarName(entity.name) + '.' + target.ext }, () => {

      const opnames = Object.keys(entity.op || {})

      const opfrags =
        (['load', 'list', 'create', 'update', 'patch', 'remove']
          .reduce((a: any, opname: string) =>
          (a['#' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ?
              ({ indent }: any) => {
                const arg = ('create' === opname || 'update' === opname || 'patch' === opname) ?
                  'reqdata' : 'reqmatch'
                // The stub mirrors the real signature: ops resolve to the
                // ENTITY (`list` to a vector of them), so an unsupported op
                // has to declare the same return type to satisfy the trait.
                const ret = 'list' === opname ? 'Vec<Rc<Self>>' : 'Rc<Self>'
                const sig = 'list' === opname || 'remove' === opname ?
                  `fn ${opname}(self: &Rc<Self>, _${arg}: Value, _ctrl: Value)` :
                  `fn ${opname}_with(self: &Rc<Self>, _${arg}: Value, _ctrl: Value, _opwith: OpWith)`
                Content({ indent }, `${sig} -> Result<${ret}, ${model.const.Name}Error> {
    Err(crate::core::helpers::unsupported_op("${opname}", &self.name))
}
`)
              } :
              ({ indent }: any) => {
                EntityOperation({ ff, opname, indent, entity, entrep, cls })
              }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.rs',
        replace: {
          ...entrep,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          EntyClass: cls,

          // Matches every `// #<Stage>-Hook` marker in the fragment (all of
          // them sit inside run_op, where `ctx` is the operation context).
          '#Entity-Hook': ({ name, indent }: any) =>
            Content({ indent }, `self.utility.feature_hook(ctx, "${name}");`),

          ...opfrags,
        }
      })

      BinarySlots({ entity, cls })

    })
  })
})



// Rust has no optional argument: a lone unnamed slot takes none, else `binary("")`.
const BinarySlots = cmp(function BinarySlots(props: any) {
  const { entity, cls } = props
  const slots = entitySlots(entity)
  if (0 === slots.length) {
    return
  }

  const opt = (v?: string) => null == v ? 'None' : 'Some("' + v + '")'
  const rows = slots.map((s: any) =>
    `    BinarySlot { name: ${JSON.stringify(s.name)}, action: ${JSON.stringify(s.action)}, ` +
    `read: ${opt(s.read)}, write: ${opt(s.write)} },`).join('\n')
  const only = 1 === slots.length && '' === slots[0].name

  Content(`

use crate::utility::codec::handle::{BinaryHandle, BinarySlot};

pub const BINARY_SLOTS: &[BinarySlot] = &[
${rows}
];

impl ${cls} {
    pub fn binary(self: &Rc<Self>${only ? '' : ', slot: &str'}) -> BinaryHandle<Self> {
        BinaryHandle::new(self.clone(), BINARY_SLOTS, ${only ? '""' : 'slot'})
    }
}
`)
})


export {
  Entity
}
