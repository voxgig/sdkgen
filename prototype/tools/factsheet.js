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
  if (enumRows.length) attestEnums(enumRows, { a, ts, lang, sections, vars, allPairs, cache: a['enum-cache'] || Path.join(__dirname, 'review', 'enum') })
  for (const r of rows) if (r.attest && ('UNATTESTED' === r.attest.status || (r.enum && 'not judged' === r.attest.status))) {
    // a record may name the fact as the guard does (ref.facts.entityBy) or as the sheet does (ref.entityBy)
    const h = handFacts[r.path] || handFacts[leafPath(r.path)]
    if (h && JSON.stringify(h.value) === JSON.stringify(r.value) && ['why', 'evidence'].every((k) => h[k] && String(h[k]).trim())) r.attest.status = 'RECORDED'
    else if (h) r.attest.handProblem = JSON.stringify(h.value) !== JSON.stringify(r.value) ? `hand record is for ${JSON.stringify(h.value)}` : 'hand record needs "why" and "evidence"'
  }
  // A value a person decided (hand/<lang>.json facts) is the value: a provider
  // declaring another fails, whatever the OLD page says. This is what catches
  // a value moved back to the OLD page's convention (ocaml keys 'bare' ->
  // 'member', swift entityBy 'class' -> 'Name'), which the page comparison
  // attests. Not from scratch: no decision is read there.
  for (const r of rows) {
    const h = handFacts[r.path] || handFacts[leafPath(r.path)]
    if (h && 'value' in h && JSON.stringify(h.value) !== JSON.stringify(r.value)) r.attest = { status: 'UNATTESTED', detail: `hand/${lang}.json decided ${JSON.stringify(h.value)} (${String(h.why || '').slice(0, 80)}); the provider now declares ${JSON.stringify(r.value)}`, ex: r.attest && r.attest.ex }
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
  // an enumeration not judged fails as an unattested one does: a value the tools cannot judge is a person's to decide
  const unatt = att.filter((r) => 'UNATTESTED' === r.attest.status || (r.enum && 'not judged' === r.attest.status))
  const pinned = Object.entries(G.cited).filter(([, c]) => c.prose).map(([p]) => p)
  L.push('', `# ${rows.length} facts (${Object.entries(byAcc).map(([k, v]) => k + ' ' + v).join(', ')}), ${Object.keys(F.notes).length} notes; ${noAccount} with no account; ${rows.filter((r) => r.enum).length} enumerations; ${rows.filter((r) => !r.enum && 0 === r.n).length} printed facts substituted in no unit of these sections`)
  L.push(`# language and convention facts compared with the OLD page: ${att.length} (${Object.entries(byAtt).map(([k, v]) => k + ' ' + v).join(', ') || 'none'})${unatt.length ? '; UNATTESTED: ' + unatt.map((r) => r.path + ' = ' + JSON.stringify(r.value)).join(', ') : ''}`)
  L.push(`# cited facts ${Object.keys(G.cited).length}, of which PINNED prose ${pinned.length} (audit each): ${pinned.join(', ')}`)
  const file = Path.join(a.out, lang, 'facts.txt')
  K.writeFile(file, L.join('\n') + '\n')
  const summary = { lang, facts: rows.length, noAccount, attestation: byAtt, unattested: unatt.map((r) => ({ status: r.attest.status, path: r.path, value: r.value, account: r.account, enum: r.enum, detail: r.attest.detail, ex: r.attest.ex || null, handProblem: r.attest.handProblem || null })), cited: Object.keys(G.cited).length, pinned, override: F.override || null, scratch: !!a.scratch }
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

// Enumerated facts, judged by a MINIMAL PAIR. The sentences and blocks a
// value selects are the units of this language's pages that change when that
// fact alone takes another value (enumgen.js generates them from the clone's
// own provider, the fact set in memory). Each differing unit is set beside
// the OLD unit paired with it, and only the tokens that tell the two values'
// units apart are compared: OLD holds the value when it carries more of this
// value's own tokens than of the other's; it contradicts it the other way.
//   ATTESTED: held more often than contradicted;
//   UNATTESTED: otherwise contradicted (the OLD page reads as another value);
//   not judged: units differ but none has an OLD unit to compare with, or no
//     other value exists to compare: FAILS, like UNATTESTED, until
//     hand/<lang>.json records the fact at its value (why, evidence);
//   not printed: no unit of these pages depends on it.
// Why the cross-language reading it replaces passed wrong values: it took as
// "selected" every unit some reference of the same value printed and no
// reference of another value printed (mostly units the fact has nothing to do
// with), and called the fact attested on ONE such unit paired identically
// with OLD; perl `prints: record`, ocaml `keys: member` and swift `entityBy`
// were each attested that way (hundreds of units, a few identical).
function enumDomain(ts, path) {
  const dir = Path.join(ts, 'dist-test-scaffold/.sdk/dist/cmp')
  const vals = new Set()
  if (!Fs.existsSync(dir)) return vals
  for (const l of Fs.readdirSync(dir)) {
    const f = Path.join(dir, l, 'Syntax_' + l + '.js')
    if (!Fs.existsSync(f)) continue
    try { const F = Facts.load(ts, l); const x = F.facts.find((y) => y.path === path); if (x && 'string' === typeof x.value) vals.add(x.value) } catch (e) { }
  }
  return vals
}

function enumPages(ctx, path, value) {
  const { ts, lang } = ctx
  const dir = Path.join(ctx.cache, lang, path + '=' + value)
  const prov = Path.join(ts, 'dist-test-scaffold/.sdk/dist/cmp', lang, 'Syntax_' + lang + '.js')
  const st = (f) => { try { const x = Fs.statSync(f); return x.size + ':' + x.mtimeMs } catch (e) { return '-' } }
  const stamp = JSON.stringify({ ts, prov: st(prov), dist: st(Path.join(ts, 'dist', 'sdkgen.js')), ref: st(Path.join(ts, 'dist', 'cmp', 'ReadmeRef.js')), quick: st(Path.join(ts, 'dist', 'cmp', 'ReadmeQuick.js')), gen: st(Path.join(__dirname, 'enumgen.js')) })
  const sf = Path.join(dir, '.stamp')
  if (Fs.existsSync(sf) && Fs.readFileSync(sf, 'utf8') === stamp) return Fs.existsSync(Path.join(dir, '.failed')) ? null : dir
  Fs.rmSync(dir, { recursive: true, force: true })
  Fs.mkdirSync(dir, { recursive: true })
  const t0 = Date.now()
  try { CP.execFileSync(process.execPath, [Path.join(__dirname, 'enumgen.js'), dir, ts, lang, path, value], { stdio: 'pipe', maxBuffer: 1 << 26 }) }
  catch (e) { Fs.writeFileSync(Path.join(dir, '.failed'), String(e.stderr || e.message).split('\n').find((l) => /Error:/.test(l)) || 'generation failed'); Fs.writeFileSync(sf, stamp); return null }
  console.error(`[factsheet ${lang}] generated ${path}=${value} in ${((Date.now() - t0) / 1000).toFixed(0)}s (cached in ${dir})`)
  Fs.writeFileSync(sf, stamp)
  return dir
}

// Tokens that tell two renderings apart: code spans whole, words with the
// punctuation of a call or a member (`list()`, `->{id}`), other marks alone.
const etoks = (t) => (String(t).match(/`[^`]*`|[\w$:@%>{}.\-]+(?:\(\))?|\S/g) || []).filter((x) => /[A-Za-z]/.test(x))
function minus(a, b) { const m = new Map(); for (const x of b) m.set(x, (m.get(x) || 0) + 1); const out = []; for (const x of a) { if (m.get(x)) m.set(x, m.get(x) - 1); else out.push(x) } return out }
// +1: OLD holds this value's own tokens, not the other's; -1: the reverse; 0: neither, or both
function side(oldText, mine, theirs) {
  if (oldText === mine) return 1
  if (null != theirs && oldText === theirs) return -1
  const O = new Set(etoks(oldText)), A = etoks(mine), Bt = null == theirs ? [] : etoks(theirs)
  const da = minus(A, Bt), db = minus(Bt, A)
  const ha = da.length ? da.filter((x) => O.has(x)).length / da.length : 0, hb = db.length ? db.filter((x) => O.has(x)).length / db.length : 0
  return ha > hb ? 1 : hb > ha ? -1 : 0
}

// A block: the lines that tell the two values apart, each looked for whole
// in the OLD block (a field name or a bracket is in any OLD program, so
// tokens of whole blocks are no evidence)
const lnorm = (l) => l.trim().replace(/\s+/g, ' ')
function sideLines(oldCode, mine, theirs) {
  const O = new Set(oldCode.split('\n').map(lnorm).filter(Boolean))
  const A = mine.split('\n').map(lnorm).filter(Boolean), Bt = theirs.split('\n').map(lnorm).filter(Boolean)
  const da = minus(A, Bt), db = minus(Bt, A)
  const ha = da.filter((x) => O.has(x)).length, hb = db.filter((x) => O.has(x)).length
  return ha > hb ? 1 : hb > ha ? -1 : 0
}

function attestEnums(rows, ctx) {
  const { a, ts, lang, sections, vars, allPairs } = ctx
  const B = require('./blocks.js')
  const byNew = new Map()
  for (const p of allPairs) { const k = p.v + '\u0000' + p.section + '\u0000' + p.n.kind + '\u0000' + p.n.text; if (!byNew.has(k)) byNew.set(k, p) }
  for (const row of rows) {
    const others = [...enumDomain(ts, row.path)].filter((x) => x !== row.value)
    if (!others.length) { row.attest = { status: 'not judged', detail: 'no other value of this enumeration is declared in the clone, so nothing shows what it selects' }; continue }
    const tally = { held: 0, contra: 0, fresh: 0, units: 0, blocks: 0 }
    let exH = null, exC = null
    const cannot = []
    for (const w of others) {
      const W = enumPages({ ts, lang, cache: ctx.cache }, row.path, w)
      // a value this provider cannot print (it lacks a fact the value needs) selects nothing to compare
      if (!W) { cannot.push(w); continue }
      for (const section of sections) for (const v of vars) {
        const sv = C.loadSection(a.new, v, section, lang), sw = C.loadSection(W, v, section, lang)
        if (null == sv || null == sw) continue
        // prose: units of v's page that w's page holds otherwise or not at all
        const r = Ledger.pairSection(C.units(sv), C.units(sw), (x) => x)
        const sel = [...r.reworded.map((p) => [p.o, p.n]), ...r.missing.map((u) => [u, null])]
        for (const [u, uw] of sel) {
          if (!u.text || !/[A-Za-z]/.test(u.text)) continue
          tally.units++
          const p = byNew.get(v + '\u0000' + section + '\u0000' + u.kind + '\u0000' + u.text)
          const o = p && p.o
          if (!o) { tally.fresh++; continue }
          const sd = side(o.text, u.text, uw ? uw.text : null)
          const ex = { v, section, old: o.text, new: u.text + (uw ? '   [as ' + w + ': ' + uw.text + ']' : '   [as ' + w + ': no such unit]') }
          if (sd > 0) { tally.held++; exH = exH || ex } else if (sd < 0) { tally.contra++; exC = exC || ex } else tally.fresh++
        }
        // blocks: v's block against w's, each beside the OLD block paired with it
        const so = C.loadSection(a.old, v, section, lang)
        const Bv = C.blocks(sv), Bw = C.blocks(sw), Bo = so ? C.blocks(so) : []
        const vw = B.pairBlocks(Bv, Bw), ov = B.pairBlocks(Bo, Bv)
        const oOf = new Map(ov.pairs.map(([i, j]) => [j, i]))
        for (const [i, j] of vw.pairs) {
          if (Bv[i].code === Bw[j].code) continue
          tally.blocks++
          const oi = oOf.get(i)
          if (null == oi) { tally.fresh++; continue }
          const oc = Bo[oi].code
          const sd = sideLines(oc, Bv[i].code, Bw[j].code)
          const ex = { v, section, old: oc.split('\n').find((l, k) => l !== (Bv[i].code.split('\n')[k])) || oc.slice(0, 120), new: (Bv[i].code.split('\n').find((l, k) => l !== (Bw[j].code.split('\n')[k])) || '') + '   [as ' + w + ': ' + (Bw[j].code.split('\n').find((l, k) => l !== (Bv[i].code.split('\n')[k])) || '') + ']' }
          if (sd > 0) { tally.held++; exH = exH || ex } else if (sd < 0) { tally.contra++; exC = exC || ex } else tally.fresh++
        }
      }
    }
    const what = `minimal pair against ${others.filter((x) => !cannot.includes(x)).join(', ') || 'no value'}${cannot.length ? ' (' + cannot.join(', ') + ': this provider cannot print it)' : ''}: ${tally.units} prose units and ${tally.blocks} blocks differ; OLD reads as ${row.value} in ${tally.held}, as another value in ${tally.contra}, has nothing to compare in ${tally.fresh}`
    if (!tally.units && !tally.blocks) row.attest = { status: 'not printed', detail: `${what}: no unit of these pages depends on it` }
    // held outnumbers contradicted: the OLD page reads mostly as this value
    // (OLD pages were not consistent: ts wrote "`Ambient` entity instance" in
    // one place and the class in others), so a mixed one says so
    else if (tally.held > tally.contra) row.attest = { status: 'ATTESTED', detail: what + (tally.contra ? ' (mixed)' : ''), ex: exH }
    else if (tally.contra) row.attest = { status: 'UNATTESTED', detail: what + (tally.held ? ' (mixed: a person reads it)' : ''), ex: exC }
    else row.attest = { status: 'not judged', detail: `${what}: the units it selects have no OLD counterpart; a person decides (hand/${lang}.json facts)` }
  }
}

main()
