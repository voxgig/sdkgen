// node pagecheck.js --new <root> --lang <l> [--section s,..] [--json]
//
// What a page itself determines, checked against the page. The match form
// and the sentence identity set numbers and the article before a mark aside
// (one template, one sentence), so a wrong number or a wrong article in an
// otherwise reviewed sentence matches it. These are checked here instead,
// on every NEW page of the language's ported sections, per variation:
//   STEPS     "these N steps" / "this step": N (or one) is the number of items
//             of the ordered list that follows it before the next heading;
//   HEADING   a numbered heading ("### 2. Load a planet") is numbered by its
//             place among the numbered headings under the same parent;
//   LIST      an ordered list counts 1, 2, 3 ... in the order it is printed;
//   ARTICLE   "a" or "an" agrees with the word after it (or, before a code
//             span, with the identifier it starts with), by how it is read:
//             a vowel sound takes "an"; an acronym is read letter by letter
//             ("an SDK", "a URL"); a word whose sound the rule cannot tell
//             (a symbol, a digit, "u" or "h" words outside the lists below)
//             is not judged and is counted as such.
// Exit 1 on any finding. Nothing is accepted by hand: a page that is wrong
// here is wrong.
const Fs = require('node:fs')
const Path = require('node:path')
const C = require('./cut.js')
const K = require('./common.js')

const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
const ORD = (n) => n + (1 === n % 10 && 11 !== n % 100 ? 'st' : 2 === n % 10 && 12 !== n % 100 ? 'nd' : 3 === n % 10 && 13 !== n % 100 ? 'rd' : 'th')

