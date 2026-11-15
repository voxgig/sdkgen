// What "the same sentence" is, for every tool that keys anything by a sentence.
//
// A unit (sentence, cell, heading, comment) is cut into a SKELETON and its
// POSITIONS. A position is a place where a language may supply text:
//   - a code span (in any unit, a comment included);
//   - a fact phrase: a declared value holding a space or a backtick
//     (`ref.body.values`, "`NULL`-terminated array"), wherever it stands;
//   - outside code spans, a word declared at a slot shared code prints
//     unquoted (collection, noun, maps, entityNoun);
//   - in a code comment, a value declared at a slot shared code prints raw in
//     a comment (collection without its backticks, ok, err, nullValue,
//     errSlot, errVar, record, listOf, recordType, noError, pairForm).
// The candidate values are the union over every language with a provider in
// the clone, so every language's unit is cut at the same places whatever its
// own values are. The skeleton is the rest, with model names masked where the
// model supplied them (cut.js), numbers masked, and the article before a
// mark made one.
//
// A position is a LANGUAGE SLOT when, among the reference languages' NEW units
// of the same skeleton and kind, its content is not always the same. Shared
// literals (`ok`, `status`, `data` in "headers and `data`", the word "array"
// in "The array form of `feature`") are the same in every reference and stay
// literal; a declared fact, a printer's output (`result.ok`,
// `getp(&result, "ok")`), a member name (`Direct()`, `sdk_direct()`) and a
// class name in any shape differ, and are slots.
//
//   identity  (what a verdict and a sentence id are keyed by): the skeleton,
//             every slot an unlabelled mark ⟦⟧, every other position literal.
//             A unit that is ALL positions (a signature heading, a key cell,
//             a Call cell) is no sentence: it keeps its display mask, labels
//             included, so `⟦ref.op.load⟧` and `⟦ref.op.create⟧` stay apart.
//   match     (what classify.js accepts a port's unit by): the skeleton, a
//             position masked (unlabelled) only where its raw text is one of
//             the unit language's own declared facts (guarded or accounted)
//             AND no other language prints that same text there as plain
//             shared text (so py's `data`, its accessor parameter, stays the
//             literal `data` of "headers and `data`"); everything else
//             literal. The language under review is left out of what the
//             others print. A printer's output must equal a reference
//             language's to match, and anything else is left for a person.
const Fs = require('node:fs')
const Path = require('node:path')
const Crypto = require('node:crypto')
const C = require('./cut.js')
const K = require('./common.js')
const Facts = require('./facts.js')

const COMMENT_PATHS = /^(collection|ok|err|nullValue|errSlot|errVar|record|listOf|recordType|noError|pairForm)$/
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SLOT = '⟦⟧'
const P_MARK = ''

// A fact value as a pattern: `{x}` placeholders one identifier.
const pat = (v) => esc(v).replace(/\\\{(\w+)\\\}/g, '[A-Za-z_][\\w.:/<>-]*')

function providerLangs(ts) {
  const d = Path.join(ts, 'dist-test-scaffold/.sdk/dist/cmp')
  if (!Fs.existsSync(d)) return []
  return Fs.readdirSync(d).filter((l) => Fs.existsSync(Path.join(d, l, 'Syntax_' + l + '.js'))).sort()
}

const MADE = new Map()

