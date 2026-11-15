// A language's declared facts, read from its compiled provider in a clone,
// and the masking that turns a unit into the shared sentence it instantiates.
//
// Facts: every string leaf of `Syntax.facts` and `Syntax.ref.facts`, plus the
// names the naming hook gives through the description (`layout.*`), computed
// on the harness's baseline model with the clone's own sdkDescription.
//
// Masking is strict. A fact value is replaced by a label naming EVERY path at
// which this language declares that value (`⟦ref.none⟧`,
// `⟦container|direct.returns|recordType|...⟧`), so two languages' units match
// only when the same slots hold their own values. Where a value may stand:
//   - a whole code span whose content IS the value (a `{Class}`-style
//     placeholder in the value matches one identifier; an operation's method
//     may carry the `()` its `named` fact prints); never part of a span;
//   - outside code spans, only (a) a fragment value (one holding a backtick,
//     a space or a leading `.`), matched as the whole phrase, and (b) a
//     single word at a slot shared code prints unquoted (PROSE_SLOTS, read
//     from ReadmeRef.ts and runtimeprose.ts), matched as a whole,
//     case-sensitive word;
//   - in a code comment, a value with a non-letter character in it
//     (`.ok`, `data_get`, `Data()`), as a whole token.
// So a short token (`nil`, `sdk`, `list`, `err`) is masked only where it is a
// whole code span; the English word "list" in a sentence is never touched.
// Enumerations (which sentence to print, never printed themselves) are not
// masked at all: ENUM_PATHS.
const Fs = require('node:fs')
const Path = require('node:path')
const C = require('./cut.js')

const ENUM_PATHS = /^(named|async|result|prints|unusedError|ref\.(entityBy|keys|cancel|prepare\.fails)|ref\.(client|entity|test)\.\d+\.(kind|args)|.*\.kind)$/
const PROSE_SLOTS = new Set(['collection', 'ref.noun', 'ref.entityNoun', 'ref.maps'])
// The client's heading (`## {module}`): masked only as a whole heading unit.
const HEADING_SLOTS = new Set(['ref.heading'])

