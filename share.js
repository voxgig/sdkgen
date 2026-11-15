// node share.js --root <out-root> --section <s> [--lang l1,l2,..] [--vars v,..]
//   [--providers <cmp-dir>] [--exclude <heading regex>] [--json] [--examples N]
//
// Across a set of languages, one side (run it on NEW and on OLD): which prose
// units every language prints, which at least three quarters print, which
// exactly one prints. Units are compared with code spans, the language's
// title, the SDK name and model names masked. Then language-supplied prose:
// at the output, the words (outside code spans) of units only that language
// prints; at the source, given --providers (the per-language component
// directory), the words in the string literals of each Syntax_<lang>.ts fact
// table and notes, and of any other prose-like literal in it.
const Fs = require('node:fs')
const Path = require('node:path')
const C = require('./cut.js')
const K = require('./common.js')

const prosewords = (s) => C.words(String(s).replace(/`[^`]*`/g, ' '))

function outputSharing(a, section, langs) {
  const vars = C.variationsOf(a.root).filter((v) => !K.list(a.vars) || K.list(a.vars).includes(v))
  const who = new Map() // masked unit -> Set(lang)
  const per = {}
  for (const lang of langs) {
    const mask = C.masker([a.root], lang)
    const p = per[lang] = { units: [], variations: 0 }
    for (const v of vars) {
      const s = C.loadSection(a.root, v, section, lang)
      if (null == s) continue
      p.variations++
      const ex = a.exclude ? new RegExp(a.exclude) : null
      for (const u of C.units(s)) {
        if (ex && ex.test(u.ctx + ' > ' + ('heading' === u.kind ? u.text : ''))) continue
        const m = u.kind + ':' + mask(u.text.replace(/`[^`]*`/g, '§'))
        p.units.push({ m, u })
        if (!who.has(m)) who.set(m, new Set())
        who.get(m).add(lang)
      }
    }
  }
  const n = langs.length, q = Math.ceil(0.75 * n)
  const res = {}
  for (const lang of langs) {
    const p = per[lang]
    const r = res[lang] = { variations: p.variations, units: p.units.length, words: 0, all: 0, allWords: 0, most: 0, mostWords: 0, some: 0, someWords: 0, alone: 0, aloneWords: 0, aloneDistinct: new Map() }
    for (const { m, u } of p.units) {
      const k = who.get(m).size, w = prosewords(u.text).length
      r.words += w
      if (k === n) { r.all++; r.allWords += w }
      else if (k >= q) { r.most++; r.mostWords += w }
      else if (k > 1) { r.some++; r.someWords += w }
      else { r.alone++; r.aloneWords += w; r.aloneDistinct.set(m, (r.aloneDistinct.get(m) || 0) + 1) }
    }
  }
  return { res, n, q }
}

