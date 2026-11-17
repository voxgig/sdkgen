// node sharewords.js --clone <clone> --root <out-root> [--lang l1,..] [--section s,..] [--json]
//
// Sharing measured by sentence, with the masking of classify.js. For each
// language and section, over every variation of <root>, every unit the
// language prints (sentence, table cell, table header, heading, code comment)
// is ONE of:
//   note    - its text is part of one of the language's own notes;
//   shared  - masked with this language's declared facts (facts.js), it equals
//             a unit some OTHER language prints in the same variation and
//             section, masked with that language's facts;
//   only    - neither: a sentence only this language prints.
// Words are counted outside code spans (share.js's prosewords), and the
// three add up to the language's words. `--lang` sets the languages compared
// (default: the ported set for the section plus any language named).
// By source (the measure H1 asks for: prose a language's own files hold):
//   provider - words of the output that come from the provider's own string
//              literals: a unit that is part of a note (all its words), plus,
//              in any other unit, each occurrence of a prose-valued fact as
//              substituted into a shared sentence (`body.values` "a `String`,
//              or an IO that responds to `read`": 7 words; `ref.noun`
//              "Methods": 1), counted as the fact value's words outside code
//              spans and capped at the unit's words. Enumerations and the
//              naming hook's names are not prose and do not count.
//   all      - every word outside code spans of the section, as above.
// "only this language" is printed beside it and counts something else: a
// unit no other compared language prints, wherever its words were written
// (most are written once in shared code and selected by a result style).
// At the source: the words of each provider's notes, and of its other prose
// literals (share.js's sourceWords: a literal with three words in a row and
// no code punctuation), against the prose words of the shared sentence
// templates (string and template literals of runtimeprose.ts, ReadmeRef.ts,
// ReadmeQuick.ts and ReadmeRefFeatures.ts, `${...}` removed, same test).
const Fs = require('node:fs')
const Path = require('node:path')
const C = require('./cut.js')
const K = require('./common.js')
const Facts = require('./facts.js')
const { sourceWords } = require('./share.js')
const Ident = require('./ident.js')

