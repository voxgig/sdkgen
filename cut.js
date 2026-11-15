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
  return t.split(/(?<=[.!?:])\s+(?=[A-Z\u0000*(\[_"'<]|\d+\.)/).map((s) => back(s).trim()).filter((s) => '' !== s)
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
function masker(roots, lang, opt = {}) {
  const V = vocab(roots)
  const title = REG.languages[lang]
  const ent = V.entities.length ? new RegExp(V.entities.map(esc).join('|'), 'g') : null
  const fld = V.fields.length ? new RegExp('(?<![A-Za-z0-9_])(' + V.fields.map(esc).join('|') + ')(?![A-Za-z0-9_])', 'g') : null
  const sdk = V.sdk.length ? new RegExp('(?<![A-Za-z])(' + V.sdk.map(esc).join('|') + ')', 'g') : null
  const ttl = title ? new RegExp('(?<![A-Za-z])' + esc(title) + '(?![A-Za-z])', 'g') : null
  return (s) => {
    let t = s
    if (ent) t = t.replace(ent, 'Ⓔ')
    if (fld) t = t.replace(fld, 'Ⓕ')
    if (sdk) t = t.replace(sdk, 'Ⓢ')
    if (ttl) t = t.replace(ttl, 'Ⓛ')
    if (false !== opt.numbers) t = t.replace(/\b\d+\b/g, 'Ⓝ')
    return t
  }
}

// Words of a text, code spans counted as their own words.
function words(s) { return String(s).replace(/`/g, ' ').split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)) }

// Identifiers and code-span tokens of a text: what novel/vanished tokens are made of.
function tokens(s) { return String(s).match(/[A-Za-z_][A-Za-z0-9_]*/g) || [] }

module.exports = { REG, SECTIONS, sectionFile, cutSection, loadSection, variationsOf, units, blocks, splitSentences, commentOf, cells, vocab, masker, words, tokens, readIf }
