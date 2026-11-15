// node rekey.js --clone <clone> --old <root> --new <root> --lang <l>
//   [--from <tools dir holding the records; default this one>] [--to <dir; default --from>]
//   [--code <dir of the identity code the records are keyed by; default: found>]
//   [--section s,..] [--dry] [--json <file>]
// node rekey.js --verdicts <old verdicts.json> --clone <c> --old <r> --new <r> [--refs-from <tools dir>] [--out <file>]
//
// Class ids and sentence ids are hashes of what a unit is once masked, so a
// change of the mask changes them. This maps every record keyed by an id from
// the id the OLD identity code gives (legacy/v32, a copy of v3.2's, or --code)
// to the one this directory's code gives, THROUGH THE UNITS each class is made
// of: both codes cut the same output and record every occurrence of every
// class (variation and the unit texts); an old occurrence is found again as an
// identical occurrence, else (a unit the new splitter cut in two) as the new
// occurrences of that variation and type whose texts lie inside it.
//
// For each new class, the old classes its occurrences came from:
//   - one, with the same occurrences: renamed (the record is moved as it is);
//   - several (a merge): carried only when every old class's outcome in
//     classes/<lang>.json is the same, with n set to the new count; otherwise
//     LISTED for a person and carried nowhere;
//   - one old class in several new ones (a split): each part inherits the
//     record, n set to its count, and is LISTED;
//   - an occurrence no old class held: the new class is LISTED and nothing is
//     carried to it (a decision is never extended to units nobody decided).
// An old class none of whose occurrences forms a class any more is LISTED as
// gone (its record is kept in the report, not in the file).
// Records: hand/<lang>.json class entries and its `absent` sentence ids,
// pinned/<lang>.json (stage-3a rule records), classes/<lang>.json (the
// generated record), counts/<lang>.json (checked: the block normalizer counts
// do not depend on the mask, and are compared, never rewritten),
// purity-allow/<lang>.json (keyed by text: untouched). Re-keying records that
// are already keyed by this code changes nothing (the code is found by the ids).
//
// --verdicts: maps reviewed sentence verdicts (old sentence id -> verdict) to
// the new sentence ids: the reference languages' decided classes, as
// sentences.js lists them, each instance's NEW text under the old code's mask
// and, cut by the new splitter, under the new identity. A new sentence takes
// the verdict of the old ids that became it when they agree; a mix takes the
// worse (false > awkward > ok) and keeps every note, marked `mixed`.
const Fs = require('node:fs')
const Path = require('node:path')
const Os = require('node:os')
const K = require('./common.js')
const C = require('./cut.js')

const HERE = __dirname
const readJson = (f) => Fs.existsSync(f) ? JSON.parse(Fs.readFileSync(f, 'utf8')) : null
const isId = (k) => /^[0-9a-f]{10}$/.test(k)

function codeOf(dir) {
  return {
    dir,
    Ledger: require(Path.join(dir, 'ledger.js')),
    Blocks: require(Path.join(dir, 'blocks.js')),
    C: require(Path.join(dir, 'cut.js')),
  }
}

// Every class of a section, with its occurrences, as classify.js builds them.
function classesOf(code, a, section, lang) {
  const L = code.Ledger.run(a, section, lang)
  const B = code.Blocks.run({ ...a, corrections: null }, section, lang)
  return [...L.classes.map((c) => ({ ...c, tool: 'ledger' })), ...B.classes.map((c) => ({ ...c, tool: 'blocks', type: 'block-' + c.type }))]
}

const okey = (tool, type, o) => [tool, type, o.v, ...o.show].join('\u0001')

