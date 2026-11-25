import Fs from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'
import { each, names, Project, Folder, File, Content } from 'jostraca'

import {
  SdkGen, cmp, fact, featureApplies, Main, Readme, AgentGuide, ReadmeTop, AgentGuideTop, Security,
  Changelog,
} from '../dist/sdkgen.js'
import {
  FENCES, mention, linkFindings, markerFindings, fenceFindings, offFindings,
} from '../dist/helpers/textguard.js'
import type { GuardFinding } from '../dist/helpers/textguard.js'
import { REQUIRED_FEATURE } from '../dist/helpers/targetguard.js'

import {
  API_MODEL, KIT, STAGE, SCAFFOLD, makeModel, makeRoot, layeredFs, makeLog,
} from './generateharness'


// The text guard: the documentation under single-switch variations of the
// model, read for unresolved links (`link`), lines naming what the run removed
// (`off`), siblings reading different facts (`parity`), a fix that reached one
// sibling only (`reaction`), unfired markers (`marker`), features said to start
// off that start on (`starts-off`) and foreign code (`fence`).


type Line = { text: string, chain: string }

type Run = {
  id: string
  files: Record<string, string>
  lines: Record<string, Line[]>
  present: Set<string>
  reads?: Record<string, Set<string>>
  on: Record<string, boolean>
  applies: Record<string, string[]>
}

type Subject = { kind: 'target' | 'feature' | 'entity' | 'op', key: string, words: RegExp[] }

type Variation = {
  id: string
  family: string
  targets: string[]
  features: string[]
  extra: string
  subject?: Subject
}

type Finding = {
  relation: string
  chain: string
  cause: string
  doc: string
  line: string
  variation: string
}

type Pin = {
  relation: string
  chain: string
  cause: string
  reason: string
  line: string
  variations: string[]
}


const MODEL_DIR = Path.join(SCAFFOLD, 'model')

const listed = (dir: string): string[] =>
  Fs.readdirSync(Path.join(MODEL_DIR, dir))
    .filter((f: string) => f.endsWith('.aontu') && !f.endsWith('-index.aontu'))
    .map((f: string) => f.replace(/\.aontu$/, '')).sort()

const TARGETS = listed('target')
const FEATURES = listed('feature')

const AUTH = {
  off: '',
  bearer: "main: kit: config: auth: { active: true, prefix: 'Bearer', in: 'header', name: 'Authorization' }",
  basic: "main: kit: config: auth: { active: true, prefix: 'Basic', basic: true, in: 'header', name: 'Authorization' }",
  'basic-query': "main: kit: config: auth: { active: true, prefix: 'Basic', basic: true, in: 'query', name: 'api_key' }",
}

const SERVER = {
  mixed: "main: kit: info: servers: [{ url: 'https://{tenant}.example.test/{region}', variables: { tenant: { default: '' }, region: { default: 'eu' } } }]",
  plain: "main: kit: info: servers: [{ url: 'https://api.example.test' }]",
  defaulted: "main: kit: info: servers: [{ url: 'https://{tenant}.example.test/{region}', variables: { tenant: { default: 'acme' }, region: { default: 'eu' } } }]",
  required: "main: kit: info: servers: [{ url: 'https://{tenant}.example.test/{region}', variables: { tenant: { default: '' }, region: { default: '' } } }]",
}


// The fixture names entities `console`, `record` and `utility` to collide
// with generated code; they collide with a mention scan too, so every entity
// name, with its routes and flows, becomes an opaque token.
const ENTITIES: string[] = Object.keys(makeModel([], undefined, '', []).main[KIT].entity).sort()

const TOKEN: Record<string, string> = Object.fromEntries(ENTITIES.map((e: string, i: number) =>
  [e, 'zq' + String.fromCharCode(97 + i)]))

const pascal = (s: string): string =>
  s.split('_').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join('')

function overlay(src: string): string {
  let out = src
  for (const e of ENTITIES) {
    out = out.replace(new RegExp('(?<![A-Z0-9])' + pascal(e) + '(?![a-z0-9])', 'g'), pascal(TOKEN[e]))
    out = out.replace(new RegExp('(?<![A-Za-z0-9])' + e + '(?![a-z0-9])', 'g'), TOKEN[e])
  }
  return out
}

