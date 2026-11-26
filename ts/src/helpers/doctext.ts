import { KIT, nom } from '@voxgig/apidef'

import { modelText } from './text'


// One text a neutral document prints. `vendor` marks text from the spec, whose
// relative links resolve against the spec's site rather than this repository.
type DocText = {
  raw: string
  vendor: boolean
  at: any
  path: string[]
}


// A struct.validate sentinel as a reader's word for it: '`$FUNCTION`' ->
// 'function'. A union renders its members, so netsim's latency reads
// 'number | map'. Anything unrecognised renders verbatim rather than being
// dropped — a doc table that silently omits an option is the failure this
// whole path exists to fix.
function sentinelName(v: any): string {
  if (Array.isArray(v)) {
    const members = v.slice(1).map((m: any) => sentinelName(m))
      .filter((m: string) => 'one' !== m)
    return 0 === members.length ? 'any' : members.join(' | ')
  }

  if ('string' !== typeof v) {
    return 'any'
  }

  const bare = v.replace(/[`$]/g, '').trim().toLowerCase()
  return '' === bare ? 'any' : bare
}


function renderValue(v: any): string {
  if (null == v) { return '' }
  if (Array.isArray(v)) { return '[' + v.map((x) => renderValue(x)).join(', ') + ']' }
  if ('object' === typeof v) {
    const keys = Object.keys(v)
    return 0 === keys.length ? '{}' :
      '{' + keys.map((k) => k + ': ' + renderValue(v[k])).join(', ') + '}'
  }
  if ('string' === typeof v) { return `'${v}'` }
  return String(v)
}


function given(value: any): boolean {
  return null != value && '' !== value
}


function str(value: any, trim = false): string {
  return !given(value) ? '' : trim ? String(value).trim() : String(value)
}


// Every text the neutral documents print from the model, as they print it,
// with the node its escaped forms are written beside.
function docTexts(model: any): DocText[] {
  const kit = model.main[KIT]
  const info = modelText(model)
  const own = kit.text || {}
  const def = model.main.def || {}
  const texts: DocText[] = []

  const add = (at: any, path: string[], raw: string, vendor: boolean) =>
    texts.push({ raw, vendor, at, path })

  const slot = (name: string, raw: string) =>
    add(kit, ['text', name], raw, !given(own[name]))

  slot('title', str(info.title))
  add(kit, ['apiName'], str(info.title) || nom(model, 'Name') + ' API',
    given(info.title) && !given(own.title))
  slot('tagline', str(info.tagline) || str(def.tagline))
  slot('summary', str(info.summary, true))
  slot('about_md', str(info.about_md, true))
  slot('website', str(info.website, true))
  slot('meta_source', str(info.meta_source, true))
  slot('docs_url', str(info.docs_url))
  add(kit, ['text', 'desc'], str(def.desc), true)
  add(kit, ['text', 'upstream'], str(info.contact?.url) || str(info.servers?.[0]?.url) ||
    str(info.homepage), true)

  for (const [name, ent] of Object.entries(kit.entity || {}) as [string, any][]) {
    add(ent, ['desc'], str(info.entity_desc[name]) || str(ent.short) || str(ent.desc),
      !given(own.entity_desc?.[name]))
    // Beside the kit, not the fields: some tests print an entity whole.
    for (const field of Object.values(ent.fields || {}) as any[]) {
      if (given(field?.sh)) {
        add(kit, ['field', name, String(field.n), 'desc'], str(field.sh), true)
      }
    }
  }

  for (const f of Object.values(kit.feature || {}) as any[]) {
    add(f, ['title'], str(f.title), false)
    const opts = f.config?.options || {}
    const spec = f.config?.optspec || {}
    for (const k of Object.keys(opts)) {
      add(f, ['option', k, 'value'], renderValue(opts[k]), false)
    }
    for (const k of Object.keys(spec).filter((k) => null == opts[k])) {
      add(f, ['option', k, 'type'], sentinelName(spec[k]), false)
    }
  }

  return texts
}


export {
  docTexts,
  renderValue,
  sentinelName,
}

export type { DocText }
