// node blocks.js --old <root> --new <root> [--lang l1,l2] [--section s1,s2]
//   [--vars v,..] [--normalizers <dir>] [--classes <dir>] [--counts <dir>] [--record-counts] [--out <dir>] [--template] [--json]
//
// Each OLD code block against the NEW block that stands where it stood (same
// heading path, same position under it): byte-identical; identical after the
// named corrections; identical after a named unification; changed otherwise.
// The normalizers come from ONE source: normalizers.js (shared, no language
// list) and normalizers/<lang>.js (that language's own). Only a pair changed
// otherwise becomes a class, with its diff written out, classified in
// <classes>/<lang>.json. Then the identifiers of the section's code: novel in
// NEW, vanished, and identifiers whose shape around a model name is new
// (`utilitys`). A changed block in a language with no compiler on PATH is
// counted UNVERIFIED. Exit 1 when a class is unclassified or marked defect.
const Fs = require('node:fs')
const Path = require('node:path')
const C = require('./cut.js')
const K = require('./common.js')
const CP = require('node:child_process')

// Whether a compiler for the language is on PATH now (the registry names the command).
function toolchainHere(lang) {
  for (const c of (C.REG.toolchain || {})[lang] || []) {
    try { CP.execSync(`command -v ${c}`, { stdio: 'ignore', shell: '/bin/bash' }); return c } catch (e) { }
  }
  return null
}

// The normalizers that apply to a language: the shared ones (normalizers.js,
// no language list) and the language's own (normalizers/<lang>.js), in order.
function loadNormalizers(lang, dir) {
  const N = require('./normalizers.js')
  const own = Path.join(dir || Path.join(__dirname, 'normalizers'), lang + '.js')
  const mine = Fs.existsSync(own) ? require(own) : []
  for (const x of [...N.SHARED, ...mine]) {
    if (!x.id || !/^(correction|unification)$/.test(x.kind) || !(x.undoes && x.undoes.trim()) || !(x.keys instanceof RegExp) || 'function' !== typeof x.undo || 'number' !== typeof x.order) throw new Error(`normalizer ${x.id || '?'} (${own}): needs id, order, kind correction|unification, undoes, keys, undo`)
    if (x.langs) throw new Error(`normalizer ${x.id}: a language list is not allowed; put a language's own normalizer in normalizers/<lang>.js`)
  }
  return { list: [...N.SHARED.map((x) => ({ ...x, from: 'shared' })), ...mine.map((x) => ({ ...x, from: lang }))].sort((a, b) => a.order - b.order), keys: N.KEYS }
}

// An OLD/NEW pair: 'corrected' or 'unified' (with the normalizers used), or null.
function explainPair(norm, section, o, n) {
  for (const k of norm.keys[section]) {
    let a = o, b = n
    const used = []
    for (const c of norm.list) {
      if ('correction' !== c.kind || !c.keys.test(k)) continue
      const a2 = c.undo(a, 'old', n), b2 = c.undo(b, 'new', o)
      if (a2 !== a || b2 !== b) used.push(c.id)
      a = a2; b = b2
    }
    if (a.trim() === b.trim()) return { kind: 'corrected', used }
    for (const u of norm.list) {
      if ('unification' !== u.kind || !u.keys.test(k)) continue
      const a2 = u.undo(a, 'old', n), b2 = u.undo(b, 'new', o)
      if (a2 !== a || b2 !== b) used.push(u.id)
      a = a2; b = b2
    }
    if (a.trim() === b.trim()) return { kind: 'unified', used }
  }
  return null
}

// The line diff of two blocks (LCS), as -/+/space lines.
function diff(a, b) {
  const A = a.split('\n'), B = b.split('\n')
  const n = A.length, m = B.length
  const T = Array.from({ length: n + 1 }, () => new Int32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) T[i][j] = A[i] === B[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1])
  const out = []
  let i = 0, j = 0
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { out.push(' ' + A[i]); i++; j++ }
    else if (i < n && (j === m || T[i + 1][j] >= T[i][j + 1])) { out.push('-' + A[i]); i++ }
    else { out.push('+' + B[j]); j++ }
  }
  return out
}

