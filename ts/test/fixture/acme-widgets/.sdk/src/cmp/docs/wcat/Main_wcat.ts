// The docs item's emitter, dispatched as `cmp/docs/<n>/Main_<n>`.
//
// NOTE THE PATH: a docs item's trees are nested under the kind name
// (`src/cmp/docs/<n>`, not `src/cmp/<n>`) so that a docs item and a target
// may share a name without sharing a directory. The registry in
// `action/kind.ts` is the single place that composes this.
//
// A docs item receives `{ model, docs }` — the item's own model node as
// `docs`, so the same emitter can be installed twice under two names with
// different settings.

import { cmp, each, Folder, File, Content } from '@voxgig/sdkgen'


const Main = cmp(function Main(props: any) {
  const { model, docs } = props

  const kit = model.main.kit

  const targets = each(kit.target)
    .filter((t: any) => t && false !== t.active)
    .map((t: any) => t.name)
    .sort()

  const entities = each(kit.entity)
    .filter((e: any) => e && false !== e.active)
    .map((e: any) => e.name)
    .sort()

  File({ name: 'index.md' }, () => {
    Content([
      '# ' + (docs.title || docs.name),
      '',
      'API: ' + (model.name || ''),
      '',
      'Targets: ' + targets.join(', '),
      '',
    ].join('\n'))
  })

  // A page per entity — which is also what makes orphan pruning (issue #71)
  // a real problem for this kind: remove an entity from the spec and the
  // page it left behind is not cleaned up by anything.
  Folder({ name: 'entity' }, () => {
    each(entities, (name: string) => {
      File({ name: name + '.md' }, () => {
        Content('# ' + name + '\n')
      })
    })
  })
})


export {
  Main
}