const API = overlay(API_MODEL)

// The SDK targets, which share one document layout; a consumer switches
// every phase off and is a different product.
const SDK_TARGETS: string[] = (() => {
  const model = makeModel(TARGETS, undefined, '', [], 'target', API)
  return TARGETS.filter((t: string) =>
    !Object.values(fact(model.main[KIT].target[t], 'phase')).every((on: any) => false === on))
})()

const ENTITY_OPS: Record<string, string[]> = Object.fromEntries(
  Object.entries(makeModel([], undefined, '', [], 'target', API).main[KIT].entity)
    .map(([k, v]: [string, any]) => [k, Object.keys(v.op || {}).sort()]))


const word = mention


function targetWords(name: string, model: any): RegExp[] {
  const t = model.main[KIT].target[name] || {}
  const out = [word('`' + name + '`'), word(name + '/')]
  if ('string' === typeof t.title && '' !== t.title) out.push(word(t.title))
  return out
}

function featureWords(name: string, model: any): RegExp[] {
  const f = model.main[KIT].feature[name] || {}
  const out = [word('`' + name + '`'), word(pascal(name) + 'Feature')]
  if ('string' === typeof f.title && '' !== f.title) out.push(word(f.title))
  return out
}

function entityWords(key: string): RegExp[] {
  return [new RegExp('(?<![A-Za-z0-9])(' + key + '|' + pascal(key) + ')(?![a-z0-9])')]
}


function baseline(): Variation {
  return {
    id: 'baseline', family: 'baseline', targets: TARGETS, features: FEATURES,
    extra: AUTH.bearer + '\n' + SERVER.mixed,
  }
}


// Consumers switch every phase off and wrap the target their name begins with.
function consumers(model: any): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of Object.keys(model.main[KIT].target).sort()) {
    const phase = fact(model.main[KIT].target[name], 'phase')
    if (Object.values(phase).every((on: any) => false === on)) {
      const wrapped = TARGETS.find((t: string) => name.startsWith(t + '-'))
      if (null != wrapped) out[name] = wrapped
    }
  }
  return out
}


// Every variation is derived from the compiled baseline; none is listed by
// hand. Unification cannot remove, so a removal edits the model source.
function variations(): Variation[] {
  const base = baseline()
  const model = makeModel(base.targets, undefined, base.extra, base.features, 'target', API)
  const wraps = consumers(model)
  const sdk = TARGETS.filter((t: string) => null == wraps[t])
  const lead = sdk.includes('ts') ? 'ts' : sdk[0]
  const out: Variation[] = [base]
  const with_ = (id: string, family: string, over: Partial<Variation>) =>
    out.push({ ...base, id, family, ...over })

  for (const t of TARGETS) {
    const gone = [t, ...Object.keys(wraps).filter((c: string) => wraps[c] === t)]
    with_('target-' + t, 'target', {
      targets: TARGETS.filter((x: string) => !gone.includes(x)),
      subject: { kind: 'target', key: t, words: targetWords(t, model) },
    })
  }
  // Generation refuses a model without the required feature, so every
  // sentence about it is true by construction and no variation removes it.
  const optional = FEATURES.filter((f: string) => REQUIRED_FEATURE !== f)
  const required = FEATURES.filter((f: string) => REQUIRED_FEATURE === f)
  for (const f of optional) {
    with_('feature-' + f, 'feature', {
      features: FEATURES.filter((x: string) => x !== f),
      subject: { kind: 'feature', key: f, words: featureWords(f, model) },
    })
  }
  for (const e of ENTITIES) {
    const tok = TOKEN[e]
    with_('entity-' + tok, 'entity', {
      extra: base.extra + `\nmain: kit: entity: ${tok}: active: false`,
      subject: { kind: 'entity', key: tok, words: entityWords(tok) },
    })
    for (const op of ENTITY_OPS[tok] || []) {
      with_('op-' + tok + '-' + op, 'op', {
        extra: base.extra + `\nmain: kit: entity: ${tok}: op: ${op}: active: false`,
        subject: { kind: 'op', key: tok + '.' + op, words: [] },
      })
    }
  }

  with_('targets-empty', 'empty', { targets: [] })
  with_('targets-lone', 'lone', { targets: [lead] })
  with_('features-empty', 'empty', { features: required })
  with_('features-lone', 'lone', { features: [optional[0], ...required] })
  with_('entities-empty', 'empty', {
    extra: base.extra + ENTITIES.map((e: string) => `\nmain: kit: entity: ${TOKEN[e]}: active: false`).join(''),
  })
  with_('entities-lone', 'lone', {
    extra: base.extra + ENTITIES.slice(1).map((e: string) => `\nmain: kit: entity: ${TOKEN[e]}: active: false`).join(''),
  })

  for (const [id, auth] of Object.entries(AUTH)) {
    if ('bearer' !== id) with_('auth-' + id, 'auth', { extra: auth + '\n' + SERVER.mixed })
  }
  for (const [id, server] of Object.entries(SERVER)) {
    if ('mixed' !== id) with_('server-' + id, 'server', { extra: AUTH.bearer + '\n' + server })
  }

  with_('phase-top-off', 'phase', { extra: base.extra + '\nmain: kit: phase: top: active: false' })
  with_('phase-build-off', 'phase', { extra: base.extra + '\nmain: kit: phase: build: active: false' })
  for (const phase of ['readme', 'agentguide']) {
    with_('phase-' + phase + '-off-' + lead, 'phase', {
      extra: base.extra + `\nmain: kit: target: ${lead}: phase: ${phase}: active: false`,
    })
  }
  with_('root-' + lead, 'placement', {
    targets: [lead],
    extra: base.extra + `\nmain: kit: phase: top: active: false\nmain: kit: target: ${lead}: output: root: true`,
  })
  for (const away of [Object.keys(wraps)[0], lead].filter((t) => null != t)) {
    with_('external-' + away, 'placement', {
      extra: base.extra + `\nmain: kit: target: '${away}': output: ` +
        `{ path: '../elsewhere/${away}', repo: 'acme/${away}', sdkrel: '../sdk' }`,
    })
  }

  return out
}