function make(a) {
  const clone = Path.resolve(a.clone), ts = Path.join(clone, 'ts')
  const roots = [a.old, a.new]
  const key = [clone, ...roots].join('\0')
  if (MADE.has(key)) return MADE.get(key)
  const langs = providerLangs(ts)
  const F = Object.fromEntries(langs.map((l) => [l, Facts.load(ts, l)]))
  const facts = (l) => (F[l] ? F[l].facts : []).filter((f) => !Facts.ENUM_PATHS.test(f.path) && !f.path.startsWith('layout.'))
  // candidate values, every language's
  const frag = new Set(), prose = new Set(), comm = new Set()
  for (const l of langs) for (const f of facts(l)) {
    const v = f.value
    if (v.length >= 6 && /[`\s]/.test(v) && !/\n/.test(v)) frag.add(v)
    if (Facts.PROSE_SLOTS.has(f.path) && /^[A-Za-z]+$/.test(v)) prose.add(v)
    if (COMMENT_PATHS.test(f.path)) { const s = v.replace(/`/g, ''); if (s.trim()) comm.add(s) }
  }
  const byLen = (s) => [...s].sort((x, y) => y.length - x.length)
  // a phrase holding a code span is found first; one without, only outside spans
  const FRAG_BT = byLen(frag).filter((v) => /`/.test(v)), FRAG = byLen(frag).filter((v) => !/`/.test(v))
  const PROSE = prose.size ? new RegExp('(?<![A-Za-z0-9_])(' + byLen(prose).map(esc).join('|') + ')(?![A-Za-z0-9_])', 'g') : null
  const COMM = comm.size ? new RegExp('(?<![\\w$])(' + byLen(comm).map(pat).join('|') + ')(?![\\w$])', 'g') : null
  // is `s` (a position's raw content) one of language l's own declared values?
  const OWN = new Map()
  const own = (l) => {
    if (OWN.has(l)) return OWN.get(l)
    const res = []
    for (const f of facts(l)) {
      const vs = [f.value, f.value.replace(/`/g, '')]
      for (const v of vs) res.push(new RegExp('^' + pat(v) + (/^method\./.test(f.path) ? '(\\(\\))?' : '') + '$'))
    }
    OWN.set(l, res)
    return res
  }
  const isOwn = (l, s) => own(l).some((re) => re.test(s))
  // the fact paths whose declared value `s` is, in language l
  const OWNP = new Map()
  const ownPaths = (l, s) => {
    const k = l + '\u0000' + s
    if (OWNP.has(k)) return OWNP.get(k)
    const res = new Set()
    for (const f of facts(l)) {
      for (const v of [f.value, f.value.replace(/`/g, '')]) if (new RegExp('^' + pat(v) + (/^method\./.test(f.path) ? '(\\(\\))?' : '') + '$').test(s)) res.add(f.path)
    }
    OWNP.set(k, res)
    return res
  }
  const display = new Map()
  const disp = (l) => { if (!display.has(l)) display.set(l, F[l] ? Facts.masker(F[l], roots) : C.masker(roots, l, { numbers: false, learn: false })); return display.get(l) }

  // The positions of a raw text: [{s, e, span}].
  function positions(text, kind) {
    const taken = new Array(text.length).fill(false)
    const out = []
    const put = (s, e, span) => { for (let i = s; i < e; i++) if (taken[i]) return; for (let i = s; i < e; i++) taken[i] = true; out.push({ s, e, span }) }
    for (const v of FRAG_BT) { let i = -1; while ((i = text.indexOf(v, i + 1)) >= 0) put(i, i + v.length, false) }
    for (const m of text.matchAll(/`[^`]*`/g)) put(m.index, m.index + m[0].length, true)
    const outside = text.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length))
    for (const v of FRAG) { let i = -1; while ((i = outside.indexOf(v, i + 1)) >= 0) put(i, i + v.length, false) }
    const scan = (re) => { if (!re) return; re.lastIndex = 0; for (const m of text.matchAll(re)) if (m[0].length) put(m.index, m.index + m[0].length, false) }
    if ('comment' === kind) scan(COMM)
    else {
      // prose words only outside code spans
      const bare = text.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length))
      if (PROSE) { PROSE.lastIndex = 0; for (const m of bare.matchAll(PROSE)) put(m.index, m.index + m[0].length, false) }
    }
    return out.sort((x, y) => x.s - y.s)
  }

  // Skeleton and fills of a raw text, with model names learned without `excl`.
  function analyse(text, kind, lang, excl = lang) {
    const mr = C.modelRanges(roots, lang, excl)(text)
    const ps = positions(text, kind)
    const piece = (s, e) => {
      let out = '', at = s
      for (const r of mr) { if (r.s < s || r.e > e) continue; out += text.slice(at, r.s) + (null == r.rep ? r.w : r.rep); at = r.e }
      return out + text.slice(at, e)
    }
    let skel = '', at = 0
    const fills = [], parts = []
    for (const p of ps) {
      const pre = piece(at, p.s).replace(/\b\d+\b/g, 'Ⓝ')
      skel += pre + P_MARK; parts.push(pre)
      const raw = text.slice(p.s, p.e)
      fills.push({ span: p.span, raw: p.span ? raw.slice(1, -1) : raw, fill: p.span ? piece(p.s + 1, p.e - 1) : piece(p.s, p.e) })
      at = p.e
    }
    const tail = piece(at, text.length).replace(/\b\d+\b/g, 'Ⓝ')
    skel += tail; parts.push(tail)
    skel = skel.replace(/(^|[^A-Za-z])([Aa])n?(\s+)(?=[ⒺⒻⓈ])/g, '$1$2$3')
    // all positions: no letters left outside them
    const whole = !/[A-Za-z]{2}/.test(skel.replace(/[ⒺⒻⓈⓁⓃ]/g, ''))
    return { skel, fills, parts, whole, k: kind + '\u0000' + skel }
  }

  // The reference languages' skeletons: per position, content -> languages.
  let T2 = null
  function table() {
    if (T2) return T2
    T2 = new Map()
    const refs = [...new Set(Object.values(C.REG.ported).flat())]
    for (const v of C.variationsOf(a.new)) for (const section of C.SECTIONS) for (const r of refs) {
      const sect = C.loadSection(a.new, v, section, r)
      if (null == sect) continue
      for (const u of C.units(sect)) {
        const x = analyse(u.text, u.kind, r)
        if (x.whole || !x.fills.length) continue
        let row = T2.get(x.k)
        if (!row) { row = x.fills.map(() => new Map()); row.paths = x.fills.map(() => new Map()); T2.set(x.k, row) }
        // per content, the languages that print it and whether it is their own declared fact
        x.fills.forEach((f, i) => { if (!row[i]) row[i] = new Map(); if (!row[i].has(f.fill)) row[i].set(f.fill, new Map()); const m = row[i].get(f.fill); m.set(r, (m.get(r) || false) || isOwn(r, f.raw)) })
        // per position and reference, the fact paths its own text there is the value of
        x.fills.forEach((f, i) => {
          if (!row.paths[i]) row.paths[i] = new Map()
          const ps = ownPaths(r, f.raw)
          if (!ps.size) return
          if (!row.paths[i].has(r)) row.paths[i].set(r, new Set())
          for (const p of ps) row.paths[i].get(r).add(p)
        })
      }
    }
    return T2
  }
  const varies = (x, i, excl) => {
    const row = table().get(x.k)
    if (!row || !row[i]) return false
    let n = 0
    for (const src of row[i].values()) if ([...src.keys()].some((l) => l !== excl)) n++
    return n > 1
  }
  // printed there, as plain text and not as its own fact, by another language
  const literalElsewhere = (x, i, fill, excl) => {
    const row = table().get(x.k)
    const src = row && row[i] && row[i].get(fill)
    return !!src && [...src.entries()].some(([l, own]) => l !== excl && !own)
  }
  // The fact a position holds: the paths every reference (but `excl`) whose
  // own declared fact stands there is the value of, intersected across those
  // references (py's `list` is its collection AND its list method; ts's
  // `array` only its collection: the position holds the collection). null
  // where no reference prints its own fact there.
  const pathsAt = (x, i, excl) => {
    const row = table().get(x.k)
    const m = row && row.paths && row.paths[i]
    if (!m) return null
    let S = null
    for (const [r, ps] of m) {
      if (r === excl) continue
      S = null == S ? new Set(ps) : new Set([...S].filter((p) => ps.has(p)))
    }
    return S
  }
  // a language's text fills a position only as the value of the fact the
  // position holds: zig's `.err` where rust prints its `Ok` is its own fact,
  // but of another path, and stays literal
  const samePath = (lang, x, i, excl) => {
    const S = pathsAt(x, i, excl)
    if (!S || !S.size) return false
    for (const p of ownPaths(lang, x.fills[i].raw)) if (S.has(p)) return true
    return false
  }
  const lit = (f) => f.span ? '`' + f.fill + '`' : f.fill
  // the article before a mark is one word, whatever the token after it
  const finish = (s) => s.replace(/(^|[^A-Za-z])([Aa])n?(\s+)(?=⟦|[ⒺⒻⓈ])/g, '$1$2$3')
  const build = (x, slot) => finish(x.parts.map((p, i) => i < x.fills.length ? p + (slot(i) ? SLOT : lit(x.fills[i])) : p).join(''))
  const wholeText = (text, kind, lang) => finish(disp(lang)(text, kind).replace(/`(⟦[^⟧]*⟧)`/g, '$1'))

  function identity(text, kind, lang) {
    const x = analyse(text, kind, lang)
    if (x.whole) return kind + '\u0000' + wholeText(text, kind, lang)
    return kind + '\u0000' + build(x, (i) => varies(x, i, null))
  }
  function match(text, kind, lang, excl) {
    const x = analyse(text, kind, lang, excl)
    if (x.whole) return wholeText(text, kind, lang)
    // a slot only where the language supplies its own declared fact, OF THE
    // PATH the references' own facts there are (the same fact, not any of
    // the language's facts), and no other language prints the same text
    // there as plain shared text
    return build(x, (i) => isOwn(lang, x.fills[i].raw) && samePath(lang, x, i, excl) && !literalElsewhere(x, i, x.fills[i].fill, excl))
  }
  const sentenceId = (text, kind, lang) => K.classId('sentence', identity(text, kind, lang))
  const res = { identity, match, sentenceId, analyse, table, isOwn, ownPaths, pathsAt, langs, isModelText: modelTextOf(a, ts) }
  MADE.set(key, res)
  return res
}

// ---- text the fixture model holds, not shared code ----------------------
//
// Descriptions written in the model (an entity's short text, a field's
// description, a project's entity_desc) are printed as they are: they are no
// sentence of shared code and take no verdict. Every string of every
// variation's model with a space in it, links reduced to their text and
// escapes undone; a unit is model text when it is such a string or a part of
// one at least three words long.
const norm = (s) => String(s).replace(/\\\|/g, '|').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<br\s*\/?>/g, ' ').replace(/\s+/g, ' ').trim()
function modelTextOf(a, ts) {
  let set = null
  const load = () => {
    if (set) return set
    const vfile = Path.join(__dirname, 'gen', 'variations.js')
    const h = Crypto.createHash('sha1').update(ts + '\0' + Fs.readFileSync(vfile, 'utf8')).digest('hex').slice(0, 12)
    const cache = Path.join(__dirname, 'review', '.modeltext-' + h + '.json')
    if (Fs.existsSync(cache)) { set = new Set(JSON.parse(Fs.readFileSync(cache, 'utf8'))); return set }
    set = new Set()
    const prev = process.env.SDKGEN_TS
    process.env.SDKGEN_TS = ts
    const L = require('./gen/lib2.js')
    const { variations } = require('./gen/variations.js')
    const feats = Fs.readdirSync(Path.join(L.H.SCAFFOLD, 'model', 'feature')).filter((f) => f.endsWith('.aontu') && 'feature-index.aontu' !== f).map((f) => f.replace(/\.aontu$/, '')).sort()
    const cwd = process.cwd()
    process.chdir(L.H.SCAFFOLD)
    try {
      for (const v of variations(L.H, feats)) {
        let model
        try { model = L.makeModel(v.spec) } catch (e) { continue }
        const kit = model.main && model.main.kit || {}
        // the API's own texts: entities and their fields, and the project's text block
        const walk = (x, d) => {
          if (d > 12) return
          if ('string' === typeof x) { if (/\s/.test(x.trim()) && /[A-Za-z]{2}/.test(x)) set.add(norm(x)) }
          else if (Array.isArray(x)) x.forEach((y) => walk(y, d + 1))
          else if (x && 'object' === typeof x) for (const [k, y] of Object.entries(x)) if (!/\$$/.test(k)) walk(y, d + 1)
        }
        walk(kit.entity, 0); walk(kit.text, 0)
      }
    } finally { process.chdir(cwd); if (null == prev) delete process.env.SDKGEN_TS; else process.env.SDKGEN_TS = prev }
    C.readIf(cache) // nothing
    K.writeFile(cache, JSON.stringify([...set]))
    return set
  }
  return (text) => {
    const t = norm(text)
    if (!/\s/.test(t)) return false
    const s = load()
    if (s.has(t)) return true
    if (t.split(' ').length < 3) return false
    for (const m of s) if (m.includes(t)) return true
    return false
  }
}

module.exports = { make, SLOT, COMMENT_PATHS }