// Where a block stands: its heading path; then the same path with step
// numbers dropped (a renumbered step); then with each signature in a heading
// cut to its function name (a corrected parameter list); then, for what is
// left, document order.
const AT = [(b) => b.at, (b) => b.at.replace(/(^|> )\d+\.\s+/g, '$1'),
  (b) => b.at.replace(/(^|> )\d+\.\s+/g, '$1').replace(/`[^`(]*?([\w$:-]+)\s*\([^`]*`/g, '`$1`'),
  // a signature with no parenthesis (OCaml's `e_load reqmatch ctrl : entity_obj`):
  // cut to its first identifier, after the cut above has made `e_load (value) ...` `e_load`
  (b) => b.at.replace(/(^|> )\d+\.\s+/g, '$1').replace(/`[^`(]*?([\w$:-]+)\s*\([^`]*`/g, '`$1`').replace(/`([A-Za-z_][\w$.]*)\s[^`(]*`/g, '`$1`'),
  // the last heading alone: an entity heading that changed (a collision rename)
  (b) => b.at.split(' > ').pop().replace(/^\d+\.\s+/, '').replace(/`[^`(]*?([\w$:-]+)\s*\([^`]*`/g, '`$1`')]
function pairBlocks(O, N) {
  const pairs = [], oUsed = new Set(), nUsed = new Set()
  for (const keyOf of AT) {
    const byAt = (xs, used) => { const m = new Map(); xs.forEach((b, k) => { if (used.has(k)) return; const at = keyOf(b); if (!m.has(at)) m.set(at, []); m.get(at).push(k) }); return m }
    const oa = byAt(O, oUsed), na = byAt(N, nUsed)
    for (const [at, os] of oa) {
      const ns = na.get(at) || []
      // identical blocks under the same heading first, then by position
      for (const i of os) { const j = ns.find((j) => !nUsed.has(j) && N[j].code === O[i].code); if (null != j) { pairs.push([i, j]); oUsed.add(i); nUsed.add(j) } }
      // then the most alike, so a heading two entities share (a class-name collision) pairs like with like
      const cand = []
      for (const i of os) if (!oUsed.has(i)) for (const j of ns) if (!nUsed.has(j)) cand.push([K.dice(K.bag(O[i].code), K.bag(N[j].code)), i, j])
      cand.sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2] - b[2])
      for (const [, i, j] of cand) if (!oUsed.has(i) && !nUsed.has(j)) { pairs.push([i, j]); oUsed.add(i); nUsed.add(j) }
    }
  }
  const ro = O.map((b, i) => i).filter((i) => !oUsed.has(i)), rn = N.map((b, j) => j).filter((j) => !nUsed.has(j))
  const k = Math.min(ro.length, rn.length)
  for (let x = 0; x < k; x++) pairs.push([ro[x], rn[x]])
  return { pairs, oLeft: ro.slice(k), nLeft: rn.slice(k) }
}

function run(a, section, lang) {
  const mask = C.masker([a.old, a.new], lang, { learn: false })
  const norm = loadNormalizers(lang, a.normalizers)
  const vars = K.variations(a)
  const tally = { variations: 0, oldBlocks: 0, newBlocks: 0, identical: 0, corrected: 0, unified: 0, changed: 0, oldOnly: 0, newOnly: 0 }
  const used = {}
  const classes = new Map()
  const diffs = []
  const oTok = new Map(), nTok = new Map()
  const note = (m, t, v, at) => { if (!m.has(t)) m.set(t, { n: 0, v, at }); m.get(t).n++ }
  const add = (type, key, show, v, at) => {
    const id = K.classId(section + '/block-' + type, key)
    if (!classes.has(id)) classes.set(id, { id, type, kind: 'block', key, show, n: 0, vars: new Set(), where: `${v}: ${at}` })
    const c = classes.get(id); c.n++; c.vars.add(v)
    ;(c.occ = c.occ || []).push({ v, show })
    return id
  }
  for (const v of vars) {
    const os = C.loadSection(a.old, v, section, lang), ns = C.loadSection(a.new, v, section, lang)
    if (null == os && null == ns) continue
    tally.variations++
    const O = C.blocks(os), N = C.blocks(ns)
    tally.oldBlocks += O.length; tally.newBlocks += N.length
    for (const b of O) for (const t of C.tokens(b.code)) note(oTok, t, v, b.at)
    for (const b of N) for (const t of C.tokens(b.code)) note(nTok, t, v, b.at)
    const { pairs, oLeft, nLeft } = pairBlocks(O, N)
    for (const [i, j] of pairs) {
      const o = O[i].code, n = N[j].code
      if (o === n) { tally.identical++; continue }
      const e = explainPair(norm, section, o, n)
      if (e) { tally[e.kind]++; for (const w of e.used) used[w] = (used[w] || 0) + 1; continue }
      tally.changed++
      const d = diff(o, n)
      const key = d.filter((l) => ' ' !== l[0]).map((l) => l[0] + mask(l.slice(1)).trim()).join('\n')
      const id = add('changed', key, d.filter((l) => ' ' !== l[0]).slice(0, 40), v, O[i].at)
      diffs.push(`=== [${id}] ${v} :: ${O[i].at} #${O[i].n}\n` + d.join('\n'))
    }
    for (const i of oLeft) { tally.oldOnly++; const id = add('old-only', mask(O[i].code), O[i].code.split('\n').slice(0, 20).map((l) => '-' + l), v, O[i].at); diffs.push(`=== [${id}] ${v} :: ${O[i].at} #${O[i].n}  OLD block with no NEW block here\n` + O[i].code) }
    for (const j of nLeft) { tally.newOnly++; const id = add('new-only', mask(N[j].code), N[j].code.split('\n').slice(0, 20).map((l) => '+' + l), v, N[j].at); diffs.push(`=== [${id}] ${v} :: ${N[j].at} #${N[j].n}  NEW block with no OLD block here\n` + N[j].code) }
  }
  const V = C.vocab([a.old, a.new])
  const isModel = (t) => V.entities.some((e) => t.toLowerCase().includes(e.toLowerCase())) || V.fields.includes(t) || V.sdk.some((s) => t.includes(s))
  for (const [t, x] of nTok) if (!oTok.has(t) && !isModel(t)) add('novel-token', t, [`+${t}  (${x.n} times)`], x.v, x.at)
  for (const [t, x] of oTok) if (!nTok.has(t) && !isModel(t)) add('vanished-token', t, [`-${t}  (${x.n} times)`], x.v, x.at)
  const oshape = new Set([...oTok.keys()].filter(isModel).map(mask))
  const nshape = new Map()
  for (const [t, x] of nTok) if (isModel(t) && !oshape.has(mask(t))) { const k = mask(t); if (!nshape.has(k)) nshape.set(k, { ts: new Set(), n: 0, v: x.v, at: x.at }); const s = nshape.get(k); s.ts.add(t); s.n += x.n }
  for (const [k, s] of nshape) add('novel-shape', k, [`+${k}: ${[...s.ts].slice(0, 6).join(', ')}  (${s.n} times)`], s.v, s.at)
  return { section, lang, tally, used, normalizers: norm.list.map((c) => c.id), classes: [...classes.values()], diffs }
}

function render(r, decided) {
  const t = r.tally
  const L = [`# blocks ${r.lang} ${r.section}: ${t.variations} variations, OLD ${t.oldBlocks} blocks, NEW ${t.newBlocks}`,
    `# identical ${t.identical}, identical after named corrections ${t.corrected}, changed by a named unification ${t.unified}, changed otherwise ${t.changed}, OLD-only ${t.oldOnly}, NEW-only ${t.newOnly}`,
    `# normalizers used (pairs): ${JSON.stringify(r.used)}`]
  for (const type of ['changed', 'old-only', 'new-only', 'novel-shape', 'novel-token', 'vanished-token']) {
    const cs = r.classes.filter((c) => c.type === type).sort((a, b) => b.n - a.n)
    if (!cs.length) continue
    L.push('', `## ${type}: ${cs.length} classes`)
    for (const c of cs) {
      const d = decided[c.id]
      L.push(`[${c.id}] ${d ? d.outcome + (d.why ? ' (' + d.why + ')' : '') : 'UNCLASSIFIED'}  x${c.n} in ${c.vars.size} var  @ ${c.where}`)
      for (const l of c.show) L.push('   ' + l)
    }
  }
  return L.join('\n') + '\n'
}

function main() {
  const a = K.args(process.argv.slice(2), { classes: Path.join(__dirname, 'classes'), out: Path.join(__dirname, 'review') })
  if (!a.old || !a.new) { console.error('usage: node blocks.js --old <root> --new <root> [--lang l] [--section s] [--vars v,..] [--normalizers dir] [--classes dir] [--out dir] [--template] [--json]'); process.exit(2) }
  let bad = 0
  const json = []
  // portcheck passes the sections it found ported, from the registry or read
  // off the clone: those are ported whatever ported.json lists
  const given = K.list(a.ported)
  for (const p0 of K.plan(a)) {
    const { section, lang } = p0
    const ported = p0.ported || !!(given && given.includes(section))
    const r = run(a, section, lang)
    const decided = K.loadClasses(Path.join(a.classes, lang + '.json'))
    let un = 0, defect = 0
    const byType = {}
    for (const c of r.classes) {
      byType[c.type] = (byType[c.type] || 0) + 1
      const d = decided[c.id]
      if (d && null != d.n && d.n !== c.n) { d.outcome = 'RECOUNT'; d.why = `classified at x${d.n}, now x${c.n}` }
      if (!d || 'RECOUNT' === d.outcome) un++; else if ('defect' === d.outcome) defect++
    }
    // How many pairs each normalizer explains is recorded per language
    // (counts/<lang>.json, written by `--record-counts`, a person's step like
    // classifying): a regression that undoes a correction in NEW, leaving the
    // pair explained by the others, shows only as a changed count.
    const cfile = Path.join(a.counts || Path.join(__dirname, 'counts'), lang + '.json')
    const crec = Fs.existsSync(cfile) ? JSON.parse(Fs.readFileSync(cfile, 'utf8')) : {}
    const cur = { corrected: r.tally.corrected, unified: r.tally.unified, used: Object.fromEntries(Object.entries(r.used).sort()) }
    let countNote = null
    if (a['record-counts']) { crec[section] = cur; K.writeFile(cfile, JSON.stringify(crec, null, 1) + '\n') }
    else if (!crec[section]) { if (cur.corrected + cur.unified) { un++; countNote = `normalizer counts not recorded (${cfile}): review the pairs, then --record-counts` } }
    else if (JSON.stringify(crec[section]) !== JSON.stringify(cur)) {
      un++
      const was = crec[section]
      const d = [...new Set([...Object.keys(was.used || {}), ...Object.keys(cur.used)])].filter((k) => (was.used || {})[k] !== cur.used[k]).map((k) => `${k} ${(was.used || {})[k] || 0}->${cur.used[k] || 0}`)
      countNote = `normalizer counts changed: corrected ${was.corrected}->${cur.corrected}, unified ${was.unified}->${cur.unified}; ${d.join(', ')}`
    }
    const f = Path.join(a.out, lang, section + '.blocks.txt')
    K.writeFile(f, render(r, decided))
    K.writeFile(Path.join(a.out, lang, section + '.blocks.diff'), r.diffs.join('\n\n') + '\n')
    if (a.template) {
      const tmpl = {}
      for (const c of r.classes) if (!decided[c.id]) tmpl[c.id] = { outcome: '', why: '', n: c.n, type: 'block-' + c.type, text: c.show.join('\n').slice(0, 400) }
      K.writeFile(Path.join(a.out, lang, section + '.blocks.template.json'), JSON.stringify(tmpl, null, 1) + '\n')
    }
    const t = r.tally
    const tc = toolchainHere(lang)
    if (!a.json && countNote) console.log(`  RECOUNT ${lang} ${section}: ${countNote}`)
    if (!a.json) console.log(`blocks ${lang.padEnd(7)} ${section.padEnd(9)} ${ported ? '' : '(unported) '}vars ${t.variations} | OLD ${t.oldBlocks} NEW ${t.newBlocks}: identical ${t.identical}, corrected ${t.corrected}, unified ${t.unified}, otherwise ${t.changed}${t.corrected + t.unified + t.changed + t.newOnly ? (tc ? ' (compiler here: ' + tc + ')' : ` (UNVERIFIED: ${t.corrected + t.unified + t.changed + t.newOnly} changed blocks, no ${C.REG.toolchain[lang].join('/')} here)`) : ''}, OLD-only ${t.oldOnly}, NEW-only ${t.newOnly} | classes ${r.classes.length} (${Object.entries(byType).map(([k, v]) => k + ' ' + v).join(', ')}) | unclassified ${un}, defect ${defect} -> ${Path.relative(process.cwd(), f)}`)
    json.push({ lang, section, ported, toolchain: tc, tally: t, used: r.used, countNote, classes: r.classes.length, byType, unclassified: un, defect, file: f })
    if (un || defect) bad++
  }
  if (a.json) console.log(JSON.stringify(json, null, 1))
  process.exit(bad ? 1 : 0)
}

module.exports = { run, diff, pairBlocks, loadNormalizers, explainPair, toolchainHere }
if (require.main === module) main()