// A Root that writes only documents, reading the root-plan facts: root
// documents when the top phase is on, inactive targets skipped, consumers
// through their Main, which is where their documents come from.
function docsRoot(holder: { node?: any }, control?: () => void): any {
  return cmp(function Root(props: any) {
    const { model, ctx$ } = props
    holder.node = ctx$.node

    model.const = { name: model.name }
    names(model.const, model.name)
    model.const.year = 2026
    names(model, model.name)
    ctx$.model = model
    ctx$.stdrep = {}
    names(ctx$.stdrep, model.Name, 'ProjectName')

    // The entity and feature phases derive these names before Readme runs, so
    // the documents match the full Root's whichever phases are on.
    const kit = model.main[KIT]
    each(kit.entity).filter((e: any) => false !== e.active).map((e: any) => names(e, e.name))
    each(kit.feature).filter((f: any) => f.active).map((f: any) => names(f, f.name))

    Project({}, () => {
      if (fact(kit, 'top')) {
        ReadmeTop({})
        AgentGuideTop({})
        Security({})
        Changelog({})
      }
      each(kit.target).filter((t: any) => false !== t.active).map((target: any) => {
        names(target, target.name)
        const phase = fact(target, 'phase')
        const docs = () => {
          if (!phase.readme && !phase.agentguide) {
            Main({ target })
            return
          }
          if (phase.readme) Readme({ target })
          if (phase.agentguide) AgentGuide({ target })
        }
        if ('root' === fact(target, 'place')) docs()
        else Folder({ name: target.name }, docs)
      })
      if (control) control()
    })
  })
}


