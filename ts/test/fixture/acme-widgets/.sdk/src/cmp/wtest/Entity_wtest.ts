// `wtest`'s per-entity emitter, dispatched as `cmp/<t>/Entity_<t>`.
//
// One file per ACTIVE entity — the neutral `Entity` component is only called
// for entities the Root's filtered view kept, so this never has to filter
// again. It writes the entity's field names and operations so that a test can
// distinguish "a file exists for this entity" from "the file describes this
// entity".

import { cmp, each, Folder, File, Content } from '@voxgig/sdkgen'


const Entity = cmp(function Entity(props: any) {
  const { target, entity } = props

  const fields = each(entity.field)
    .map((f: any) => f.name)
    .sort()

  const ops = each(entity.op || {})
    .map((o: any) => o.name)
    .sort()

  Folder({ name: 'entity' }, () => {
    File({ name: entity.name + '.' + target.ext }, () => {
      Content([
        '# entity ' + entity.name,
        'fields ' + fields.join(' '),
        'ops ' + ops.join(' '),
        '',
      ].join('\n'))
    })
  })
})


export {
  Entity
}