// old class id -> Map(new id -> occurrences), and new id -> Map(old id -> occurrences)
function mapSection(oldCls, newCls) {
  const pool = new Map()
  const newOcc = new Map()
  for (const c of newCls) for (const o of c.occ || []) {
    const k = okey(c.tool, c.type, o)
    if (!pool.has(k)) pool.set(k, [])
    pool.get(k).push(c.id)
    newOcc.set(c.id, (newOcc.get(c.id) || 0) + 1)
  }
  // the unmatched new occurrences, per variation and tool, for the containment pass
  const fwd = new Map(), back = new Map()
  const link = (o, n) => {
    if (!fwd.has(o)) fwd.set(o, new Map()); fwd.get(o).set(n, (fwd.get(o).get(n) || 0) + 1)
    if (!back.has(n)) back.set(n, new Map()); back.get(n).set(o, (back.get(n).get(o) || 0) + 1)
  }
  const left = []
  for (const c of oldCls) for (const o of c.occ || []) {
    const k = okey(c.tool, c.type, o)
    const ids = pool.get(k)
    if (ids && ids.length) link(c.id, ids.shift())
    else left.push({ c, o })
  }
  // containment: the new splitter cut one old unit into several
  const rest = []
  for (const c of newCls) for (const o of c.occ || []) {
    const k = okey(c.tool, c.type, o)
    const ids = pool.get(k)
    const i = ids ? ids.indexOf(c.id) : -1
    if (i >= 0) { ids.splice(i, 1); rest.push({ c, o, used: false }) }
  }
  const gone = []
  for (const { c, o } of left) {
    const hit = rest.filter((r) => !r.used && r.c.tool === c.tool && r.o.v === o.v &&
      r.o.show.length && r.o.show.every((t, i) => i >= 2 || (null != o.show[i] && String(o.show[i]).includes(String(t)) && String(t).trim().length > 0)))
    if (hit.length) for (const r of hit) { r.used = true; link(c.id, r.c.id) }
    else gone.push({ id: c.id, v: o.v, text: String(o.show[0]).slice(0, 120) })
  }
  const unsourced = new Map()
  for (const r of rest) if (!r.used) unsourced.set(r.c.id, (unsourced.get(r.c.id) || 0) + 1)
  return { fwd, back, gone, unsourced, newOcc }
}

function sectionsFor(a, lang) {
  const ts = Path.join(Path.resolve(a.clone), 'ts')
  return K.list(a.section) || C.SECTIONS.filter((s) => (C.REG.ported[s] || []).includes(lang) || Fs.existsSync(Path.join(ts, 'dist-test-scaffold/.sdk/dist/cmp', lang, 'Syntax_' + lang + '.js')))
}

const WORSE = { ok: 0, awkward: 1, false: 2 }

