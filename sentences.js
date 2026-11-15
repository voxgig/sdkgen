// node sentences.js --clone <clone> --old <root> --new <root> [--section s,..] [--refs l,..] [--out <dir>] [--match] [--json]
//
// Every distinct masked sentence the reference languages contribute to
// shared-sentence matching: the NEW side of each `reworded` and `added`
// class a reference language has decided (classes/<ref>.json; a class that
// was itself matched as shared is not a reference), masked with that
// language's own facts, exactly as classify.js builds its reference set.
// For each: its id (what reviewed/sentences.json is keyed by), section and
// kind, the masked text, one concrete example (language, variation, text),
// how many languages and classes contribute it, how those classes were
// accepted (hand, a stage-3a rule record, a block normalizer, ...), the
// shared source file whose template prints it where one is found
// mechanically, and its verdict.
//
// reviewed/sentences.json holds the verdicts (`ok`, `false`, `awkward`, with
// a note), written by a reviewer and by no tool. This tool only reads it.
//
// --match also runs classify.js from scratch for each reference language
// against the others, and reports how many of its classes match a reference
// sentence, and how many of those sentences have no verdict.
//
// Writes <out>/sentences.json and <out>/sentences.txt (default review/sentences/).
const Fs = require('node:fs')
const Path = require('node:path')
const C = require('./cut.js')
const K = require('./common.js')
const Ledger = require('./ledger.js')
const Facts = require('./facts.js')
const Classify = require('./classify.js')
const Ident = require('./ident.js')

const AUTO_TYPES = new Set(['reworded', 'added'])
const SHARED_SRC = ['ts/src/cmp', 'ts/src/helpers']

function sources(clone) {
  const out = []
  for (const d of SHARED_SRC) {
    const dir = Path.join(clone, d)
    if (!Fs.existsSync(dir)) continue
    for (const f of Fs.readdirSync(dir)) if (f.endsWith('.ts')) out.push({ file: Path.join(d, f), text: Fs.readFileSync(Path.join(dir, f), 'utf8') })
  }
  return out
}

