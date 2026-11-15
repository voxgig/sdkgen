// node factsheet.js --clone <clone> --old <root> --new <root> --lang <l> [--section s,..] [--out <dir>]
//
// review/<lang>/facts.txt: every declared fact of the language with its
// value; where shared sentences substitute it (how many units, and one
// example: the OLD unit beside the NEW one, or "(added)"); and its account.
// The account is read from the clone's guard report (SDKGEN_GUARD_REPORT=1
// on ts/dist-test/runtimefacts.test.js): a fact the report lists as
// unguarded has a blank account, one it does not list is "derived by the
// guard". A report line naming an account (`<lang> account <path>: <kind>`,
// kinds cited / language / convention) fills it in. `layout.*` facts are the
// naming hook's. A matched shared sentence says nothing about whether the
// fact in it is true: this sheet is what the reviewer audits.
//
// Attestation (a fact no runtime file can show is compared with the OLD page):
//   - every non-enumerated string fact whose account is `language` or
//     `convention`: the NEW units that carry its label, each with the OLD unit
//     it pairs with (identical, or the OLD side of its reworded pair). It is
//     ATTESTED when, in at least one such pair, the OLD unit, masked with the
//     same facts, holds the same label beside the same word (left or right
//     neighbour), in the same variation. A label shows only where the value
//     stands: OLD holding another value does not attest it.
//   - every enumerated fact (named, prints, entityBy, keys, ...) with such an
//     account: the sentences it selects are found among the reference
//     languages (units printed by a reference declaring the same value and by
//     none declaring another); it is ATTESTED when one NEW unit among them is
//     paired with an OLD unit that is identical or holds a word only that
//     value's sentences use. A value no reference declares selects sentences
//     no reference prints: each is left for a person, so it is not judged here.
//   - otherwise UNATTESTED, and the sheet fails until hand/<lang>.json holds
//     `facts: { "<path>": { value, why, evidence } }` at the current value
//     (why it differs from the old page, or why the old page has no such
//     sentence; and what shows it is right). `--scratch` ignores those records.
// Cited facts are listed with their file and quote; a cited fact whose value
// is prose (no quote can hold it, so its value is pinned) is marked PINNED:
// those are what the independent reviewer audits one by one.
const Fs = require('node:fs')
const Path = require('node:path')
const CP = require('node:child_process')
const C = require('./cut.js')
const K = require('./common.js')
const Facts = require('./facts.js')
const Ledger = require('./ledger.js')