function rekeyLang(a) {
  const lang = a.lang
  const from = Path.resolve(a.from || HERE), to = Path.resolve(a.to || from)
  const files = {
    hand: Path.join(from, 'hand', lang + '.json'),
    pinned: Path.join(from, 'pinned', lang + '.json'),
    classes: Path.join(from, 'classes', lang + '.json'),
    counts: Path.join(from, 'counts', lang + '.json'),
  }
  const hand = readJson(files.hand) || {}
  const pinned = readJson(files.pinned) || {}
  const classes = readJson(files.classes) || {}
  // a language's own normalizers are the records' directory's (they require ../normalizers.js beside them)
  const base = { old: a.old, new: a.new, clone: a.clone, normalizers: Fs.existsSync(Path.join(from, 'normalizers.js')) ? Path.join(from, 'normalizers') : undefined }
  const NEW = codeOf(HERE)
  const sections = sectionsFor(a, lang)
  const t0 = Date.now()
  const progress = (m) => console.error(`[rekey ${lang} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`)
  // the new ids first: records already keyed by them need nothing
  const newCls = {}
  for (const s of sections) { newCls[s] = classesOf(NEW, base, s, lang); progress(`new ${s}: ${newCls[s].length} classes`) }
  const newIds = new Set(Object.values(newCls).flat().map((c) => c.id))
  const keys = [...Object.keys(hand).filter(isId), ...Object.keys(pinned), ...Object.keys(classes)]
  // keyed by this code already: (nearly) every key is a class it makes; the
  // rest are records of classes no code makes any more (stale, kept as they are)
  const uniq = new Set(keys), known = [...uniq].filter((k) => newIds.has(k)).length
  let codeDir = a.code ? Path.resolve(a.code) : null
  if (!codeDir) codeDir = uniq.size && known >= 0.9 * uniq.size ? HERE : Path.join(HERE, 'legacy', 'v32')
  // A shared change retires classes whose records stay (stale), so the share
  // of known keys can fall under 0.9 while the records are this code's: they
  // are, when this code knows at least as many of them as the old one does.
  if (codeDir !== HERE && !a.code && uniq.size) {
    const LEG = codeOf(Path.join(HERE, 'legacy', 'v32'))
    const legIds = new Set(sections.flatMap((s) => classesOf(LEG, base, s, lang)).map((c) => c.id))
    const knownLeg = [...uniq].filter((k) => legIds.has(k)).length
    progress(`keys known: this code ${known}, the v3.2 code ${knownLeg}, of ${uniq.size}`)
    if (known >= knownLeg) codeDir = HERE
  }
  const report = { lang, from, to, code: codeDir, sections: {}, renamed: 0, merged: [], split: [], conflicts: [], unsourced: [], gone: [], carried: { hand: 0, pinned: 0, classes: 0 }, dropped: { hand: [], pinned: [] }, stale: { hand: [], pinned: [] }, absent: {}, counts: null }
  if (codeDir === HERE) {
    report.already = true
    progress('records are keyed by this code already: nothing to map')
    return report
  }
  const OLD = codeOf(codeDir)
  const oldIds = new Set()
  const out = { hand: {}, pinned: {}, classes: {} }
  const carriedHand = new Set()
  for (const [k, v] of Object.entries(hand)) if (!isId(k)) out.hand[k] = 'absent' === k ? {} : v
  for (const s of sections) {
    const oldCls = classesOf(OLD, base, s, lang)
    for (const c of oldCls) oldIds.add(c.id)
    progress(`old ${s}: ${oldCls.length} classes`)
    const M = mapSection(oldCls, newCls[s])
    const byNew = new Map(newCls[s].map((c) => [c.id, c]))
    const byOld = new Map(oldCls.map((c) => [c.id, c]))
    const rep = report.sections[s] = { old: oldCls.length, new: newCls[s].length, renamed: 0, merged: 0, split: 0, conflicts: 0, unsourced: 0, gone: 0 }
    const splitOf = new Set([...M.fwd.entries()].filter(([, m]) => m.size > 1).map(([o]) => o))
    for (const c of newCls[s]) {
      const src = M.back.get(c.id)
      const uns = M.unsourced.get(c.id) || 0
      if (!src) continue
      const olds = [...src.keys()]
      // a shared match is made again by classify.js: which reference it names is no decision
      const outcomes = olds.map((o) => ((classes[o] || hand[o] || pinned[o] || {}).outcome || '').replace(/^shared:.*/, 'shared') || null)
      const decided = olds.filter((o, i) => outcomes[i])
      const agree = new Set(outcomes.filter(Boolean)).size <= 1 && decided.length === olds.length
      const isSplit = olds.some((o) => splitOf.has(o))
      const rename = 1 === olds.length && !isSplit && !uns && byOld.get(olds[0]).n === c.n
      const entry = { new: c.id, n: c.n, section: s, type: c.type, old: olds.map((o) => ({ id: o, n: byOld.get(o).n, outcome: (classes[o] || {}).outcome || null, by: (classes[o] || {}).by || null })), text: String(c.show[0]).slice(0, 140) }
      if (uns) { rep.unsourced++; report.unsourced.push({ ...entry, unsourced: uns }); continue }
      if (!decided.length) continue
      if (!agree) { rep.conflicts++; report.conflicts.push(entry); continue }
      if (rename) rep.renamed++
      else if (1 < olds.length) { rep.merged++; report.merged.push(entry) }
      if (isSplit) { rep.split++; report.split.push(entry) }
      const carry = (rec, key) => {
        const ds = olds.map((o) => rec[o]).filter(Boolean)
        if (!ds.length) return
        if ('hand' === key) for (const o of olds) if (rec[o]) carriedHand.add(o)
        // several records for one class: they agree on the outcome; keep the first, every why
        const d = { ...ds[0] }
        if (ds.length > 1) d.why = [...new Set(ds.map((x) => x.why).filter(Boolean))].join(' | ')
        if (null != d.n || !rename) d.n = c.n
        if (!rename) d.rekeyed = olds.join('+')
        out[key][c.id] = d
        report.carried[key]++
      }
      carry(hand, 'hand'); carry(pinned, 'pinned'); carry(classes, 'classes')
    }
    for (const g of M.gone) { rep.gone++; report.gone.push({ section: s, ...g, outcome: (classes[g.id] || {}).outcome || null }) }
    report.renamed += rep.renamed
    progress(`${s}: renamed ${rep.renamed}, merged ${rep.merged}, split ${rep.split}, conflicts ${rep.conflicts}, unsourced ${rep.unsourced}, gone occurrences ${rep.gone}`)
  }
  // records that went nowhere
  // a record of a class the old code does not make either was stale before the re-key
  // a record of a class the old code does not make either was stale before
  // the re-key: kept as it is (no class has its id, so it decides nothing)
  for (const k of Object.keys(hand).filter(isId)) if (!carriedHand.has(k)) {
    if (oldIds.has(k)) report.dropped.hand.push({ id: k, ...hand[k] })
    else { report.stale.hand.push({ id: k, ...hand[k] }); if (!out.hand[k]) out.hand[k] = hand[k] }
  }
  for (const k of Object.keys(pinned)) if (!oldIds.has(k)) { report.stale.pinned.push(k); if (!out.pinned[k]) out.pinned[k] = pinned[k] }
  // absent: the old absent list (old code), its example under the new identity
  if (hand.absent && Object.keys(hand.absent).length) {
    const tmp = Fs.mkdtempSync(Path.join(a.tmp || Os.tmpdir(), 'rekey-absent-'))
    try {
      const OC = require(Path.join(codeDir, 'classify.js'))
      // the absent list does not depend on any decision: the references' units only
      OC.run({ clone: a.clone, old: a.old, new: a.new, lang, classes: Path.join(from, 'classes'), out: tmp, dry: true, scratch: true })
      const I = require('./ident.js').make({ clone: a.clone, old: a.old, new: a.new })
      const mapped = {}
      for (const s of sections) {
        const f = Path.join(tmp, lang, s + '.absent.json')
        const j = readJson(f) || { absent: {} }
        for (const [id, x] of Object.entries(j.absent)) {
          if (!(id in hand.absent)) continue
          const nid = I.sentenceId(x.example.text, x.kind, x.example.lang)
          mapped[id] = nid
          if (out.hand.absent[nid] && out.hand.absent[nid] !== hand.absent[id]) out.hand.absent[nid] += ' | ' + hand.absent[id]
          else out.hand.absent[nid] = hand.absent[id]
        }
      }
      const lost = Object.keys(hand.absent).filter((id) => !(id in mapped))
      for (const id of lost) out.hand.absent[id] = hand.absent[id]
      report.absent = { entries: Object.keys(hand.absent).length, mapped: Object.keys(mapped).length, ids: mapped, notFound: lost }
    } finally { Fs.rmSync(tmp, { recursive: true, force: true }) }
  }
  // counts: the normalizer counts never depend on the mask; checked
  const cnt = readJson(files.counts)
  if (cnt) {
    const diff = []
    for (const s of sections) {
      const r = NEW.Blocks.run({ ...base, corrections: null }, s, lang)
      const want = cnt[s] || {}
      const got = { corrected: r.tally.corrected, unified: r.tally.unified, used: r.used }
      const canon = (o) => JSON.stringify(Object.keys(o || {}).sort().map((k) => [k, o[k]]))
      if (canon(want.used) !== canon(got.used) || want.corrected !== got.corrected || want.unified !== got.unified) diff.push({ section: s, recorded: want, now: got })
    }
    report.counts = diff.length ? { changed: diff } : 'unchanged'
  }
  if (!a.dry) {
    const w = (dir, name, obj, had) => { if (!had && !Object.keys(obj).length) return; K.writeFile(Path.join(to, dir, name), JSON.stringify(obj, null, 1) + '\n') }
    w('hand', lang + '.json', out.hand, Fs.existsSync(files.hand))
    w('pinned', lang + '.json', out.pinned, Fs.existsSync(files.pinned))
    w('classes', lang + '.json', out.classes, Fs.existsSync(files.classes))
  }
  report.records = { hand: Object.keys(hand).filter(isId).length, pinned: Object.keys(pinned).length, classes: Object.keys(classes).length }
  return report
}