// Each document's lines, with the chain of labelled components that wrote
// them; a document no content node wrote is attributed to its file.
function attribute(root: any, files: Record<string, string>): Record<string, Line[]> {
  const segs: Record<string, { text: string, chain: string }[]> = {}
  const walk = (node: any, chain: string[], file: string | null) => {
    const label = node?.meta?.cmp
    const c = null != label && label !== chain[chain.length - 1] ? chain.concat(label) : chain
    let f = file
    if ('file' === node.kind) {
      const path: string = node.path.join('/')
      segs[path] = []
      f = path
    }
    else if ('content' === node.kind && null != f) {
      segs[f].push({ text: null == node.content ? '' : String(node.content), chain: c.slice(1).join(' > ') })
    }
    for (const child of node.children || []) walk(child, c, f)
  }
  walk(root, [], null)

  const out: Record<string, Line[]> = {}
  for (const [path, text] of Object.entries(files)) {
    const parts = segs[path]
    const rebuilt = null == parts ? null : parts.map((s) => s.text).join('')
    if (null == parts || rebuilt !== text) {
      out[path] = text.split('\n').map((t: string) => ({ text: t, chain: 'file:' + path }))
      continue
    }
    const lines: Line[] = []
    let current = ''
    let chain = parts.length ? parts[0].chain : ''
    let started = false
    for (const part of parts) {
      for (const ch of part.text) {
        if (!started && '\n' !== ch) {
          chain = part.chain
          started = true
        }
        if ('\n' === ch) {
          lines.push({ text: current, chain: started ? chain : part.chain })
          current = ''
          started = false
        }
        else {
          current += ch
        }
      }
    }
    if ('' !== current) lines.push({ text: current, chain })
    out[path] = lines
  }
  return out
}


// Model reads, attributed to the labelled component being built and the
// target directory it writes under.
function recording(model: any, reads: Record<string, Set<string>>): any {
  const cache = new WeakMap<object, any>()
  const wrap = (obj: any, path: string): any => {
    if (null == obj || 'object' !== typeof obj) return obj
    const hit = cache.get(obj)
    if (hit) return hit.proxy
    const proxy = new Proxy(obj, {
      get(target: any, prop: any, recv: any) {
        const val = Reflect.get(target, prop, recv)
        if ('symbol' === typeof prop || 'function' === typeof val) return val
        const p = '' === path ? String(prop) : path + '.' + String(prop)
        const node = (global as any).jostraca?.getStore?.()?.node
        const label = node?.meta?.cmp
        if (null != label && Array.isArray(node.path) && 0 < node.path.length) {
          const key = label + '@' + node.path[0]
          ;(reads[key] = reads[key] || new Set()).add(p)
        }
        return wrap(val, p)
      },
    })
    cache.set(obj, { proxy })
    return proxy
  }
  return wrap(model, '')
}


function compile(v: Variation): any {
  return makeModel(v.targets, undefined, v.extra, v.features, 'target', API)
}


async function run(v: Variation, root: any, model: any): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})
  const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
  const cwd = process.cwd()
  process.chdir(SCAFFOLD)
  try {
    const res = await sdkgen.generate({ model, root })
    if (true !== res.ok) throw new Error(v.id + ': generation did not report ok')
  }
  finally {
    process.chdir(cwd)
  }

  const files: Record<string, string> = {}
  for (const [p, c] of Object.entries(vol.toJSON() as Record<string, string>)) {
    const rel = Path.relative(STAGE, p).split(Path.sep).join('/')
    if (null == c || rel.includes('.jostraca/') || rel.startsWith('.sdk/') || rel.startsWith('../')) continue
    files[rel] = c
  }
  return files
}


// A link resolves against everything the full Root writes for the variation,
// where each Main placed its templates, not where the scaffold keeps them.
const written = new Map<string, Set<string>>()

async function writtenPaths(v: Variation): Promise<Set<string>> {
  if (!written.has(v.id)) {
    written.set(v.id, new Set(Object.keys(await run(v, makeRoot(), compile(v)))))
  }
  return written.get(v.id) as Set<string>
}


async function generateDocs(
  v: Variation, opts: { control?: () => void, reads?: boolean, root?: any } = {},
): Promise<Run> {
  const holder: { node?: any } = {}
  const reads: Record<string, Set<string>> = {}
  const compiled = compile(v)
  const model = opts.reads ? recording(compiled, reads) : compiled
  const files = await run(v, opts.root ?? docsRoot(holder, opts.control), model)

  const present = new Set<string>(Object.keys(files))
  if (null == opts.root) for (const p of await writtenPaths(v)) present.add(p)
  return {
    id: v.id, files, present, ...featureState(compiled),
    lines: null == holder.node ? {} : attribute(holder.node, Object.fromEntries(
      Object.entries(files).filter(([p]: [string, string]) => p.endsWith('.md')))),
    reads: opts.reads ? reads : undefined,
  }
}