function guardReport(ts, lang, cache) {
  const f = Path.join(ts, 'dist-test', 'runtimefacts.test.js')
  let out = ''
  if (cache && Fs.existsSync(cache)) out = Fs.readFileSync(cache, 'utf8')
  else {
    if (!Fs.existsSync(f)) return { ran: false, why: 'no ts/dist-test/runtimefacts.test.js in the clone' }
    try { out = CP.execFileSync(process.execPath, ['--test', '--test-name-pattern', 'account, per language', f], { cwd: ts, env: { ...process.env, SDKGEN_GUARD_REPORT: '1' }, stdio: 'pipe' }).toString() }
    catch (e) { out = String(e.stdout || '') }
    if (cache) K.writeFile(cache, out)
  }
  const res = { ran: true, unguarded: null, accounts: {}, cited: {} }
  // `<lang>: derived ...` opens a language's block; its cited lines follow:
  //   cited[ (prose: audit only)] <path> = <value json>
  //     <file>: <quote json>
  let cur = null, last = null
  for (const l of out.split('\n')) {
    const head = /^(?:#\s*)?([a-z]+): derived \d+/.exec(l)
    if (head) { cur = head[1]; last = null; continue }
    const ct = /^(?:#\s*)?\s+cited( \(prose: audit only\))? (\S+) = (.*)$/.exec(l)
    if (ct && cur === lang) { last = res.cited[ct[2]] = { prose: !!ct[1], value: ct[3], file: null, quote: null }; continue }
    const cq = /^(?:#\s*)?\s{4}(\S.*?): (".*)$/.exec(l)
    if (cq && last) { last.file = cq[1]; try { last.quote = JSON.parse(cq[2]) } catch (e) { last.quote = cq[2] } last = null; continue }
    const m = new RegExp('^(?:#\\s*)?\\s*' + lang + ': (\\d+) unguarded: (.*)$').exec(l)
    if (m) res.unguarded = m[2].split(', ').map((s) => s.trim())
    const a = new RegExp('^(?:#\\s*)?\\s*' + lang + ' account (\\S+): (\\S.*)$').exec(l)
    if (a) res.accounts[a[1]] = a[2]
  }
  if (null == res.unguarded && 0 < Object.keys(res.accounts).length) res.unguarded = []
  if (null == res.unguarded) { res.ran = false; res.why = 'the guard printed no report line for ' + lang }
  return res
}

// The guard's account names a leaf: facts.method.list, ref.facts.ctor[0].
function leafPath(path) {
  const p = path.split('.')
  const head = 'ref' === p[0] ? 'ref.facts' : 'facts'
  const rest = ('ref' === p[0] ? p.slice(1) : p).map((x) => /^\d+$/.test(x) ? '[' + x + ']' : '.' + x).join('')
  return head + rest
}

// The guard names a fact by its top-level key: facts.<k> or ref.facts.<k>.
function guardKey(path) {
  if (path.startsWith('layout.')) return null
  const p = path.split('.')
  return 'ref' === p[0] ? 'ref.facts.' + p[1] : 'facts.' + p[0]
}

// Tokens of a masked unit: labels whole, words, single punctuation.
const toks = (m) => String(m).replace(/(⟦[^⟧]*⟧)/g, ' $1 ').replace(/([^\s\w⟦⟧|.Ⓔ-Ⓩ])/g, ' $1 ').split(/\s+/).filter(Boolean)

// Whether the OLD masked unit holds `lab` in the place NEW holds it: beside
// the same left or right word, or as the whole unit.
function samePlace(mo, mn, lab) {
  const O = toks(mo), N = toks(mn)
  if (!O.includes(lab)) return false
  if (1 === N.length) return true
  for (let i = 0; i < N.length; i++) if (N[i] === lab) {
    for (let j = 0; j < O.length; j++) if (O[j] === lab) {
      if ((0 < i && 0 < j && N[i - 1] === O[j - 1]) || (i < N.length - 1 && j < O.length - 1 && N[i + 1] === O[j + 1])) return true
    }
  }
  return false
}

// Words of a masked text: lower-case letters only, 3 or more, outside labels.
const wordsOf = (m) => new Set((String(m).replace(/⟦[^⟧]*⟧/g, ' ').toLowerCase().match(/[a-z]{3,}/g) || []))

// The pairs of a section in one variation: [o, n] for identical and reworded
// units, [null, n] for an added one.
function pairsOf(O, N) {
  const r = Ledger.pairSection(O, N, (x) => x)
  const pairs = [...r.reworded.map((p) => [p.o, p.n])]
  const nUsed = new Set(r.added.concat(r.reworded.map((p) => p.n)))
  for (const u of N) if (!nUsed.has(u)) pairs.push([u, u])
  for (const u of r.added) pairs.push([null, u])
  return pairs
}

const ATTEST_ACCOUNT = /^(language|convention)\b/

function main() {
  const a = K.args(process.argv.slice(2), { out: Path.join(__dirname, 'review') })
  const lang = a.lang
  const ts = Path.join(Path.resolve(a.clone), 'ts')
  const F = Facts.load(ts, lang)
  if (!F.provider) { console.error(`factsheet: ${lang} has no compiled provider in ${ts}`); process.exit(1) }
  const mask = Facts.masker(F, [a.old, a.new])
  const sections = K.list(a.section) || C.SECTIONS
  const G = guardReport(ts, lang, a['guard-report'])
  const handFile = a.hand || Path.join(__dirname, 'hand', lang + '.json')
  const handFacts = a.scratch ? {} : ((Fs.existsSync(handFile) ? JSON.parse(Fs.readFileSync(handFile, 'utf8')) : {}).facts || {})
  const vars = K.variations(a)
  // where each label stands in NEW, with one OLD/NEW example; and every pair, masked
  const seen = new Map()
  const allPairs = []
  for (const section of sections) for (const v of vars) {
    const os = C.loadSection(a.old, v, section, lang), ns = C.loadSection(a.new, v, section, lang)
    if (null == ns) continue
    for (const [o, n] of pairsOf(C.units(os), C.units(ns))) {
      const m = mask(n.text, n.kind)
      const mo = o ? (o === n ? m : mask(o.text, o.kind)) : null
      allPairs.push({ v, section, o, n, m, mo })
      for (const lab of new Set(m.match(/⟦[^⟧]*⟧/g) || [])) {
        if (!seen.has(lab)) seen.set(lab, { n: 0, ex: null })
        const s = seen.get(lab); s.n++
        if (!s.ex || (o && o !== n && !s.ex.changed)) s.ex = { v, section, old: o ? o.text : '(added)', new: n.text, changed: !!o && o !== n }
      }
    }
  }
  const L = []
  L.push(`# facts ${lang}: ${F.facts.length} declared facts (provider ${Path.relative(ts, F.provider)}${F.override ? '; OVERRIDDEN by ' + F.override : ''})`)
  L.push(`# guard report: ${G.ran ? `ran (SDKGEN_GUARD_REPORT=1), ${G.unguarded.length} unguarded keys` : 'NOT AVAILABLE: ' + G.why}`)
  L.push('# columns: path | value | account | attestation | units in NEW that substitute it | example (variation section): OLD => NEW')
  L.push('# attestation, for a language or convention fact: ATTESTED (OLD holds the value in the same place), RECORDED (hand/<lang>.json), UNATTESTED (fails), not printed')
  const rows = []
  for (const f of F.facts) {
    const enumv = Facts.ENUM_PATHS.test(f.path)
    const gk = guardKey(f.path)
    let account = ''
    if (f.path.startsWith('layout.')) account = 'naming hook (generator function)'
    else if (G.accounts[leafPath(f.path)]) account = G.accounts[leafPath(f.path)]
    else if (G.accounts[f.path] || G.accounts[gk]) account = G.accounts[f.path] || G.accounts[gk]
    else if (G.ran) account = G.unguarded.includes(gk) ? '' : 'derived by the guard'
    const labs = [...seen.keys()].filter((l) => l.slice(1, -1).split('|').includes(f.path))
    const n = labs.reduce((x, l) => x + seen.get(l).n, 0)
    const ex = labs.map((l) => seen.get(l).ex).find((e) => e && e.changed) || (labs[0] && seen.get(labs[0]).ex)
    const row = { path: f.path, value: f.value, account, n, enum: enumv, ex, cite: G.cited[leafPath(f.path)] || null }
    if (ATTEST_ACCOUNT.test(account) && !enumv) attestValue(row, labs, allPairs)
    rows.push(row)
  }
  // enumerated facts: against the sentences the reference languages print under each value
  const enumRows = rows.filter((r) => r.enum && ATTEST_ACCOUNT.test(r.account))
  if (enumRows.length) attestEnums(enumRows, { a, ts, lang, sections, vars, allPairs })
  for (const r of rows) if (r.attest && 'UNATTESTED' === r.attest.status) {
    const h = handFacts[r.path]
    if (h && JSON.stringify(h.value) === JSON.stringify(r.value) && ['why', 'evidence'].every((k) => h[k] && String(h[k]).trim())) r.attest.status = 'RECORDED'
    else if (h) r.attest.handProblem = JSON.stringify(h.value) !== JSON.stringify(r.value) ? `hand record is for ${JSON.stringify(h.value)}` : 'hand record needs "why" and "evidence"'
  }
  for (const r of rows) {
    const at = r.attest ? ` | ${r.attest.status}${r.attest.detail ? ' (' + r.attest.detail + ')' : ''}${r.attest.handProblem ? '; ' + r.attest.handProblem : ''}` : ''
    L.push('', `${r.path} | ${JSON.stringify(r.value).slice(0, 120)} | ${r.account || '(none)'}${at} | ${r.enum ? 'enumeration: selects a sentence, not printed' : r.n + ' units'}`)
    if (r.cite) L.push(`   cited${r.cite.prose ? ' PINNED (prose: no quote holds it; the reviewer audits it)' : ''}: ${r.cite.file}: ${JSON.stringify(r.cite.quote).slice(0, 240)}`)
    const ex = r.attest && r.attest.ex ? r.attest.ex : r.ex
    if (ex) { L.push(`   e.g. (${ex.v} ${ex.section})`); L.push(`   OLD: ${String(ex.old).slice(0, 220)}`); L.push(`   NEW: ${String(ex.new).slice(0, 220)}`) }
  }
  if (Object.keys(F.notes).length) {
    L.push('', '# notes (static prose of this runtime alone; counted in every prose measure)')
    for (const [k, v] of Object.entries(F.notes)) {
      const c = G.cited['notes.' + k]
      L.push(`notes.${k} | ${JSON.stringify(v).slice(0, 200)} | ${G.accounts['notes.' + k] || '(none)'}`)
      if (c) L.push(`   cited${c.prose ? ' PINNED (prose: no quote holds it; the reviewer audits it)' : ''}: ${c.file}: ${JSON.stringify(c.quote).slice(0, 240)}`)
    }
  }
  const noteBlank = Object.keys(F.notes).filter((k) => !G.accounts['notes.' + k]).length
  const noAccount = rows.filter((r) => !r.account).length + noteBlank
  const byAcc = {}
  for (const r of rows) { const k = (r.account || 'none').split(/[ (]/)[0]; byAcc[k] = (byAcc[k] || 0) + 1 }
  const att = rows.filter((r) => r.attest)
  const byAtt = {}
  for (const r of att) byAtt[r.attest.status] = (byAtt[r.attest.status] || 0) + 1
  const unatt = att.filter((r) => 'UNATTESTED' === r.attest.status)
  const pinned = Object.entries(G.cited).filter(([, c]) => c.prose).map(([p]) => p)
  L.push('', `# ${rows.length} facts (${Object.entries(byAcc).map(([k, v]) => k + ' ' + v).join(', ')}), ${Object.keys(F.notes).length} notes; ${noAccount} with no account; ${rows.filter((r) => r.enum).length} enumerations; ${rows.filter((r) => !r.enum && 0 === r.n).length} printed facts substituted in no unit of these sections`)
  L.push(`# language and convention facts compared with the OLD page: ${att.length} (${Object.entries(byAtt).map(([k, v]) => k + ' ' + v).join(', ') || 'none'})${unatt.length ? '; UNATTESTED: ' + unatt.map((r) => r.path + ' = ' + JSON.stringify(r.value)).join(', ') : ''}`)
  L.push(`# cited facts ${Object.keys(G.cited).length}, of which PINNED prose ${pinned.length} (audit each): ${pinned.join(', ')}`)
  const file = Path.join(a.out, lang, 'facts.txt')
  K.writeFile(file, L.join('\n') + '\n')
  const summary = { lang, facts: rows.length, noAccount, attestation: byAtt, unattested: unatt.map((r) => ({ path: r.path, value: r.value, account: r.account, enum: r.enum, detail: r.attest.detail, ex: r.attest.ex || null, handProblem: r.attest.handProblem || null })), cited: Object.keys(G.cited).length, pinned, override: F.override || null, scratch: !!a.scratch }
  K.writeFile(Path.join(a.out, lang, 'facts.json'), JSON.stringify(summary, null, 1) + '\n')
  console.log(`factsheet ${lang}: ${rows.length} facts, ${noAccount} with no account, ${unatt.length} unattested${unatt.length ? ' (' + unatt.map((r) => r.path).join(', ') + ')' : ''}, guard report ${G.ran ? 'read' : 'not available'} -> ${file}`)
  // A fact with no account is a fact nobody checked; an unattested one is a
  // fact nothing compared: the review is not done.
  if (0 < noAccount || !G.ran || unatt.length) process.exitCode = 1
}

// A value fact, judged per context (each distinct masked NEW unit carrying
// its label): a context is held when one of its pairs has an OLD unit with
// the label in the same place; contradicted when it has OLD units and none
// holds it (OLD said something else there); new when every unit is added.
// ATTESTED: at least one context held and none contradicted. A value that is
// also an ordinary word elsewhere (`Fields`) is held by that word's own
// heading, so one held context alone cannot attest it.
function attestValue(row, labs, allPairs) {
  const carry = allPairs.filter((p) => labs.some((l) => p.m.includes(l)))
  if (!carry.length) { row.attest = { status: 'not printed', detail: 'no unit of these sections carries it' }; return }
  const ctx = new Map()
  for (const p of carry) {
    const k = p.n.kind + '\u0000' + p.m
    if (!ctx.has(k)) ctx.set(k, { held: null, paired: null, n: 0 })
    const c = ctx.get(k); c.n++
    if (!p.o) continue
    if (!c.paired) c.paired = p
    if (!c.held && labs.some((l) => p.m.includes(l) && samePlace(p.mo, p.m, l))) c.held = p
  }
  const cs = [...ctx.values()]
  const held = cs.filter((c) => c.held), contra = cs.filter((c) => !c.held && c.paired), fresh = cs.filter((c) => !c.paired)
  const exOf = (p) => ({ v: p.v, section: p.section, old: p.o ? p.o.text : '(added)', new: p.n.text })
  const ok = held.length > 0 && 0 === contra.length && 0 === fresh.length
  row.attest = {
    status: ok ? 'ATTESTED' : 'UNATTESTED',
    detail: `${cs.length} context(s): held ${held.length}, contradicted ${contra.length}, new ${fresh.length}; ${carry.length} units` + (contra.length ? `; OLD says otherwise in ${contra.length}` : held.length ? '' : '; OLD has no such sentence'),
    ex: contra.length ? exOf(contra[0].paired) : (fresh.length && !ok) ? exOf(carry.find((p) => p.m === [...ctx.keys()][cs.indexOf(fresh[0])].split('\u0000')[1]) || carry[0]) : held.length ? exOf(held[0].held) : exOf(carry[0]),
  }
}

// Enumerated facts: which sentences a value selects is read off the
// reference languages (ported.json for the section, less this one).
function attestEnums(rows, ctx) {
  const { a, ts, lang, sections, vars, allPairs } = ctx
  const per = new Map(rows.map((r) => [r.path, { carriers: [], ok: 0, paired: 0, refs: new Set(), ex: null }]))
  for (const section of sections) {
    const refs = (C.REG.ported[section] || []).filter((l) => l !== lang)
    const RF = Object.fromEntries(refs.map((r) => [r, Facts.load(ts, r)]))
    const RM = Object.fromEntries(refs.map((r) => [r, Facts.masker(RF[r], [a.old, a.new])]))
    const printed = Object.fromEntries(refs.map((r) => [r, new Set()]))
    for (const r of refs) for (const v of vars) for (const u of C.units(C.loadSection(a.new, v, section, r))) printed[r].add(u.kind + '\u0000' + RM[r](u.text, u.kind))
    for (const row of rows) {
      const valOf = (r) => { const f = RF[r].facts.find((x) => x.path === row.path); return f ? f.value : null }
      const same = refs.filter((r) => valOf(r) === row.value), other = refs.filter((r) => null != valOf(r) && valOf(r) !== row.value)
      const P = per.get(row.path)
      same.forEach((r) => P.refs.add(r))
      if (!same.length) continue
      const otherSet = new Set(other.flatMap((r) => [...printed[r]]))
      const markers = new Set(same.flatMap((r) => [...printed[r]]).filter((k) => !otherSet.has(k)))
      const otherWords = new Set([...otherSet].flatMap((k) => [...wordsOf(k.split('\u0000')[1])]))
      const vWords = new Set([...markers].flatMap((k) => [...wordsOf(k.split('\u0000')[1])]).filter((w) => !otherWords.has(w)))
      for (const p of allPairs.filter((x) => x.section === section)) {
        if (!markers.has(p.n.kind + '\u0000' + p.m)) continue
        P.carriers.push(p)
        if (!p.o) continue
        P.paired++
        const ow = wordsOf(p.mo)
        if (p.o === p.n || p.o.text === p.n.text || [...ow].some((w) => vWords.has(w))) { P.ok++; if (!P.ex) P.ex = { v: p.v, section, old: p.o.text, new: p.n.text } }
      }
    }
  }
  for (const row of rows) {
    const P = per.get(row.path)
    if (!P.refs.size) { row.attest = { status: 'not judged', detail: 'no reference language declares this value: every sentence it selects is new to the references and left for a person' }; continue }
    if (!P.carriers.length) { row.attest = { status: 'not printed', detail: `prints none of the sentences only ${[...P.refs].join(', ')} (the same value) print` }; continue }
    const first = P.carriers.find((p) => p.o) || P.carriers[0]
    row.attest = {
      status: P.ok ? 'ATTESTED' : 'UNATTESTED',
      detail: P.ok ? `${P.ok} of ${P.carriers.length} units it selects (as ${[...P.refs].join(', ')}) pair with OLD units that use them` : `${P.carriers.length} units it selects (the sentences of ${[...P.refs].join(', ')}); ${P.paired} paired with OLD units, none identical or using a word only this value's sentences use`,
      ex: P.ex || { v: first.v, section: first.section, old: first.o ? first.o.text : '(added)', new: first.n.text },
    }
  }
}

main()