// ---- verdicts ------------------------------------------------------------
function rekeyVerdicts(a) {
  const old = readJson(a.verdicts)
  const V = old.sentences || old
  const refsFrom = Path.resolve(a['refs-from'] || HERE)
  const OLD = { ...codeOf(Path.join(HERE, 'legacy', 'v32')), Facts: require(Path.join(HERE, 'legacy', 'v32', 'facts.js')), Classify: require(Path.join(HERE, 'legacy', 'v32', 'classify.js')) }
  const I = require('./ident.js').make({ clone: a.clone, old: a.old, new: a.new })
  const ts = Path.join(Path.resolve(a.clone), 'ts')
  const fwd = new Map() // old id -> Map(new id -> example)
  const t0 = Date.now()
  for (const section of C.SECTIONS) for (const r of OLD.C.REG.ported[section] || []) {
    const decided = readJson(Path.join(refsFrom, 'classes-old', r + '.json')) || readJson(Path.join(refsFrom, 'classes', r + '.json'))
    const rmask = OLD.Facts.masker(OLD.Facts.load(ts, r), [a.old, a.new])
    for (const c of OLD.Ledger.run(a, section, r).classes) {
      if (!['reworded', 'added'].includes(c.type)) continue
      const d = decided[c.id]
      if (!d || !d.outcome || 'defect' === d.outcome || (null != d.n && d.n !== c.n) || 'shared' === d.by) continue
      for (const show of c.inst.values()) {
        const kind = 'reworded' === c.type ? c.kind.split(':')[0] : c.kind
        const text = 'reworded' === c.type ? show[1] : show[0]
        const oid = OLD.Classify.sentenceId(kind, rmask(text, kind))
        if (!(oid in V)) continue
        if (!fwd.has(oid)) fwd.set(oid, new Map())
        // the new splitter may cut the unit in two
        const parts = 'sentence' === kind ? C.splitSentences(text) : [text]
        for (const p of parts) {
          if (I.isModelText(p)) { fwd.get(oid).set('model-text', { lang: r, text: p }); continue }
          const nid = I.sentenceId(p, kind, r)
          const split = parts.length > 1
          const prev = fwd.get(oid).get(nid)
          if (!prev) fwd.get(oid).set(nid, { lang: r, section, kind, text: p, identity: I.identity(p, kind, r), split })
          else if (!split) prev.split = false
        }
      }
    }
    console.error(`[verdicts ${((Date.now() - t0) / 1000).toFixed(0)}s] ${section} ${r}: ${fwd.size} of ${Object.keys(V).length} old ids found`)
  }
  const back = new Map()
  // an old sentence the new splitter cut in two (go's bold step lead) reached
  // each part; its verdict judged the whole. A part that some old sentence
  // also was WHOLE takes only the whole ones' verdicts; a part only splits
  // reached takes theirs, marked fromSplit, for a person to confirm.
  for (const [oid, m] of fwd) for (const [nid, ex] of m) { if (!back.has(nid)) back.set(nid, { ex, olds: [], split: [] }); (ex.split ? back.get(nid).split : back.get(nid).olds).push(oid) }
  const sentences = {}
  const mixed = []
  for (const [nid, x] of back) {
    if ('model-text' === nid) continue
    const fromSplit = !x.olds.length
    if (fromSplit) x.olds = x.split
    const vs = x.olds.map((o) => V[o].verdict)
    const worst = vs.reduce((p, q) => WORSE[q] > WORSE[p] ? q : p, 'ok')
    const same = new Set(vs).size === 1
    sentences[nid] = { verdict: worst, note: x.olds.map((o) => `[${o}] ${V[o].note}`).join(' || '), from: x.olds, ...(same ? {} : { mixed: vs.join(',') }), ...(fromSplit ? { fromSplit: true } : x.split.length ? { alsoSplitFrom: x.split } : {}), example: x.ex.lang + ': ' + x.ex.text.slice(0, 200), identity: x.ex.identity.replace('\u0000', ' | ') }
    if (!same) mixed.push(nid)
  }
  const notFound = Object.keys(V).filter((o) => !fwd.has(o))
  const modelText = [...fwd.entries()].filter(([, m]) => m.has('model-text')).map(([o]) => o)
  const res = { note: 'Verdicts of the v3.2 sentence review (P/sentences/merged.json, 297 ids) carried to the sentence ids of ident.js by rekey.js --verdicts: a new id takes the verdict of every old id that became it when they agree, else the worse with every note (mixed). Written by the tool; read by classify.js and sentences.js.', sentences, unmapped: notFound, modelText, mixed }
  if (a.out) K.writeFile(a.out, JSON.stringify(res, null, 1) + '\n')
  const count = (k) => Object.values(sentences).filter((x) => x.verdict === k).length
  res.fromSplit = Object.keys(sentences).filter((k) => sentences[k].fromSplit)
  if (a.out) K.writeFile(a.out, JSON.stringify(res, null, 1) + '\n')
  console.log(`from a split only (for a person): ${res.fromSplit.map((k) => k + ' ' + sentences[k].verdict + ' ' + sentences[k].identity.slice(0, 80)).join(' ; ')}`)
  console.log(`verdicts: ${Object.keys(V).length} old ids -> ${Object.keys(sentences).length} new sentence ids (ok ${count('ok')}, awkward ${count('awkward')}, false ${count('false')}); mixed ${mixed.length}; old ids not found ${notFound.length}${notFound.length ? ' (' + notFound.join(' ') + ')' : ''}; model text left out ${modelText.length}${modelText.length ? ' (' + modelText.join(' ') + ')' : ''}`)
  return res
}