// String literals in a provider: those inside the fact tables (`const facts`,
// `const refFacts`, anything named *notes*/*Notes*/*words*) and the rest.
function sourceWords(file) {
  if (!Fs.existsSync(file)) return null
  const src = Fs.readFileSync(file, 'utf8')
  const regions = []
  // a table wherever it is declared: a const, or a member of the provider object (`  notes: {`)
  for (const m of src.matchAll(/^\s*(?:export\s+)?(?:const\s+)?(\w*(?:[fF]acts|[nN]otes|[wW]ords)\w*)\b[^=\n]*[=:]\s*([{[])/gm)) {
    let depth = 0, i = m.index + m[0].length - 1
    for (; i < src.length; i++) { const c = src[i]; if ('{' === c || '[' === c) depth++; else if ('}' === c || ']' === c) { depth--; if (0 === depth) break } }
    regions.push([m.index, i, m[1]])
  }
  const lits = []
  const re = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g
  for (const m of src.matchAll(re)) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1
    const line = src.slice(lineStart, src.indexOf('\n', m.index))
    if (/^\s*(import|export \{)/.test(line) || /^\s*\/\//.test(line)) continue
    const text = m[0].slice(1, -1)
    const reg = regions.find(([s, e]) => m.index > s && m.index < e)
    const prose = /[A-Za-z]{2,} [A-Za-z]{2,} [A-Za-z]{2,}/.test(text.replace(/\$\{[^}]*\}/g, ' ')) && !/[;{}=]|=>|\(\)/.test(text)
    lits.push({ text, table: reg ? reg[2] : null, prose })
  }
  const w = (xs) => xs.reduce((n, x) => n + prosewords(x.text).length, 0)
  const inTables = lits.filter((x) => x.table)
  const proseElsewhere = lits.filter((x) => !x.table && x.prose)
  return {
    tables: [...new Set(regions.map((r) => r[2]))],
    tableLiterals: inTables.length, tableWords: w(inTables), tableProseWords: w(inTables.filter((x) => x.prose)),
    proseLiteralsElsewhere: proseElsewhere.length, proseWordsElsewhere: w(proseElsewhere),
    examples: [...inTables.filter((x) => x.prose), ...proseElsewhere].slice(0, 8).map((x) => x.text.slice(0, 120)),
  }
}

function main() {
  const a = K.args(process.argv.slice(2))
  if (!a.root || !a.section) { console.error('usage: node share.js --root <out-root> --section <tutorial|rootquick|reference> [--lang l1,..] [--vars v,..] [--providers <cmp-dir>] [--exclude <heading regex>] [--json] [--examples N]'); process.exit(2) }
  const langs = K.list(a.lang) || C.REG.ported[a.section]
  const { res, n, q } = outputSharing(a, a.section, langs)
  const ex = +(a.examples || 4)
  const out = {}
  for (const lang of langs) {
    const r = res[lang]
    const pct = (x, t) => t ? +(100 * x / t).toFixed(1) : 0
    out[lang] = {
      variations: r.variations, units: r.units,
      unitPct: { all: pct(r.all, r.units), most: pct(r.most, r.units), some: pct(r.some, r.units), alone: pct(r.alone, r.units) },
      words: r.words, wordPct: { all: pct(r.allWords, r.words), most: pct(r.mostWords, r.words), some: pct(r.someWords, r.words), alone: pct(r.aloneWords, r.words) },
      languageWordsAtOutput: r.aloneWords, aloneDistinct: r.aloneDistinct.size,
      aloneExamples: [...r.aloneDistinct.entries()].sort((x, y) => y[1] - x[1]).slice(0, ex).map(([m, k]) => `${k}x ${m.slice(0, 140)}`),
      source: a.providers ? sourceWords(Path.join(a.providers, lang, `Syntax_${lang}.ts`)) : undefined,
    }
  }
  if (a.json) { console.log(JSON.stringify({ section: a.section, root: a.root, langs, all: n, mostAtLeast: q, perLang: out }, null, 1)); return }
  console.log(`share ${a.section} over ${n} languages (${langs.join(' ')}), root ${a.root}`)
  console.log(`  units (words) printed by: all ${n} | at least ${q} | 2..${q - 1} | only this language   -- code spans, title, SDK and model names masked`)
  for (const [lang, x] of Object.entries(out)) {
    console.log(`  ${lang.padEnd(7)} ${String(x.units).padStart(6)} units ${String(x.unitPct.all).padStart(5)}% ${String(x.unitPct.most).padStart(5)}% ${String(x.unitPct.some).padStart(5)}% ${String(x.unitPct.alone).padStart(5)}% | ${String(x.words).padStart(6)} words ${String(x.wordPct.all).padStart(5)}% ${String(x.wordPct.most).padStart(5)}% ${String(x.wordPct.some).padStart(5)}% ${String(x.wordPct.alone).padStart(5)}% | language words at output ${x.languageWordsAtOutput} (${x.aloneDistinct} distinct units)` +
      (x.source ? ` | at source: fact/notes tables ${x.source.tables.join(',')} ${x.source.tableWords} words (${x.source.tableProseWords} in prose literals), other prose literals ${x.source.proseWordsElsewhere} words` : ''))
    for (const e of x.aloneExamples) console.log('          only: ' + e)
  }
}

module.exports = { outputSharing, sourceWords }
if (require.main === module) main()