// The shared file whose literals hold the most four-word runs of the example
// (code spans and model names left out); null when no run is found.
function templateOf(srcs, example) {
  const w = String(example).replace(/`[^`]*`/g, ' \u0001 ').split(/\s+/).filter(Boolean)
  const runs = []
  for (let i = 0; i + 4 <= w.length; i++) {
    const r = w.slice(i, i + 4)
    if (r.includes('\u0001')) continue
    runs.push(r.join(' ').replace(/[.:;,]$/, ''))
  }
  if (!runs.length) {
    const t = w.filter((x) => '\u0001' !== x).join(' ').replace(/[.:;,]$/, '')
    if (t.split(' ').length >= 2 && t.length >= 10) runs.push(t)
  }
  let best = null
  for (const s of srcs) {
    const n = runs.filter((r) => s.text.includes(r)).length
    if (n && (!best || n > best.n)) best = { file: s.file, n, of: runs.length }
  }
  return best
}

function main() {
  const a = K.args(process.argv.slice(2), { classes: Path.join(__dirname, 'classes'), out: Path.join(__dirname, 'review', 'sentences') })
  if (!a.clone || !a.old || !a.new) { console.error('usage: node sentences.js --clone <clone> --old <root> --new <root> [--section s,..] [--refs l,..] [--match] [--json]'); process.exit(2) }
  const clone = Path.resolve(a.clone), ts = Path.join(clone, 'ts')
  const sections = K.list(a.section) || C.SECTIONS
  const verd = Classify.verdicts(a.sentences)
  const srcs = sources(clone)
  const S = new Map()
  const I = Ident.make({ clone, old: a.old, new: a.new })
  const modelText = new Map()
  const t0 = Date.now()
  for (const section of sections) {
    const refs = K.list(a.refs) || C.REG.ported[section] || []
    for (const r of refs) {
      const decided = JSON.parse(Fs.readFileSync(Path.join(a.classes, r + '.json'), 'utf8'))
      for (const c of Ledger.run(a, section, r).classes) {
        if (!AUTO_TYPES.has(c.type)) continue
        const d = decided[c.id]
        if (!d || !d.outcome || 'defect' === d.outcome || (null != d.n && d.n !== c.n) || 'shared' === d.by) continue
        for (const show of c.inst.values()) {
          const kind = 'reworded' === c.type ? c.kind.split(':')[0] : c.kind
          const text = 'reworded' === c.type ? show[1] : show[0]
          // text the fixture model holds is no sentence of shared code
          if (I.isModelText(text)) { modelText.set(text, (modelText.get(text) || new Set()).add(r)); continue }
          const m = I.identity(text, kind, r).split('\u0000').slice(1).join('\u0000')
          const id = I.sentenceId(text, kind, r)
          if (!S.has(id)) S.set(id, { id, section, kind, masked: m, example: { lang: r, where: c.where, text }, langs: new Set(), classes: new Set(), by: {}, template: null, verdict: verd[id] || null })
          const x = S.get(id)
          x.langs.add(r)
          if (!x.classes.has(r + ':' + c.id)) { x.classes.add(r + ':' + c.id); const how = /^rule:/.test(d.by || '') ? 'rule record' : 'hand' === d.by || 'manual' === d.rule ? 'hand' : (d.by || d.rule || '?'); x.by[how] = (x.by[how] || 0) + 1 }
        }
      }
      console.error(`[sentences ${((Date.now() - t0) / 1000).toFixed(0)}s] ${section} ${r}: ${S.size} sentences so far`)
    }
  }
  for (const x of S.values()) x.template = templateOf(srcs, x.example.text)
  // A sentence one language prints: a note of its provider; a unit that is
  // all code (a signature, a key, a call: that language's printer); shared
  // code that one condition selects (its words are a shared template's);
  // another literal of its provider; or none of these, listed.
  const provSrc = {}
  const provOf = (l) => provSrc[l] = provSrc[l] || [{ file: 'Syntax_' + l + '.ts', text: C.readIf(Path.join(ts, 'project/.sdk/src/cmp', l, 'Syntax_' + l + '.ts')) || '' }]
  const notesOf = (l) => Object.values(Facts.load(ts, l).notes || {}).map((n) => String(n).replace(/\s+/g, ' '))
  for (const x of S.values()) {
    if (1 !== x.langs.size) continue
    const l = [...x.langs][0]
    const flat = x.example.text.replace(/\s+/g, ' ')
    if (flat.length > 8 && notesOf(l).some((n) => n.includes(flat))) x.single = 'note'
    else if (!/[A-Za-z]{2}/.test(x.masked.replace(/⟦[^⟧]*⟧|`[^`]*`|[ⒺⒻⓈⓁⓃ]/g, ''))) x.single = 'code'
    else if (x.template) x.single = 'shared-condition'
    else if (templateOf(provOf(l), x.example.text)) x.single = 'provider-literal'
    else x.single = 'unexplained'
  }
  const list = [...S.values()].map((x) => ({ ...x, langs: [...x.langs].sort(), classes: x.classes.size }))
  // per section: how many, how accepted, how many found in a template, verdicts
  const bySec = {}
  for (const x of list) {
    const b = bySec[x.section] = bySec[x.section] || { sentences: 0, byHandOnly: 0, byRuleOnly: 0, mixed: 0, template: 0, verdict: { ok: 0, false: 0, awkward: 0, none: 0 } }
    b.sentences++
    const hows = Object.keys(x.by)
    if (hows.every((h) => 'hand' === h)) b.byHandOnly++
    else if (hows.every((h) => 'rule record' === h)) b.byRuleOnly++
    else b.mixed++
    if (x.template) b.template++
    b.verdict[x.verdict || 'none']++
  }
  for (const x of list) if (1 === x.langs.length) { const b = bySec[x.section]; b.single = b.single || { all: 0 }; b.single.all++; b.single[x.single] = (b.single[x.single] || 0) + 1 }
  const res = { sentences: list.length, sections: bySec, match: null, modelText: [...modelText.entries()].map(([t, ls]) => ({ text: t, langs: [...ls].sort() })) }
  if (a.match) {
    res.match = {}
    for (const section of sections) for (const l of C.REG.ported[section] || []) {
      const r = Classify.run({ clone, old: a.old, new: a.new, lang: l, section, classes: a.classes, out: Path.join(a.out, 'classify'), scratch: true, dry: true, cache: true })
      const sh = Object.values(r.decided || {}).filter((d) => 'shared' === d.by).length
      ;(res.match[l] = res.match[l] || {})[section] = { classes: r.sections[section].classes, matched: sh, againstUnreviewed: r.sections[section].sharedUnreviewed || 0 }
      console.error(`[sentences ${((Date.now() - t0) / 1000).toFixed(0)}s] match ${l} ${section}: ${sh} of ${r.sections[section].classes} classes`)
    }
  }
  K.writeFile(Path.join(a.out, 'sentences.json'), JSON.stringify({ ...res, list }, null, 1) + '\n')
  const L = [`# reference sentences: ${list.length} distinct masked sentences (NEW side of the reference languages' reworded and added classes)`]
  L.push(`# text the fixture model holds, left out: ${res.modelText.length} (${res.modelText.map((x) => JSON.stringify(x.text.slice(0, 50))).join(', ')})`)
  for (const [s, b] of Object.entries(bySec)) L.push(`# ${s}: printed by one language ${b.single ? b.single.all : 0}: ${b.single ? Object.entries(b.single).filter(([k]) => 'all' !== k).map(([k, v]) => k + ' ' + v).join(', ') : '-'}`)
  for (const [s, b] of Object.entries(bySec)) L.push(`# ${s}: ${b.sentences} (accepted by hand only ${b.byHandOnly}, by stage-3a rule records only ${b.byRuleOnly}, both ${b.mixed}; template found ${b.template}; verdicts ok ${b.verdict.ok}, false ${b.verdict.false}, awkward ${b.verdict.awkward}, none ${b.verdict.none})`)
  if (res.match) for (const [l, x] of Object.entries(res.match)) L.push(`# matched from scratch, ${l}: ` + Object.entries(x).map(([s, y]) => `${s} ${y.matched} of ${y.classes} classes (${y.againstUnreviewed} against a sentence with no verdict)`).join('; '))
  for (const x of list.sort((p, q) => p.section.localeCompare(q.section) || q.langs.length - p.langs.length)) {
    L.push('', `[${x.id}] ${x.section} ${x.kind} | ${x.langs.length} language(s) ${x.langs.join(' ')}${x.single ? ' (' + x.single + ')' : ''}, ${x.classes} class(es) | accepted: ${Object.entries(x.by).map(([k, v]) => k + ' ' + v).join(', ')} | verdict: ${x.verdict || 'NONE'} | template: ${x.template ? `${x.template.file} (${x.template.n} of ${x.template.of} runs)` : 'not found'}`)
    L.push(`   masked:  ${x.masked}`)
    L.push(`   example: ${x.example.lang} ${x.example.where.split(':')[0]}: ${x.example.text}`)
  }
  K.writeFile(Path.join(a.out, 'sentences.txt'), L.join('\n') + '\n')
  if (a.json) { console.log(JSON.stringify(res, null, 1)); return }
  console.log(L.filter((l) => l.startsWith('#')).join('\n'))
  console.log(`-> ${Path.join(a.out, 'sentences.txt')}; verdicts go in ${Path.join(__dirname, 'reviewed', 'sentences.json')} ({ "sentences": { "<id>": { "verdict": "ok|false|awkward", "note": "..." } } })`)
}

main()
