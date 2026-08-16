// GENERATING A DOCS ITEM. See docs/design/sdkgen-packages.md §20.3.
//
// A docs item is dispatched by the same convention a target is —
// `cmp/docs/<n>/Main_<n>` — so an item's package supplies the emitter and
// sdkgen supplies only the call.
//
// WHY THIS IS NOT RENDERED BY THE CONSUMER'S Root.ts
//
// A project's `Root.ts` is written once, by create-sdkgen, and is never
// touched again (doctor has an `unwired` category precisely because of it).
// So a kind introduced later can reach generation in one of two ways: every
// existing project edits its Root, or sdkgen runs the kind's own pass. The
// second is what happens here — `docs add` in a project scaffolded years ago
// generates with no scaffold change at all, which is the whole point of
// putting the destinations in packages.
//
// The cost is honest and small: a second `generate()` call over the same
// root, so the changes report arrives in two parts.

import { cmp, each, names, Folder } from 'jostraca'

import { requirePath } from '../utility'

import { ensureStdrep } from '../helpers/stdrep'

import { KIT } from '../types'


// The model preamble every pass performs before rendering: the case-variant
// name constants (`Name`, `NAME`, …) and the ProjectName replacement map that
// template substitution reads.
//
// Done HERE rather than relied upon, because a docs pass does NOT go through
// the consumer's Root — nothing else has set `ctx$.model`, and when there are
// out-of-tree items the Root was handed a FILTERED COPY, so the preamble it
// performed did not touch this object at all.
function prepareModel(model: any, ctx$: any) {
  ctx$.model = model

  model.const = model.const || { name: model.name }
  names(model.const, model.name)
  if (null == model.const.year) {
    model.const.year = new Date().getFullYear()
  }
  names(model, model.name)

  ctx$.stdrep = ctx$.stdrep || {}
  names(ctx$.stdrep, model.Name, 'Project' + 'Name')
}


// One item: its emitter, called with the item and the shared replace map.
//
// No Folder here — WHERE it lands is the caller's business, because that is
// exactly what differs between the two passes: in-tree the item owns
// `<sdk-repo>/<name>/`, out-of-tree the destination IS the item's root.
const DocsItem = cmp(function DocsItem(props: any) {
  const { item, ctx$ } = props
  const log = ctx$.log
  const model = props.model ?? ctx$.model

  const stdrep = ensureStdrep(ctx$)

  // The MODEL KEY is the fallback, and it is not paranoia: `name` comes from
  // the base schema's `name: key()`, so an item whose project has not
  // included that schema — or whose own definition omits it — reached
  // `require('cmp/docs/undefined/Main_undefined')`, a message naming nothing
  // the author wrote. Seen in the first real install of a docs package.
  const name = item.name ?? item.key$

  if (null == name || '' === name) {
    throw new Error(
      'Docs item has no name and no model key, so its component cannot be ' +
      'located: ' + JSON.stringify(Object.keys(item ?? {})))
  }

  const Main_docs = requirePath(ctx$, `cmp/docs/${name}/Main_${name}`)

  Main_docs['Main']({ model, docs: item, stdrep })

  log.info({
    point: 'generate-docs', docs: name, note: 'docs:' + name
  })
})


// Every IN-TREE docs item, each in its own folder.
//
// Items with `output: path` are excluded: they get their own pass rooted at
// that path, and rendering them here as well would ALSO write them into
// `<sdk-repo>/<name>/` — the same reason `withoutExternal` exists for
// targets.
const Docs = cmp(function Docs(props: any) {
  const { ctx$ } = props
  const model = props.model ?? ctx$.model

  prepareModel(model, ctx$)

  const items = model?.main?.[KIT]?.docs ?? {}

  each(items, (item: any) => {
    if (false === item.active) {
      return
    }

    const path = item.output?.path

    if (null != path && '' !== path) {
      return
    }

    const name = item.name ?? item.key$

    names(item, name)

    Folder({ name }, () => DocsItem({ item }))
  })
})


export {
  Docs,
  DocsItem,
  prepareModel,
}