// A provider's facts may be replaced for a control (selftest's fact
// mutations): TOOLS_SYNTAX_OVERRIDE names a JSON file mapping a language to a
// JSON file holding { facts, ref: { facts, notes }, notes }, as a mutated
// provider declared them. Nothing else reads it.
function overrideOf(lang) {
  const f = process.env.TOOLS_SYNTAX_OVERRIDE
  if (!f) return null
  const m = JSON.parse(Fs.readFileSync(f, 'utf8'))
  return m[lang] ? JSON.parse(Fs.readFileSync(Path.resolve(Path.dirname(f), m[lang]), 'utf8')) : null
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const CACHE = new Map()

// The description's layout for `lang`, from the clone (its own Naming hook).
function layoutOf(ts, lang) {
  const nf = Path.join(ts, 'dist-test-scaffold/.sdk/dist/cmp', lang, 'Naming_' + lang + '.js')
  if (!Fs.existsSync(nf)) return {}
  const prev = process.env.SDKGEN_TS
  process.env.SDKGEN_TS = ts
  const L = require('./gen/lib2.js')
  if (L.TS !== ts) throw new Error('facts.js: one clone per process (' + L.TS + ' already loaded)')
  const { variations } = require('./gen/variations.js')
  const feats = Fs.readdirSync(Path.join(L.H.SCAFFOLD, 'model', 'feature')).filter((f) => f.endsWith('.aontu') && 'feature-index.aontu' !== f).map((f) => f.replace(/\.aontu$/, '')).sort()
  const cwd = process.cwd()
  process.chdir(L.H.SCAFFOLD)
  try {
    const B = variations(L.H, feats).find((v) => 'B' === v.id)
    const model = L.makeModel(B.spec)
    const { names } = require(Path.join(ts, 'node_modules', 'jostraca'))
    model.const = { name: model.name }; names(model.const, model.name); names(model, model.name)
    for (const e of Object.values(model.main.kit.entity)) names(e, e.name)
    const D = require(Path.join(ts, 'dist/helpers/sdkdesc.js'))
    const d = D.sdkDescription(model, { name: lang }, require(nf).Naming)
    const out = {}
    for (const [k, v] of Object.entries(d.layout || {})) {
      if ('string' === typeof v) out[k] = v
      else if (v && 'object' === typeof v && 'vars' !== k) for (const [k2, v2] of Object.entries(v)) if ('string' === typeof v2) out[k + '.' + k2] = v2
    }
    return out
  } finally { process.chdir(cwd); if (null == prev) delete process.env.SDKGEN_TS; else process.env.SDKGEN_TS = prev }
}

// Every declared fact of `lang`: [{ path, value }], and the provider's notes.
function load(ts, lang) {
  const key = ts + '\0' + lang + '\0' + (process.env.TOOLS_SYNTAX_OVERRIDE || '')
  if (CACHE.has(key)) return CACHE.get(key)
  const sf = Path.join(ts, 'dist-test-scaffold/.sdk/dist/cmp', lang, 'Syntax_' + lang + '.js')
  const res = { lang, provider: Fs.existsSync(sf) ? sf : null, facts: [], layout: {}, notes: {} }
  const over = overrideOf(lang)
  if (over) res.override = process.env.TOOLS_SYNTAX_OVERRIDE
  if (res.provider) {
    const S = over || require(sf).Syntax
    const walk = (x, p) => {
      if ('string' === typeof x) { if ('' !== x.trim()) res.facts.push({ path: p, value: x }) }
      else if (Array.isArray(x)) x.forEach((v, i) => walk(v, p + '.' + i))
      else if (x && 'object' === typeof x) for (const [k, v] of Object.entries(x)) walk(v, p ? p + '.' + k : k)
    }
    walk(S.facts, '')
    if (S.ref) walk(S.ref.facts, 'ref')
    res.notes = { ...(S.notes || {}), ...((S.ref && S.ref.notes) || {}) }
    res.layout = layoutOf(ts, lang)
    for (const [k, v] of Object.entries(res.layout)) res.facts.push({ path: 'layout.' + k, value: v })
  }
  CACHE.set(key, res)
  return res
}

// A value as a pattern: layout placeholders filled, any other `{x}` one identifier.
function pattern(value, layout) {
  return esc(value).replace(/\\\{(\w+)\\\}/g, (_m, k) => null != layout[k] ? esc(layout[k]) : '[A-Za-z_][\\w.:/<>-]*')
}

// The masker for one language: a function of a unit's text and kind.
function masker(F, roots) {
  const byValue = new Map()
  for (const f of F.facts) {
    if (ENUM_PATHS.test(f.path)) continue
    if (!byValue.has(f.value)) byValue.set(f.value, new Set())
    byValue.get(f.value).add(f.path)
  }
  const entries = [...byValue.entries()].map(([value, paths]) => ({
    value, paths: [...paths].sort(), label: '⟦' + [...paths].sort().join('|') + '⟧',
    // an operation's method may carry the call parentheses its `named` fact asks for
    whole: new RegExp('^' + pattern(value, F.layout) + ([...paths].every((p) => /^method\./.test(p)) ? '(\\(\\))?' : '') + '$'),
    fragment: value.length >= 6 && /[`\s]|^\./.test(value),
    prose: [...paths].some((p) => PROSE_SLOTS.has(p)) && /^[A-Za-z]+$/.test(value),
    heading: [...paths].some((p) => HEADING_SLOTS.has(p)) ? new RegExp('^' + pattern(value, F.layout) + '$') : null,
    codeish: /[^A-Za-z]/.test(value) && value.length >= 3 && !/\s/.test(value),
  })).sort((a, b) => b.value.length - a.value.length)
  const model = C.masker(roots, F.lang, { numbers: false })
  const spanMask = (content) => {
    const hit = entries.filter((e) => e.whole.test(content))
    if (!hit.length) return null
    return '⟦' + [...new Set(hit.flatMap((e) => e.paths))].sort().join('|') + '⟧'
  }
  // labels are kept out of the model masker (`⟦recordType⟧` holds an entity name)
  const finish = (t) => {
    const keep = []
    const u = t.replace(/⟦[^⟧]*⟧/g, (m) => { keep.push(m); return '\u0001' + (keep.length - 1) + '\u0001' })
    return model(u).replace(/\u0001(\d+)\u0001/g, (_m, i) => keep[+i])
  }
  return (text, kind) => {
    let t = String(text)
    if ('heading' === kind) { const h = entries.find((e) => e.heading && e.heading.test(t)); if (h) return h.label }
    // fragments first: they may hold code spans of their own
    for (const e of entries) if (e.fragment) t = t.split(e.value).join(e.label)
    if ('comment' === kind) {
      for (const e of entries) if (e.codeish) t = t.replace(new RegExp('(?<![\\w$])' + pattern(e.value, F.layout) + '(?![\\w$])', 'g'), e.label)
      return finish(t)
    }
    const parts = t.split(/(`[^`]*`)/)
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (/^`[^`]*`$/.test(p)) { const m = spanMask(p.slice(1, -1)); if (m) parts[i] = m; continue }
      let q = p
      for (const e of entries) if (e.prose) q = q.replace(new RegExp('(?<![A-Za-z0-9_])' + esc(e.value) + '(?![A-Za-z0-9_])', 'g'), e.label)
      parts[i] = q
    }
    return finish(parts.join(''))
  }
}

module.exports = { load, masker, ENUM_PATHS, PROSE_SLOTS, HEADING_SLOTS }