const prosewords = (s) => C.words(String(s).replace(/`[^`]*`/g, ' '))
const flat = (s) => String(s).replace(/\s+/g, ' ').trim()

const TEMPLATES = ['ts/src/helpers/runtimeprose.ts', 'ts/src/cmp/ReadmeRef.ts', 'ts/src/cmp/ReadmeQuick.ts', 'ts/src/cmp/ReadmeRefFeatures.ts']

function templateWords(file) {
  if (!Fs.existsSync(file)) return null
  const src = Fs.readFileSync(file, 'utf8')
  let all = 0, prose = 0, lits = 0
  for (const m of src.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)) {
    const line = src.slice(src.lastIndexOf('\n', m.index) + 1, src.indexOf('\n', m.index))
    if (/^\s*(import|export \{|\/\/|\*)/.test(line)) continue
    const text = m[0].slice(1, -1).replace(/\$\{[^}]*\}/g, ' ')
    const w = prosewords(text).length
    all += w
    if (/[A-Za-z]{2,} [A-Za-z]{2,} [A-Za-z]{2,}/.test(text) && !/[;{}=]|=>|\(\)/.test(text)) { prose += w; lits++ }
  }
  return { allLiteralWords: all, proseWords: prose, proseLiterals: lits }
}

function main() {
  const a = K.args(process.argv.slice(2))
  const ts = Path.join(Path.resolve(a.clone), 'ts')
  const sections = K.list(a.section) || C.SECTIONS
  const named = K.list(a.lang) || []
  const vars = C.variationsOf(a.root).filter((v) => !K.list(a.vars) || K.list(a.vars).includes(v))
  // "the same sentence" is ident.js's identity (one template, one sentence,
  // whatever each language's tokens); --v32 counts with the v3.2 mask instead
  const I = a.v32 ? null : Ident.make({ clone: a.clone, old: a.old || Path.join(Path.dirname(Path.resolve(a.root)), 'old'), new: a.root })
  const res = {}
  for (const section of sections) {
    const langs = [...new Set([...(C.REG.ported[section] || []), ...named])]
    const F = Object.fromEntries(langs.map((l) => [l, Facts.load(ts, l)]))
    const M = Object.fromEntries(langs.map((l) => [l, Facts.masker(F[l], [a.root])]))
    const notesOf = Object.fromEntries(langs.map((l) => [l, Object.values(F[l].notes).map(flat)]))
    // prose-valued facts: a value with words outside code spans, as printed
    const proseFacts = Object.fromEntries(langs.map((l) => [l, F[l].facts
      // prose: a word at a slot shared code prints unquoted (noun, maps, ...),
      // or a value with a space and words outside its code spans (body.values)
      .filter((f) => !Facts.ENUM_PATHS.test(f.path) && !f.path.startsWith('layout.') && 0 < prosewords(f.value).length &&
        ((Facts.PROSE_SLOTS.has(f.path) && /^[A-Za-z]+$/.test(f.value)) || /\s/.test(f.value)))
      .map((f) => ({ path: f.path, value: flat(f.value), single: !/\s/.test(f.value), w: prosewords(f.value).length, re: new RegExp('(?<![A-Za-z0-9_])' + flat(f.value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_])', 'g') }))]))
    for (const v of vars) {
      const U = {}
      for (const l of langs) {
        const s = C.loadSection(a.root, v, section, l)
        U[l] = null == s ? [] : C.units(s).map((u) => ({ u, m: I ? I.identity(u.text, u.kind, l) : u.kind + '\u0000' + M[l](u.text, u.kind) }))
      }
      const who = new Map()
      for (const l of langs) for (const x of U[l]) { if (!who.has(x.m)) who.set(x.m, new Set()); who.get(x.m).add(l) }
      for (const l of langs) {
        if (named.length && !named.includes(l)) continue
        const r = ((res[l] = res[l] || {})[section] = res[l][section] || { units: 0, words: 0, shared: 0, only: 0, note: 0, provider: 0, providerFacts: 0, onlyEx: new Map(), factEx: new Map() })
        for (const x of U[l]) {
          const w = prosewords(x.u.text).length
          r.units++; r.words += w
          const ft = flat(x.u.text)
          if (ft.length > 8 && notesOf[l].some((n) => n.includes(ft))) { r.note += w; r.provider += w; continue }
          let fw = 0
          const bare = ft.replace(/`[^`]*`/g, ' ')
          // a match inside a code span (a signature in a heading) is code, not prose
          const outside = (t, re) => [...t.matchAll(re)].filter((m) => 0 === (t.slice(0, m.index).split('`').length - 1) % 2).length
          for (const f of proseFacts[l]) { const k = f.single ? (bare.match(f.re) || []).length : outside(ft, f.re); if (k) { fw += k * f.w; r.factEx.set(f.path, (r.factEx.get(f.path) || 0) + k * f.w) } }
          fw = Math.min(fw, w); r.provider += fw; r.providerFacts += fw
          if (who.get(x.m).size > 1) r.shared += w
          else { r.only += w; r.onlyEx.set(x.m, (r.onlyEx.get(x.m) || 0) + w) }
        }
      }
    }
  }
  const src = {}
  for (const l of Object.keys(res)) {
    const sw = sourceWords(Path.join(ts, 'project/.sdk/src/cmp', l, `Syntax_${l}.ts`))
    const nw = Object.values(Facts.load(ts, l).notes).reduce((n, t) => n + prosewords(t).length, 0)
    src[l] = { noteWords: nw, factTableProseWords: sw ? sw.tableProseWords : null, otherProseLiteralWords: sw ? sw.proseWordsElsewhere : null }
  }
  const tpl = Object.fromEntries(TEMPLATES.map((f) => [f, templateWords(Path.join(Path.resolve(a.clone), f))]))
  if (a.json) { for (const l of Object.keys(res)) for (const s of Object.keys(res[l])) { res[l][s].onlyEx = [...res[l][s].onlyEx.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5); res[l][s].factEx = Object.fromEntries(res[l][s].factEx) } console.log(JSON.stringify({ output: res, source: src, templates: tpl }, null, 1)); return }
  const pct = (x, t) => t ? (100 * x / t).toFixed(1) + '%' : '-'
  console.log(`sharewords over ${vars.length} variations of ${a.root}: words outside code spans of every unit (sentence, cell, header, heading, comment)`)
  console.log('lang    section     words |  shared sentence |   only this lang |            notes | BY SOURCE: provider literals (notes + prose facts)')
  for (const [l, ss] of Object.entries(res)) {
    const tot = { words: 0, only: 0, note: 0, provider: 0 }
    for (const [s, r] of Object.entries(ss)) {
    for (const k of Object.keys(tot)) tot[k] += r[k]
    console.log(`${l.padEnd(7)} ${s.padEnd(9)} ${String(r.words).padStart(7)} | ${String(r.shared).padStart(6)} ${pct(r.shared, r.words).padStart(8)} | ${String(r.only).padStart(6)} ${pct(r.only, r.words).padStart(8)} | ${String(r.note).padStart(6)} ${pct(r.note, r.words).padStart(8)} | ${String(r.provider).padStart(6)} ${pct(r.provider, r.words).padStart(8)} (facts ${r.providerFacts}: ${[...r.factEx.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([p, n]) => p + ' ' + n).join(', ') || '-'})`)
    if (a.examples) for (const [m, w] of [...r.onlyEx.entries()].sort((x, y) => y[1] - x[1]).slice(0, +a.examples)) console.log(`          only (${w} words): ${m.replace('\u0000', ': ').slice(0, 160)}`)
    }
    console.log(`${l.padEnd(7)} ALL       ${String(tot.words).padStart(7)} |                  | ${String(tot.only).padStart(6)} ${pct(tot.only, tot.words).padStart(8)} | ${String(tot.note).padStart(6)} ${pct(tot.note, tot.words).padStart(8)} | ${String(tot.provider).padStart(6)} ${pct(tot.provider, tot.words).padStart(8)}`)
  }
  console.log('\nat the source (words of literals; notes are each provider\'s `notes`, from the compiled provider)')
  for (const [l, x] of Object.entries(src)) console.log(`  ${l.padEnd(7)} notes ${x.noteWords} words; fact-table prose literals ${x.factTableProseWords}; other prose literals ${x.otherProseLiteralWords}`)
  let tp = 0, ta = 0
  for (const [f, x] of Object.entries(tpl)) { if (!x) { console.log(`  ${f}: absent`); continue } tp += x.proseWords; ta += x.allLiteralWords; console.log(`  shared ${f}: ${x.proseWords} words in ${x.proseLiterals} prose literals (${x.allLiteralWords} words in all literals)`) }
  console.log(`  shared templates total: ${tp} prose-literal words (${ta} in all literals)`)
}

main()
