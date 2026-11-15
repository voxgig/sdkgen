// Arguments, the classification file, and pairing helpers shared by the tools.
const Fs = require('node:fs')
const Path = require('node:path')
const Crypto = require('node:crypto')
const C = require('./cut.js')

function args(argv, defaults = {}) {
  const a = { ...defaults, _: [] }
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]
    if (x.startsWith('--')) {
      const k = x.slice(2)
      const v = argv[i + 1]
      if (null == v || v.startsWith('--')) a[k] = true
      else { a[k] = v; i++ }
    } else a._.push(x)
  }
  return a
}

const list = (v) => null == v || true === v ? null : String(v).split(',').map((s) => s.trim()).filter(Boolean)

// Languages and sections to run: from the arguments, else the registry.
function plan(a) {
  const sections = list(a.section) || C.SECTIONS
  const langs = list(a.lang)
  const out = []
  for (const s of sections) {
    const ported = C.REG.ported[s] || []
    for (const l of langs || ported) {
      if (!langs && !ported.includes(l)) continue
      out.push({ section: s, lang: l, ported: ported.includes(l) })
    }
  }
  return out
}

function variations(a) {
  const want = list(a.vars)
  const vs = C.variationsOf(a.new).filter((v) => Fs.existsSync(Path.join(a.old, v)))
  return want ? vs.filter((v) => want.includes(v)) : vs
}

const classId = (kind, key) => Crypto.createHash('sha1').update(kind + '\u0000' + key).digest('hex').slice(0, 10)

// The outcomes a reviewer may record. `defect:` marks a class found wrong;
// it counts as reviewed, and the tool still fails until it is fixed.
// `shared:<lang>:<id>`: the unit is, exactly once masked, a sentence a
// reference language prints and whose class is reviewed there (classify.js
// writes it; nobody types it). `contradiction`: an echo whose other statement
// disagrees; it needs `where` (the other statement), `true` (which side is
// true) and `evidence`, and is counted, not failed.
const OUTCOME = /^(same-meaning|restored:(shared|fact|printer|note)|correction:[A-Za-z0-9_./-]+|unification:[A-Za-z0-9_ ./-]+|dropped|defect|contradiction|shared:[a-z]+:[0-9a-f]{10})$/

function loadClasses(file) {
  if (!file || !Fs.existsSync(file)) return {}
  const raw = JSON.parse(Fs.readFileSync(file, 'utf8'))
  const out = {}
  for (const [id, e] of Object.entries(raw)) {
    if (!/^[0-9a-f]{10}$/.test(id)) throw new Error(`${file}: "${id}" is not a class id; a class is named by its id, never by a section or a pattern`)
    if (!OUTCOME.test(e.outcome || '')) throw new Error(`${file}: ${id}: outcome "${e.outcome}" is not one of same-meaning, restored:shared|fact|printer|note, correction:<id>, unification:<name>, dropped, defect`)
    if (/^(dropped|defect)$/.test(e.outcome) && !(e.why && e.why.trim())) throw new Error(`${file}: ${id}: ${e.outcome} needs a "why"`)
    if ('contradiction' === e.outcome && !['where', 'true', 'evidence'].every((k) => e[k] && String(e[k]).trim())) throw new Error(`${file}: ${id}: contradiction needs "where", "true" and "evidence"`)
    out[id] = e
  }
  return out
}

// Word multiset similarity (Dice), on masked lower-case words.
function bag(s) {
  const m = new Map()
  for (const w of String(s).toLowerCase().match(/[a-z0-9ⓔⓕⓢⓛⓝ_§]+|[^\sa-z0-9]/g) || []) m.set(w, (m.get(w) || 0) + 1)
  return m
}
function dice(a, b) {
  let n = 0, A = 0, B = 0
  for (const v of a.values()) A += v
  for (const v of b.values()) B += v
  for (const [k, v] of a) if (b.has(k)) n += Math.min(v, b.get(k))
  return A + B ? 2 * n / (A + B) : 0
}

function writeFile(p, text) { Fs.mkdirSync(Path.dirname(p), { recursive: true }); Fs.writeFileSync(p, text) }

module.exports = { args, list, plan, variations, classId, loadClasses, OUTCOME, bag, dice, writeFile }