// Each active feature's default, and which of them each target carries.
function featureState(model: any): { on: Record<string, boolean>, applies: Record<string, string[]> } {
  const kit = model.main[KIT]
  const active = Object.values(kit.feature || {})
    .filter((f: any) => false !== f.active && 'base' !== f.name) as any[]
  return {
    on: Object.fromEntries(active.map((f: any) => [f.name, true === fact(f, 'on')])),
    applies: Object.fromEntries(Object.entries(kit.target || {}).map(([name, t]: [string, any]) =>
      [name, active.filter((f: any) => featureApplies(f, t)).map((f: any) => f.name)])),
  }
}


const tagged = (run: Run, found: GuardFinding[]): Finding[] =>
  found.map((f: GuardFinding) => ({ ...f, variation: run.id }))

function link(run: Run): Finding[] {
  return tagged(run, linkFindings(run.lines, run.files, run.present))
}


function off(run: Run, subject: Subject): Finding[] {
  return tagged(run, offFindings(run.lines, subject.words.map((w: RegExp) => [subject.kind, w])))
}


function marker(run: Run): Finding[] {
  return tagged(run, markerFindings(run.lines))
}


function codeFences(run: Run): Finding[] {
  return tagged(run, fenceFindings(run.lines, FENCES))
}


// Siblings are the same document under different SDK target directories.
function siblings(run: Run): Record<string, string[]> {
  const groups: Record<string, string[]> = {}
  for (const doc of Object.keys(run.lines)) {
    const i = doc.indexOf('/')
    if (i < 0 || !SDK_TARGETS.includes(doc.slice(0, i))) continue
    const rest = doc.slice(i + 1)
    ;(groups[rest] = groups[rest] || []).push(doc)
  }
  return groups
}