// "a" or "an" for a word, or null where the rule cannot tell
const LETTER_AN = /^[AEFHILMNORSX]/
function article(raw, code) {
  const w = String(raw).replace(/^[*_[(]+/, '')
  if (!/^[A-Za-z]/.test(w)) return null
  const word = (/^[A-Za-z][A-Za-z0-9]*/.exec(w) || [''])[0]
  // a single letter, or an acronym (HTTP, SDK, URL, ID, JSON2): read letter by letter
  // the null and boolean words are read as words, in code and prose ("a NULL-terminated array")
  if (/^(NULL|NIL|NONE|TRUE|FALSE|NAN)$/.test(word)) return 'a'
  // any other all-capital name in code may be read as a word or spelled: not judged
  if (code && /^[A-Z][A-Z0-9_]+$/.test(word)) return null
  if (1 === word.length || /^[A-Z]{2,}[0-9s]?$/.test(word)) return LETTER_AN.test(word.toUpperCase()) ? 'an' : 'a'
  const l = word.toLowerCase()
  if (/^(one|once)\b/.test(l) || /^(eu|ewe)/.test(l)) return 'a'
  if (/^[aeio]/.test(l)) return 'an'
  if (/^u/.test(l)) {
    if (/^(uni|use|usa|usi|usu|uti|ura|ure|uri|uro|ubi|uk$|url)/.test(l)) return 'a'
    if (/^u[^aeiou]/.test(l)) return 'an'
    return null
  }
  if (/^h/.test(l)) {
    if (/^(hour|honest|honou?r|heir)/.test(l)) return 'an'
    return 'a'
  }
  return 'a'
}

// the articles of a text, each with the word after it (a code span's identifier)
function articles(text) {
  const out = []
  const re = /(^|[^A-Za-z0-9_`'])(a|an|A|An)\s+(`[^`]*`|[*_[(]*[A-Za-z0-9][\w.-]*)/g
  let m
  while ((m = re.exec(text))) {
    let next = m[3]
    if (next.startsWith('`')) next = next.slice(1, -1).trim()
    out.push({ art: m[2].toLowerCase(), next, at: m.index + m[1].length, code: m[3].startsWith('`') })
  }
  return out
}

let a_nj = null
function checkSection(md, where) {
  const findings = [], counts = { steps: 0, headings: 0, lists: 0, articles: 0, notJudged: 0 }
  if (null == md) return { findings, counts }
  const lines = String(md).split('\n')
  let fence = false
  // numbered headings: per parent path, the numbers in order
  const path = [], numbered = new Map()
  // ordered lists: [{ start line, numbers }]
  const lists = []
  let cur = null
  // "these N steps" sentences waiting for their list
  let waiting = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (/^\s*```/.test(l)) { fence = !fence; continue }
    if (fence) continue
    const h = /^(#{1,6})\s+(.*)$/.exec(l)
    if (h) {
      if (cur) { lists.push(cur); cur = null }
      for (const w of waiting) findings.push({ kind: 'STEPS', where, line: w.line, text: w.text, why: `says ${w.n} step(s); no ordered list follows before the next heading` })
      waiting = []
      const lvl = h[1].length
      path.length = lvl - 1
      const parent = path.slice(0, lvl - 1).join(' > ')
      path[lvl - 1] = h[2].trim()
      const n = /^(\d+)\.\s/.exec(h[2])
      if (n) {
        counts.headings++
        const k = parent + '\u0000' + lvl
        const seen = (numbered.get(k) || 0) + 1
        numbered.set(k, seen)
        if (+n[1] !== seen) findings.push({ kind: 'HEADING', where, line: i + 1, text: h[2].trim(), why: `numbered ${n[1]}, but it is the ${ORD(seen)} numbered heading under "${parent || '(top)'}"` })
      }
      continue
    }
    const item = /^(\d+)\.\s/.exec(l)
    if (item) {
      if (!cur) { cur = { line: i + 1, nums: [], waiting }; waiting = [] }
      cur.nums.push(+item[1])
      continue
    }
    if (cur) {
      // a list goes on over indented continuation lines and blank lines before another item
      if (/^\s+\S/.test(l)) continue
      if ('' === l.trim()) { const nx = lines.slice(i + 1).find((x) => '' !== x.trim()); if (nx && /^\d+\.\s/.test(nx)) continue }
      lists.push(cur); cur = null
    }
    const s = /\b(?:these|the|all|following)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+steps?\b|\b(this|the following|one) step\b/i.exec(l)
    if (s) { counts.steps++; waiting.push({ line: i + 1, text: l.trim().slice(0, 100), n: s[1] ? (/^\d+$/.test(s[1]) ? +s[1] : WORDS[s[1].toLowerCase()]) : 1 }) }
  }
  if (cur) lists.push(cur)
  for (const w of waiting) findings.push({ kind: 'STEPS', where, line: w.line, text: w.text, why: `says ${w.n} step(s); no ordered list follows` })
  for (const L of lists) {
    counts.lists++
    const bad = L.nums.findIndex((n, k) => n !== k + 1)
    if (bad >= 0) findings.push({ kind: 'LIST', where, line: L.line, text: L.nums.join(','), why: `item ${bad + 1} of an ordered list is numbered ${L.nums[bad]}` })
    for (const w of L.waiting) if (w.n !== L.nums.length) findings.push({ kind: 'STEPS', where, line: w.line, text: w.text, why: `says ${w.n} step(s); the list that follows has ${L.nums.length} item(s)` })
  }
  // articles, in the prose units of the section (sentences, headings, cells, comments)
  for (const u of C.units(md)) {
    if (!/^(sentence|heading|cell|header|comment)$/.test(u.kind)) continue
    for (const x of articles(u.text)) {
      const want = article(x.next, x.code)
      if (null == want) { counts.notJudged++; if (a_nj) a_nj.push(x.art + ' ' + x.next); continue }
      counts.articles++
      if (want !== x.art) findings.push({ kind: 'ARTICLE', where, line: null, text: u.text.slice(Math.max(0, x.at - 30), x.at + 40), why: `"${x.art}" before ${x.code ? '`' + x.next.slice(0, 30) + '`' : '"' + x.next + '"'}, which takes "${want}"` })
    }
  }
  return { findings, counts }
}

function run(a) {
  const lang = a.lang
  const sections = K.list(a.section) || C.SECTIONS
  const findings = [], counts = { steps: 0, headings: 0, lists: 0, articles: 0, notJudged: 0 }
  for (const v of C.variationsOf(a.new)) for (const section of sections) {
    const r = checkSection(C.loadSection(a.new, v, section, lang), v + ' ' + section)
    findings.push(...r.findings)
    for (const k of Object.keys(counts)) counts[k] += r.counts[k]
  }
  return { lang, sections, findings, counts }
}

function main() {
  const a = K.args(process.argv.slice(2))
  if (!a.new || !a.lang) { console.error('usage: node pagecheck.js --new <root> --lang <l> [--section s,..] [--json]'); process.exit(2) }
  if (a['not-judged']) a_nj = []
  const r = run(a)
  if (a_nj) { const c = {}; for (const x of a_nj) c[x] = (c[x] || 0) + 1; console.log(Object.entries(c).sort((x, y) => y[1] - x[1]).map(([k, n]) => n + ' ' + k).join('\n')) }
  if (a.json) console.log(JSON.stringify(r, null, 1))
  else {
    console.log(`pagecheck ${r.lang}: ${r.findings.length} finding(s); checked ${r.counts.steps} step counts, ${r.counts.headings} numbered headings, ${r.counts.lists} ordered lists, ${r.counts.articles} articles (${r.counts.notJudged} not judged)`)
    for (const f of r.findings) console.log(`  ${f.kind} ${f.where}${f.line ? ':' + f.line : ''}: ${f.why} | ${f.text}`)
  }
  process.exit(r.findings.length ? 1 : 0)
}

module.exports = { run, article, articles, checkSection }
if (require.main === module) main()