function main() {
  const a = K.args(process.argv.slice(2))
  if (!a.clone || !a.old || !a.new || (!a.lang && !a.verdicts)) { console.error('usage: node rekey.js --clone <c> --old <r> --new <r> --lang <l> [--from dir] [--to dir] [--code dir] [--dry] [--json file] | --verdicts <file> [--out file]'); process.exit(2) }
  if (a.verdicts) { rekeyVerdicts(a); return }
  const r = rekeyLang(a)
  if (a.json) K.writeFile(a.json, JSON.stringify(r, null, 1) + '\n')
  if (r.already) { console.log(`rekey ${r.lang}: already keyed by ${r.code}; nothing changed`); return }
  console.log(`rekey ${r.lang}: from ${r.from} (keyed by ${r.code}) -> ${r.to}${a.dry ? ' (dry run: nothing written)' : ''}`)
  for (const [s, x] of Object.entries(r.sections)) console.log(`  ${s.padEnd(9)} classes old ${x.old} new ${x.new}: renamed ${x.renamed}, merged ${x.merged}, split ${x.split}, CONFLICTS ${x.conflicts}, unsourced ${x.unsourced}, gone ${x.gone}`)
  console.log(`  records: hand ${r.records.hand} -> carried ${r.carried.hand}; rule records ${r.records.pinned} -> ${r.carried.pinned}; classes ${r.records.classes} -> ${r.carried.classes}; hand entries not carried ${r.dropped.hand.length}`)
  if (r.absent.entries) console.log(`  absent: ${r.absent.entries} entries, ${r.absent.mapped} mapped${r.absent.notFound.length ? ', NOT FOUND ' + r.absent.notFound.join(' ') : ''}`)
  console.log(`  counts/${r.lang}.json: ${'string' === typeof r.counts ? r.counts : r.counts ? 'CHANGED ' + JSON.stringify(r.counts.changed).slice(0, 300) : 'none'}`)
  for (const x of r.conflicts) console.log(`  CONFLICT ${x.section} [${x.new}] x${x.n} ${x.type}: ${x.old.map((o) => `${o.id} x${o.n} ${o.outcome} (${o.by})`).join(' + ')} :: ${x.text}`)
  for (const x of r.merged) console.log(`  merged ${x.section} [${x.new}] x${x.n} ${x.type}: ${x.old.map((o) => `${o.id} x${o.n} ${o.outcome}`).join(' + ')} :: ${x.text.slice(0, 90)}`)
  for (const x of r.split) console.log(`  split ${x.section} [${x.new}] x${x.n} ${x.type}: from ${x.old.map((o) => `${o.id} x${o.n} ${o.outcome}`).join(' + ')} :: ${x.text.slice(0, 90)}`)
  for (const x of r.unsourced) console.log(`  UNSOURCED ${x.section} [${x.new}] x${x.n} ${x.type} (${x.unsourced} occurrence(s) no old class held; nothing carried): ${x.text.slice(0, 90)}`)
  const goneIds = [...new Set(r.gone.map((g) => g.id))]
  if (goneIds.length) console.log(`  gone (an old class with occurrences that form no class now): ${goneIds.length} classes, ${r.gone.length} occurrences: ${goneIds.slice(0, 12).join(' ')}`)
  for (const x of r.dropped.hand) console.log(`  HAND ENTRY NOT CARRIED [${x.id}] ${x.outcome}: ${String(x.text || x.why || '').slice(0, 100)}`)
  if (r.stale.hand.length || r.stale.pinned.length) console.log(`  stale before the re-key (no class of the old code has the id; kept as they are): hand ${r.stale.hand.map((x) => x.id).join(' ') || 'none'}; rule records ${r.stale.pinned.length}`)
  process.exitCode = r.conflicts.length || r.dropped.hand.length || r.unsourced.length ? 1 : 0
}

module.exports = { rekeyLang, rekeyVerdicts, mapSection }
if (require.main === module) main()
