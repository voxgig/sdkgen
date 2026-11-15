// node handstale.js --clone <clone> --old <root> --new <root> --lang <l> [--hand <file>] [--json]
//
// A hand record stays decided when the text its reason quotes has changed.
// Every quotation in a record's `why` (and `where`, `true`, `evidence`) is
// checked: a code span `...`, and a double-quoted passage "..." of at least
// two words. A quotation is FOUND when it is on an OLD or a NEW page of the
// language (its README, its REFERENCE, the root README; any variation), or in
// the clone (ts/src, ts/project/.sdk, ts/model, ts/test: the text, or for a
// path, the file name). A record with a quotation found nowhere is STALE: the
// text it was decided on is gone, and a person decides it again.
// Fact records (`facts`) and `absent` reasons are checked the same way.
// Exit 1 on a stale record.
const Fs = require('node:fs')
const Path = require('node:path')
const C = require('./cut.js')
const K = require('./common.js')

const norm = (s) => String(s).replace(/\s+/g, ' ')

function walk(dir, out = []) {
  if (!Fs.existsSync(dir)) return out
  for (const e of Fs.readdirSync(dir, { withFileTypes: true })) {
    const p = Path.join(dir, e.name)
    if (e.isDirectory()) { if (!/^(node_modules|\.git|dist|dist-test|dist-test-scaffold)$/.test(e.name)) walk(p, out) } else out.push(p)
  }
  return out
}

const CORPUS = new Map()
function corpus(a, lang) {
  const k = [a.clone, a.old, a.new, lang].join('\0')
  if (CORPUS.has(k)) return CORPUS.get(k)
  const pages = []
  for (const root of [a.old, a.new]) for (const v of C.variationsOf(root)) for (const f of ['README.md', lang + '/README.md', lang + '/REFERENCE.md']) {
    const t = C.readIf(Path.join(root, v, f)); if (t) pages.push(t)
  }
  const ts = Path.join(Path.resolve(a.clone), 'ts')
  const src = [], names = new Set()
  for (const d of ['src', 'project/.sdk', 'model', 'test']) for (const f of walk(Path.join(ts, d))) {
    names.add(Path.basename(f))
    if (/\.(ts|js|md|aontu|json|go|py|rb|rs|c|h|zig|clj|ex|exs|lua|pm|pl|swift|ml|php|java|kt|scala|cs|cpp|hpp|txt)$/.test(f) && Fs.statSync(f).size < 2e6) src.push(Fs.readFileSync(f, 'utf8'))
  }
  const res = { pages: norm(pages.join('\n')), raw: pages.join('\n'), src: src.join('\n'), names }
  CORPUS.set(k, res)
  return res
}

// The quotations of a text: [{ q, kind }]
function quotes(text) {
  const out = []
  const s = String(text || '')
  for (const m of s.matchAll(/`([^`]+)`/g)) out.push({ q: m[1], kind: 'code' })
  for (const m of s.replace(/`[^`]*`/g, ' ').matchAll(/["“]([^"”]{3,200})["”]/g)) if (/\S+\s+\S+/.test(m[1])) out.push({ q: m[1], kind: 'text' })
  return out
}

// A quotation elided with "..." is its parts, each to be found.
function found(cp, q) {
  const parts = q.q.split(/\.\.\.|…/).map((s) => s.trim()).filter((s) => s.length >= 3)
  if (parts.length > 1 || parts.length && parts[0] !== q.q.trim()) return parts.every((p) => found1(cp, { ...q, q: p }))
  return found1(cp, q)
}
function found1(cp, q) {
  const t = q.q.trim()
  if (!t) return true
  if (cp.raw.includes(t) || cp.pages.includes(norm(t)) || cp.src.includes(t)) return true
  // a path with a line (`Main.fragment.ts:270-276`): the file exists in the clone
  const p = /^([\w./-]+\.[A-Za-z]+)(:\d+(-\d+)?(,\d+(-\d+)?)*)?$/.exec(t)
  if (p && cp.names.has(Path.basename(p[1]))) return true
  // a quoted page text may carry the page's own escapes or markup
  const plain = (x) => norm(x).replace(/\\\|/g, '|').replace(/[`*]/g, '')
  if (q.kind === 'text' && plain(cp.raw).includes(plain(t))) return true
  return false
}

function run(a) {
  const lang = a.lang
  const file = a.hand || Path.join(__dirname, 'hand', lang + '.json')
  const hand = Fs.existsSync(file) ? JSON.parse(Fs.readFileSync(file, 'utf8')) : {}
  const cp = corpus(a, lang)
  const res = { lang, file, records: 0, checkable: 0, quotes: 0, stale: [] }
  const look = (id, where, rec) => {
    res.records++
    const qs = ['why', 'where', 'true', 'evidence', 'value'].flatMap((k) => 'string' === typeof rec[k] ? quotes(rec[k]).map((q) => ({ ...q, field: k })) : [])
    if (!qs.length) return
    res.checkable++; res.quotes += qs.length
    const gone = qs.filter((q) => !found(cp, q))
    if (gone.length) res.stale.push({ id, where, outcome: rec.outcome || null, missing: gone.map((q) => q.q) })
  }
  for (const [id, rec] of Object.entries(hand)) if (/^[0-9a-f]{10}$/.test(id) && rec && 'object' === typeof rec) look(id, 'class', rec)
  for (const [p, rec] of Object.entries(hand.facts || {})) look(p, 'fact', rec)
  for (const [id, why] of Object.entries(hand.absent || {})) look(id, 'absent', { why })
  return res
}

function main() {
  const a = K.args(process.argv.slice(2))
  if (!a.clone || !a.old || !a.new || !a.lang) { console.error('usage: node handstale.js --clone <c> --old <r> --new <r> --lang <l> [--hand file] [--json]'); process.exit(2) }
  const r = run(a)
  if (a.json) console.log(JSON.stringify(r, null, 1))
  else {
    for (const s of r.stale) console.log(`STALE ${s.where} [${s.id}]${s.outcome ? ' ' + s.outcome : ''}: quotes ${s.missing.map((q) => JSON.stringify(q.slice(0, 80))).join(', ')}, on no OLD or NEW page of ${r.lang} and nowhere in the clone`)
    console.log(`hand records ${r.lang}: ${r.records}, ${r.checkable} quote text (${r.quotes} quotations), STALE ${r.stale.length}`)
  }
  process.exit(r.stale.length ? 1 : 0)
}

module.exports = { run, quotes }
if (require.main === module) main()
