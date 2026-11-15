// Cutting generated documents into the sections under review, and a section
// into units (prose) and blocks (code). Every tool goes through this module.
const Fs = require('node:fs')
const Path = require('node:path')

const REG = JSON.parse(Fs.readFileSync(Path.join(__dirname, 'ported.json'), 'utf8'))
const SECTIONS = ['tutorial', 'rootquick', 'reference']

function readIf(p) { return Fs.existsSync(p) ? Fs.readFileSync(p, 'utf8') : null }

// The file a section lives in, relative to one variation directory.
function sectionFile(section, lang) {
  if ('rootquick' === section) return 'README.md'
  if ('tutorial' === section) return lang + '/README.md'
  if ('reference' === section) return lang + '/REFERENCE.md'
  throw new Error('unknown section ' + section + ' (one of ' + SECTIONS.join(', ') + ')')
}

// Lines of a markdown text with a flag for being inside a fence.
function fenced(text) {
  let fence = false
  return String(text).split('\n').map((l) => {
    const isFence = /^\s*```/.test(l)
    const r = { l, fence: fence || isFence, isFence }
    if (isFence) fence = !fence
    return r
  })
}

function cutTutorial(md) {
  const L = fenced(md)
  const i = L.findIndex((x) => !x.fence && /^## Tutorial: your first API call/.test(x.l))
  if (i < 0) return null
  let j = i + 1
  while (j < L.length && !(!L[j].fence && /^## /.test(L[j].l))) j++
  return L.slice(i, j).map((x) => x.l).join('\n')
}

// The root README: the language's `### <Title>` subsection under
// `## Quickstart` or `## Quickstart in other languages`. The closing
// "See the [<Title> README]" line belongs to the frame, not to the language.
function cutRootQuick(md, lang) {
  const title = REG.languages[lang]
  const L = fenced(md)
  let sect = false, cur = null
  const out = []
  for (const x of L) {
    if (!x.fence && /^## /.test(x.l)) { sect = /^## Quickstart( in other languages)?\s*$/.test(x.l); cur = null; continue }
    if (!x.fence && sect && /^### /.test(x.l)) { cur = x.l.slice(4).trim() === title ? [x.l] : null; if (cur) out.push(cur); continue }
    if (!x.fence && cur && /^See the \[/.test(x.l)) { cur = null; continue }
    if (cur) cur.push(x.l)
  }
  return out.length ? out.map((c) => c.join('\n')).join('\n') : null
}

function cutSection(md, section, lang) {
  if (null == md) return null
  if ('tutorial' === section) return cutTutorial(md)
  if ('rootquick' === section) return cutRootQuick(md, lang)
  if ('reference' === section) return md
  throw new Error('unknown section ' + section)
}

function loadSection(root, variation, section, lang) {
  return cutSection(readIf(Path.join(root, variation, sectionFile(section, lang))), section, lang)
}

function variationsOf(root) {
  return Fs.readdirSync(root).filter((v) => Fs.statSync(Path.join(root, v)).isDirectory()).sort()
}

// ---- prose units -------------------------------------------------------

// Code spans are protected while sentences are split.
function protect(s) {
  const spans = []
  const t = s.replace(/`[^`]*`/g, (m) => { spans.push(m); return '\u0000' + (spans.length - 1) + '\u0000' })
  return { t, back: (x) => x.replace(/\u0000(\d+)\u0000/g, (_, i) => spans[+i]) }
}

function splitSentences(text) {
  const { t, back } = protect(text.replace(/\s+/g, ' ').trim())
  // a bold lead (`**Load a planet.** ...`) ends a sentence too
  return t.split(/(?<=[.!?](?:\*\*)?|:)\s+(?=[A-Z\u0000*(\[_"'<]|\d+\.)/).map((s) => back(s).trim()).filter((s) => '' !== s)
}

// A comment inside a code line: a whole-line comment, or one trailing code.
// Quote-aware, so a `//` inside a string is not taken for one.
function commentOf(line) {
  const s = line.trim()
  let m = /^(\/\/+|#(?=\s|$)|;;+|--(?=\s)|\(\*)\s?(.*?)(\s*\*\))?$/.exec(s)
  if (m && !/^#\s*(include|define|if|endif|pragma)\b/.test(s)) return { whole: true, text: m[2].trim() }
  let q = null
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) { if ('\\' === c) i++; else if (c === q) q = null; continue }
    if ('"' === c || "'" === c || '`' === c) { q = c; continue }
    if (/\s/.test(line[i - 1] || '') && (line.startsWith('// ', i) || line.startsWith('# ', i) || line.startsWith(';; ', i) || line.startsWith('-- ', i))) {
      const text = line.slice(i).replace(/^(\/\/|#|;;|--)\s*/, '').trim()
      if (text) return { whole: false, text }
    }
  }
  return null
}

function cells(row) {
  const r = row.trim().replace(/^\|/, '').replace(/\|$/, '')
  const out = []; let cur = '', tick = false
  for (let i = 0; i < r.length; i++) {
    const c = r[i]
    if ('\\' === c && '|' === r[i + 1]) { cur += '\\|'; i++; continue }
    if ('`' === c) tick = !tick
    if ('|' === c && !tick) { out.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  out.push(cur.trim())
  return out
}

// Units of a section: heading, sentence, cell, header (a table's column
// names), comment (inside a code block). Each carries `ctx` (the heading path
// it stands under) and, for a cell, `key` (heading path, column, row key) so
// the same cell can be found on the other side.
function units(section) {
  if (null == section) return []
  const out = []
  const L = fenced(section)
  const path = []
  let para = []
  let table = null
  let block = null
  const ctx = () => path.filter(Boolean).join(' > ')
  const flush = () => {
    if (para.length) {
      const text = para.join(' ').replace(/^\s*([-*+]|\d+\.)\s+/, '')
      for (const s of splitSentences(text)) out.push({ kind: 'sentence', text: s, ctx: ctx() })
      para = []
    }
  }
  for (let i = 0; i < L.length; i++) {
    const x = L[i]
    if (x.isFence) {
      flush(); table = null
      if (!block) { block = { lang: x.l.trim().slice(3), n: 0 }; continue }
      block = null; continue
    }
    if (block) {
      const c = commentOf(x.l)
      if (c && c.text) out.push({ kind: 'comment', text: c.text, ctx: ctx() })
      continue
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(x.l)
    if (h) {
      flush(); table = null
      path.length = h[1].length - 1
      path[h[1].length - 1] = h[2].trim()
      out.push({ kind: 'heading', text: h[2].trim(), ctx: path.slice(0, -1).filter(Boolean).join(' > ') })
      continue
    }
    if (/^\s*\|/.test(x.l)) {
      flush()
      if (/^\s*\|[\s:|-]+\|\s*$/.test(x.l)) continue
      const cs = cells(x.l)
      if (!table) {
        table = { head: cs }
        cs.forEach((c) => out.push({ kind: 'header', text: c, ctx: ctx() }))
        continue
      }
      cs.forEach((c, k) => {
        if ('' === c) return
        const col = table.head[k] || String(k)
        out.push({ kind: 'cell', text: c, ctx: ctx(), col, row: cs[0], key: ctx() + ' | ' + col + ' | ' + cs[0] })
      })
      continue
    }
    table = null
    if ('' === x.l.trim()) { flush(); continue }
    // a new list item starts a new unit; a wrapped line joins the one before
    if (/^\s*([-*+]|\d+\.)\s+/.test(x.l)) flush()
    if (/^---+\s*$/.test(x.l)) { flush(); continue }
    para.push(x.l.trim())
  }
  flush()
  return out
}

// ---- code blocks -------------------------------------------------------

// Each block with the heading path it stands under and its index there.
function blocks(section) {
  if (null == section) return []
  const out = []
  const path = []
  const seen = {}
  let cur = null
  for (const x of fenced(section)) {
    if (x.isFence) {
      if (!cur) { cur = { lang: x.l.trim().slice(3), lines: [] }; continue }
      const at = path.filter(Boolean).join(' > ')
      seen[at] = (seen[at] || 0) + 1
      out.push({ at, n: seen[at] - 1, lang: cur.lang, code: cur.lines.join('\n') })
      cur = null
      continue
    }
    if (cur) { cur.lines.push(x.l); continue }
    const h = /^(#{1,6})\s+(.*)$/.exec(x.l)
    if (h) { path.length = h[1].length - 1; path[h[1].length - 1] = h[2].trim() }
  }
  return out
}

// ---- masking: what makes two units the same class ------------------------

// Model names come from the output itself: entity names from the root
// README's entity table and every REFERENCE/README heading that names an
// entity class, field names from every Fields table. Nothing is listed here.
const VOCAB = new Map()
function vocab(roots) {
  const k = roots.join('\0')
  if (VOCAB.has(k)) return VOCAB.get(k)
  const ents = new Set(), fields = new Set(), sdk = new Set()
  for (const root of roots) {
    for (const v of variationsOf(root)) {
      const top = readIf(Path.join(root, v, 'README.md'))
      if (top) {
        const t = /^# (\S+)/m.exec(top); if (t) sdk.add(t[1])
        const es = /^## Entities\s*$([\s\S]*?)(?=^## )/m.exec(top + '\n## ')
        if (es) for (const m of es[1].matchAll(/^\| \*\*([A-Za-z0-9_]+)\*\* \|/gm)) ents.add(m[1])
      }
      for (const lang of Fs.readdirSync(Path.join(root, v))) {
        const ref = readIf(Path.join(root, v, lang, 'REFERENCE.md'))
        if (!ref) continue
        const t = /^# (\S+)/m.exec(ref); if (t) sdk.add(t[1])
        let inF = false, head = null
        for (const l of ref.split('\n')) {
          if (/^#+ /.test(l)) { inF = /^#+ Fields\b/.test(l); head = null; continue }
          if (inF && /^\|/.test(l)) {
            if (/^\|[\s:|-]+\|$/.test(l.trim())) continue
            const cs = cells(l)
            if (!head) { head = cs; continue }
            const f = cs[0].replace(/`/g, '').trim()
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(f)) fields.add(f)
          }
        }
      }
    }
  }
  const forms = new Set()
  const snake = (P) => P.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  for (const P of ents) {
    const s = snake(P)
    for (const f of [P, s, s.replace(/_/g, ''), P.toUpperCase(), s.toUpperCase(), P[0].toLowerCase() + P.slice(1)]) forms.add(f)
  }
  const res = {
    entNames: [...ents],
    entities: [...forms].filter((x) => x.length > 2).sort((a, b) => b.length - a.length),
    fields: [...fields].filter((f) => !forms.has(f)).sort((a, b) => b.length - a.length),
    sdk: [...sdk],
  }
  VOCAB.set(k, res)
  return res
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The class of a unit: model names, the SDK name, the language's title and
// numbers masked. Entity names are masked inside identifiers too
// (`PlanetEntity`, `planet_id`); field names only as whole words.
// `learn: false` (code lines, whole blocks, heading paths, single tokens) is
// the v3.2 mask exactly. For a unit's text (the default) a word that equals a
// model name is masked only where the model supplied it: see learnRanges.
function masker(roots, lang, opt = {}) {
  const V = vocab(roots)
  const title = REG.languages[lang]
  const ent = V.entities.length ? new RegExp(V.entities.map(esc).join('|'), 'g') : null
  const fld = V.fields.length ? new RegExp('(?<![A-Za-z0-9_])(' + V.fields.map(esc).join('|') + ')(?![A-Za-z0-9_])', 'g') : null
  const sdk = V.sdk.length ? new RegExp('(?<![A-Za-z])(' + V.sdk.map(esc).join('|') + ')', 'g') : null
  const ttl = title ? new RegExp('(?<![A-Za-z])' + esc(title) + '(?![A-Za-z])', 'g') : null
  const plain = (s) => {
    let t = s
    if (ent) t = t.replace(ent, 'Ⓔ')
    if (fld) t = t.replace(fld, 'Ⓕ')
    if (sdk) t = t.replace(sdk, 'Ⓢ')
    if (ttl) t = t.replace(ttl, 'Ⓛ')
    if (false !== opt.numbers) t = t.replace(/\b\d+\b/g, 'Ⓝ')
    return t
  }
  if (false === opt.learn) return plain
  const R = modelRanges(roots, lang)
  return (s) => {
    const t = applyRanges(s, R(s))
    return false !== opt.numbers ? t.replace(/\b\d+\b/g, 'Ⓝ') : t
  }
}

// ---- where the model supplied a name ------------------------------------
//
// A word that equals an entity or field name of some model (`record`,
// `utility`, `id`, `fields`, `data`) is not therefore a model name: shared
// prose says "every record is listed" whatever the model is. A unit's TEMPLATE
// is its text with every candidate (an entity form, anywhere; a field name, as
// a whole word) replaced by a mark; the SDK name and the language title are
// always masked. A candidate is a model slot when, among the units of the same
// template printed by the LEARNERS, the word at that place is not always the
// same name: the 21 variations' models name different entities and fields, so
// a word the model supplies changes from one to another, and a word of shared
// prose does not. The learners are the OLD pages of every language (the code
// before the port, not under review) and the NEW pages of the reference
// languages (ported.json), less the language being masked: a language's own
// new pages never decide where its own model slots are, so a shared word it
// replaces by a model name stays a word, and differs from the reference.
// A template only that language prints falls back to its own pages; a text no
// learner printed as a unit falls back to the v3.2 mask.
const SKEL = new Map()
function vocabLearn(roots) {
  const V = vocab(roots)
  if (V.learn) return V.learn
  const snake = (P) => P.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  // an entity whose name is another's plus a suffix (planet_entity) is masked
  // as that entity and the suffix, so PlanetEntity has one shape everywhere
  const base = V.entNames.filter((P) => !V.entNames.some((Q) => Q !== P && snake(P).startsWith(snake(Q) + '_')))
  const forms = new Set()
  for (const P of base) { const s = snake(P); for (const f of [P, s, s.replace(/_/g, ''), P.toUpperCase(), s.toUpperCase(), P[0].toLowerCase() + P.slice(1)]) if (f.length > 2) forms.add(f) }
  const ents = [...forms].sort((a, b) => b.length - a.length)
  V.learn = {
    ent: ents.length ? new RegExp(ents.map(esc).join('|'), 'g') : null,
    fld: V.fields.length ? new RegExp('(?<![A-Za-z0-9_])(' + V.fields.map(esc).join('|') + ')(?![A-Za-z0-9_])', 'g') : null,
    sdk: V.sdk.length ? new RegExp('(?<![A-Za-z])(' + V.sdk.map(esc).join('|') + ')', 'g') : null,
  }
  return V.learn
}

// Candidate ranges of a raw text, in its own coordinates: [{s, e, t, w}]
// (t: E entity, F field, S sdk, L title). Fields and the SDK name are found on
// a copy where earlier ranges are blanked, as the v3.2 mask replaced them in turn.
function candidates(VL, title, s) {
  const out = []
  let t = s
  const take = (re, kind) => {
    if (!re) return
    re.lastIndex = 0
    let m
    const blank = t.split('')
    while ((m = re.exec(t))) {
      if (!m[0].length) { re.lastIndex++; continue }
      out.push({ s: m.index, e: m.index + m[0].length, t: kind, w: m[0] })
      for (let i = m.index; i < m.index + m[0].length; i++) blank[i] = ''
    }
    t = blank.join('')
  }
  take(VL.ent, 'E'); take(VL.fld, 'F'); take(VL.sdk, 'S')
  if (title) take(new RegExp('(?<![A-Za-z])' + esc(title) + '(?![A-Za-z])', 'g'), 'L')
  return { ranges: out.sort((a, b) => a.s - b.s), blanked: t }
}
const MARK = { E: '', F: '', S: 'Ⓢ', L: 'Ⓛ' }
const SYM = { E: 'Ⓔ', F: 'Ⓕ', S: 'Ⓢ', L: 'Ⓛ' }
const canon = (w) => w.toLowerCase().replace(/_/g, '')
function templateOf(s, rs) {
  let out = '', at = 0
  for (const r of rs) { out += s.slice(at, r.s) + MARK[r.t]; at = r.e }
  // the article follows the name ("an ambient", "a planet"): one template
  // and numbers (a step number) are no part of a template
  return (out + s.slice(at)).replace(/(^|[^A-Za-z])([Aa])n?(\s+)(?=[\uE001\uE002])/g, '$1$2$3').replace(/\b\d+\b/g, '#')
}

// Learners of a pair of roots: [old, new]; a single root is NEW unless it is named old.
function sidesOf(roots) {
  if (2 === roots.length) return [{ root: roots[0], side: 'old' }, { root: roots[1], side: 'new' }]
  return roots.map((r) => ({ root: r, side: 'old' === Path.basename(r) ? 'old' : 'new' }))
}
const LEARNERS_NEW = () => [...new Set(Object.values(REG.ported).flat())].sort()

// The learned table for a set of roots: template -> per model position, a
// map from the name there to the set of sources ('old', or a learner language).
function learned(roots) {
  const k = roots.join('\0')
  if (SKEL.has(k)) return SKEL.get(k)
  const VL = vocabLearn(roots)
  const T = new Map()
  const learn = (text, src, title) => {
    const { ranges } = candidates(VL, title, text)
    const ms = ranges.filter((r) => 'E' === r.t || 'F' === r.t)
    if (!ms.length) return
    const key = templateOf(text, ranges)
    let row = T.get(key)
    if (!row) { row = ms.map(() => new Map()); T.set(key, row) }
    ms.forEach((r, i) => { const c = canon(r.w); if (!row[i].has(c)) row[i].set(c, new Set()); row[i].get(c).add(src) })
  }
  const newLangs = LEARNERS_NEW()
  for (const { root, side } of sidesOf(roots)) {
    for (const v of variationsOf(root)) for (const section of SECTIONS) {
      const langs = 'old' === side ? Object.keys(REG.languages) : newLangs
      for (const lang of langs) {
        const sect = loadSection(root, v, section, lang)
        if (null == sect) continue
        const src = 'old' === side ? 'old' : 'new:' + lang
        for (const u of units(sect)) learn(u.text, src, REG.languages[lang])
      }
    }
  }
  SKEL.set(k, T)
  return T
}

// The model ranges of a unit's text for `lang`: each candidate with what
// replaces it (Ⓔ, Ⓕ, Ⓢ, Ⓛ, or null: the word stays).
function modelRanges(roots, lang) {
  const VL = vocabLearn(roots)
  const title = REG.languages[lang]
  const self = 'new:' + lang
  return (s) => {
    const { ranges } = candidates(VL, title, s)
    const ms = ranges.filter((r) => 'E' === r.t || 'F' === r.t)
    if (!ms.length) return ranges.map((r) => ({ ...r, rep: SYM[r.t] }))
    const row = learned(roots).get(templateOf(s, ranges))
    let i = 0
    return ranges.map((r) => {
      if ('S' === r.t || 'L' === r.t) return { ...r, rep: SYM[r.t] }
      const pos = row ? row[i] : null
      i++
      // no learner printed this template: the v3.2 mask
      if (!pos) return { ...r, rep: SYM[r.t] }
      const others = [...pos.entries()].filter(([, src]) => [...src].some((x) => x !== self))
      const names = others.length ? others.length : pos.size
      return { ...r, rep: names > 1 ? SYM[r.t] : null }
    })
  }
}

function applyRanges(s, rs) {
  let out = '', at = 0
  for (const r of rs) { out += s.slice(at, r.s) + (null == r.rep ? r.w : r.rep); at = r.e }
  return out + s.slice(at)
}

// Words of a text, code spans counted as their own words.
function words(s) { return String(s).replace(/`/g, ' ').split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)) }

// Identifiers and code-span tokens of a text: what novel/vanished tokens are made of.
function tokens(s) { return String(s).match(/[A-Za-z_][A-Za-z0-9_]*/g) || [] }

module.exports = { REG, SECTIONS, sectionFile, cutSection, loadSection, variationsOf, units, blocks, splitSentences, commentOf, cells, vocab, masker, modelRanges, applyRanges, learned, words, tokens, readIf }