// Prose a reader acts on: outside code, not a heading, and a sentence rather
// than a fragment.
function prose(lines: Line[]): Line[] {
  const out: Line[] = []
  let fence = false
  for (const l of lines) {
    if (/^\s*(```|~~~)/.test(l.text)) {
      fence = !fence
      continue
    }
    if (fence || /^\s*#/.test(l.text) || l.chain.startsWith('file:')) continue
    if ((l.text.match(/[A-Za-z]{2,}/g) || []).length < 4) continue
    out.push(l)
  }
  return out
}


function reaction(base: Run, run: Run, family: string): Finding[] {
  const out: Finding[] = []
  const lineSet = (r: Run, doc: string) => new Set(prose(r.lines[doc] || []).map((l: Line) => l.text))
  for (const docs of Object.values(siblings(run))) {
    if (docs.length < 2) continue
    const gone = new Set<string>()
    for (const doc of docs) {
      const now = lineSet(run, doc)
      for (const l of prose(base.lines[doc] || [])) {
        if (!now.has(l.text)) gone.add(l.text)
      }
    }
    if (0 === gone.size) continue
    for (const doc of docs) {
      for (const { text, chain } of prose(run.lines[doc] || [])) {
        if (gone.has(text)) {
          out.push({ relation: 'reaction', chain, cause: family, doc, line: text, variation: run.id })
        }
      }
    }
  }
  return out
}


// The facts a section reads that one sibling reads and another does not.
const FACT_ROOTS: [string, RegExp][] = [
  ['auth', /^main\.kit\.config\.auth(\.|$)/],
  ['servers', /^main\.kit\.info\.servers(\.|$)/],
]

function parity(run: Run): Finding[] {
  const out: Finding[] = []
  if (null == run.reads) return out
  const bySection: Record<string, Record<string, Set<string>>> = {}
  for (const [key, paths] of Object.entries(run.reads)) {
    const [label, dir] = key.split('@')
    if (!SDK_TARGETS.includes(dir)) continue
    const roots = new Set<string>()
    for (const p of paths) for (const [name, re] of FACT_ROOTS) if (re.test(p)) roots.add(name)
    ;(bySection[label] = bySection[label] || {})[dir] = roots
  }
  for (const [label, dirs] of Object.entries(bySection)) {
    const members = Object.keys(dirs).sort()
    if (members.length < 2) continue
    for (const [name] of FACT_ROOTS) {
      const readers = members.filter((d: string) => dirs[d].has(name))
      if (0 === readers.length || readers.length === members.length) continue
      for (const d of members.filter((m: string) => !dirs[m].has(name))) {
        out.push({ relation: 'parity', chain: label + '@' + d, cause: name, doc: d, line: '', variation: run.id })
      }
    }
  }
  return out
}


// A sentence saying features start off covers those it names; with `other`
// or `rest`, every feature but those the paragraph names as on; else those its
// heading names; else every feature the document's target carries. It counts
// only where it, or its heading, is about features.
const STARTS_OFF = /inactive until|inactive by default|off by default|opt-in/i
const OTHERS = /\b(other|others|rest)\b/i
const FEATURE_WORD = /\bfeatures?\b/i

function startsOff(run: Run): Finding[] {
  const out: Finding[] = []
  for (const [doc, lines] of Object.entries(run.lines)) {
    const all = run.applies[doc.split('/')[0]] ?? Object.keys(run.on)
    const named = (text: string): string[] => all.filter((f: string) => text.includes('`' + f + '`'))
    let heading = { names: [] as string[], about: false }
    let para: Line[] = []

    const flush = () => {
      const parts = para.map((l: Line) => l.text.replace(/^\s*>\s?/, ''))
      const text = parts.join(' ')
      const ends: number[] = []
      for (const part of parts) ends.push((ends[ends.length - 1] ?? -1) + part.length + 1)
      let from = 0
      for (const s of text.split(/(?<=[.!?])\s+/)) {
        const start = text.indexOf(s, from)
        from = start + s.length
        if (!STARTS_OFF.test(s) || !(FEATURE_WORD.test(s) || 0 < named(s).length || heading.about)) {
          continue
        }
        const covered = OTHERS.test(s) ?
          all.filter((f: string) => !(run.on[f] && named(text).includes(f))) :
          0 < named(s).length ? named(s) :
            0 < heading.names.length ? heading.names : all
        const bad = covered.filter((f: string) => run.on[f]).sort()
        if (0 === bad.length) continue
        const at = start + s.search(STARTS_OFF)
        const line = para[ends.findIndex((e: number) => at < e)] ?? para[0]
        out.push({ relation: 'starts-off', chain: line.chain, cause: bad.join(','), doc,
          line: line.text, variation: run.id })
      }
      para = []
    }

    let fence = false
    for (const l of lines) {
      const bare = l.text.replace(/^\s*>\s?/, '').trim()
      if (/^(```|~~~)/.test(bare)) {
        flush()
        fence = !fence
        continue
      }
      if (fence) continue
      const h = /^#{1,6}\s+(.*)$/.exec(l.text)
      if (h || '' === bare || bare.startsWith('|')) flush()
      if (h) {
        const names = all.filter((f: string) => new RegExp('(?<![\\w-])' + f + '(?![\\w-])', 'i').test(h[1]))
        heading = { names, about: 0 < names.length || FEATURE_WORD.test(h[1]) }
      }
      else if ('' !== bare) {
        para.push(l)
        if (bare.startsWith('|')) flush()
      }
    }
    flush()
  }
  return out
}


// A test-only component: a stale sentence, a dangling link and an unfired
// marker, each of which the guard must report.
function negativeControl(feature: string): () => void {
  return cmp(function GuardControl() {
    File({ name: 'GUARD.md' }, () => {
      Content({ raw: true, arg: 'The `' + feature + '` feature is on.\n' +
        'See [the missing page](missing.md).\n' +
        'An unfired $$model.nothing$$ marker.\n' })
    })
  }) as any
}


function key(f: { relation: string, chain: string, cause: string }): string {
  return f.relation + '|' + f.chain + '|' + f.cause
}


export type {
  Finding,
  Pin,
  Run,
  Subject,
  Variation,
}

export {
  TARGETS,
  FEATURES,
  TOKEN,
  baseline,
  variations,
  generateDocs,
  link,
  off,
  marker,
  codeFences,
  reaction,
  parity,
  startsOff,
  negativeControl,
  key,
}
