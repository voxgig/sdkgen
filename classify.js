// node classify.js --clone <clone> --old <root> --new <root> --lang <l>
//   [--section s,..] [--refs l1,l2,..] [--scratch] [--out <file>] [--hand <file>] [--json] [--quote N]
//
// Writes classes/<lang>.json, and nothing else, from three sources in order:
//   0. a class that hand/, pinned/ or the previous classes/<lang>.json holds at
//      another count is left open (RECOUNT): a regression that joins or leaves
//      a class is never re-accepted by whatever accepted the class before;
//   1. hand/<lang>.json: what a person decided (the porter, then the reviewer);
//   2. pinned/<lang>.json: a stage-3a rule's record for a class id it already
//      (never a `missing` class: that is always by hand)
//      classified, at the same count, in a language the rule lists, and only
//      while the rule still matches the class's text (rules.js). Never a new id;
//   3. a shared sentence: a `reworded` or `added` unit that, masked with this
//      language's declared facts (facts.js), is exactly a unit of a reviewed
//      class of a reference language masked with that language's facts. An
//      `added` unit matches a reviewed NEW text; a `reworded` pair matches only
//      a reviewed pair (OLD and NEW both). Every distinct instance of the class
//      must match. Recorded as `shared:<ref>:<id>`, naming the reference class.
//      It must not be printed in fewer variations, or fewer times in a
//      variation, than the reference it matched prints it (a dropped shared
//      sentence): that is left for a person, with the variations named.
//      A reference sentence whose verdict in reviewed/sentences.json is
//      `false` is never matched; every `shared:` record says whether its
//      reference sentences have a verdict (`unreviewed`).
// Not failing, written to review/<lang>/<section>.absent.json: masked units
// that every reference language of the same result style prints in some
// variation and this language prints in none (the porter says why, in
// hand/<lang>.json `absent: { "<id>": "<why>" }`).
// Everything else is left for a person: echo (a contradiction or a reasoned
// same-meaning), missing (restored where, or dropped why), dangling, tokens,
// changed blocks, and any unit that does not match exactly. The template of
// what is left is review/<lang>/<section>.open.json, with a hint where only
// the NEW side of a pair matched.
//
// --scratch ignores hand/ and pinned/ (a language taken as newly ported).
// --refs defaults to the languages ported.json lists for the section, less this one.
const Fs = require('node:fs')
const Path = require('node:path')
const C = require('./cut.js')
const K = require('./common.js')
const Ledger = require('./ledger.js')
const Blocks = require('./blocks.js')
const Facts = require('./facts.js')
const Ident = require('./ident.js')
const RULES = require('./rules.js')

const AUTO_TYPES = new Set(['reworded', 'added'])

function readJson(f) { return Fs.existsSync(f) ? JSON.parse(Fs.readFileSync(f, 'utf8')) : {} }

// A reference sentence: one masked NEW unit (kind and text), as sentences.js exports it.
const sentenceId = (kind, masked) => K.classId('sentence', kind + '\u0000' + masked)
const SENTENCES = Path.join(__dirname, 'reviewed', 'sentences.json')
function verdicts(file) {
  const raw = readJson(file || SENTENCES)
  const out = {}
  for (const [id, e] of Object.entries(raw.sentences || raw)) {
    if (!/^[0-9a-f]{10}$/.test(id)) continue
    if (!/^(ok|false|awkward)$/.test(e.verdict || '')) throw new Error(`${file || SENTENCES}: ${id}: verdict "${e.verdict}" is not ok, false or awkward`)
    out[id] = e.verdict
  }
  return out
}

function classesOf(a, section, lang) {
  const L = Ledger.run(a, section, lang)
  const B = Blocks.run({ ...a, corrections: null }, section, lang)
  return [...L.classes.map((c) => ({ ...c, tool: 'ledger' })), ...B.classes.map((c) => ({ ...c, tool: 'blocks', type: 'block-' + c.type }))]
}

// Masked instances of a class: [{ kind, o, n, nid }] (o null for an added
// unit): the match form of each side (ident.js), and the sentence id of the
// NEW side (null for text the fixture model holds, which takes no verdict).
function masked(c, mask, I, ulang) {
  const out = []
  for (const show of c.inst.values()) {
    const kind = 'reworded' === c.type ? c.kind.split(':')[0] : c.kind
    const n = 'reworded' === c.type ? show[1] : show[0]
    const nid = I && !I.isModelText(n) ? I.sentenceId(n, kind, ulang) : null
    if ('reworded' === c.type) out.push({ kind, o: mask(show[0], kind), n: mask(n, kind), nid })
    else out.push({ kind, o: null, n: mask(n, kind), nid })
  }
  return out
}

// The reviewed units of the references for a section, cached per process:
// the selftest classifies many injections against the same references.
const REFCACHE = new Map()

function run(a) {
  a = { classes: Path.join(__dirname, 'classes'), out: Path.join(__dirname, 'review'), ...a }
  const lang = a.lang
  const ts = Path.join(Path.resolve(a.clone), 'ts')
  const roots = [a.old, a.new]
  const sections = K.list(a.section) || C.SECTIONS.filter((s) => (C.REG.ported[s] || []).includes(lang) || Fs.existsSync(Path.join(ts, 'dist-test-scaffold/.sdk/dist/cmp', lang, 'Syntax_' + lang + '.js')))
  const hand = a.scratch ? {} : readJson(a.hand || Path.join(__dirname, 'hand', lang + '.json'))
  const pinned = a.scratch ? {} : readJson(Path.join(__dirname, 'pinned', lang + '.json'))
  // the previous record of this language: a class it holds at another count is
  // counted again by a person (RECOUNT), whatever first classified it
  const prev = a.scratch ? {} : readJson(Path.join(a.classes, lang + '.json'))
  const rules = new Map(RULES.map((r) => [r.name, r]))
  const myFacts = Facts.load(ts, lang)
  // the match form, learned with this language left out (ident.js)
  const I = Ident.make({ clone: a.clone, old: a.old, new: a.new })
  const myMask = (text, kind) => I.match(text, kind, lang, lang)
  const out = {}
  const report = { lang, sections: {}, refs: {}, facts: myFacts.facts.length }
  for (const section of sections) {
    const refs = (K.list(a.refs) || C.REG.ported[section] || []).filter((l) => l !== lang)
    report.refs[section] = refs
    // the reviewed units of the references, masked with each reference's own facts
    const ck = [lang, section, refs.join(','), a.classes, a.old, a.new, a.humanOnly ? 'h' : ''].join('\u0000')
    const verd = verdicts(a.sentences)
    const cached = a.cache ? REFCACHE.get(ck) : null
    const addedNew = cached ? cached.addedNew : new Map(), pairs = cached ? cached.pairs : new Map()
    // how often a reference prints each masked unit in each variation (the most of any reference)
    const often = cached ? cached.often : new Map()
    // and per reference: its counts, the variations it has the section in, its result style, an example per unit
    const oftenBy = cached ? cached.oftenBy : new Map(), hasBy = cached ? cached.hasBy : new Map()
    const styleBy = cached ? cached.styleBy : new Map(), exampleOf = cached ? cached.exampleOf : new Map()
    const vars = K.variations(a)
    const styleOf = (F) => (F.facts.find((f) => 'result' === f.path) || {}).value
    if (!cached) for (const r of refs) {
      const decided = readJson(Path.join(a.classes, r + '.json'))
      const rF = Facts.load(ts, r)
      const rmask = (text, kind) => I.match(text, kind, r, lang)
      const mineR = new Map(), has = new Set()
      oftenBy.set(r, mineR); hasBy.set(r, has); styleBy.set(r, styleOf(rF))
      for (const v of vars) {
        const sect = C.loadSection(a.new, v, section, r)
        if (null != sect) has.add(v)
        const cnt = new Map()
        for (const u of C.units(sect)) {
          const mk = u.kind + '\u0000' + rmask(u.text, u.kind), k = v + '\u0000' + mk
          cnt.set(k, (cnt.get(k) || 0) + 1)
          if (!exampleOf.has(mk)) exampleOf.set(mk, { lang: r, v, text: u.text, kind: u.kind })
        }
        for (const [k, n] of cnt) { often.set(k, Math.max(often.get(k) || 0, n)); mineR.set(k, n) }
      }
      for (const c of Ledger.run(a, section, r).classes) {
        if (!AUTO_TYPES.has(c.type)) continue
        const d = decided[c.id]
        if (!d || !d.outcome || 'defect' === d.outcome || (null != d.n && d.n !== c.n)) continue
        if ('shared' === d.by) continue
        if (a.humanOnly && 'hand' !== d.by && 'manual' !== d.rule) continue
        const prov = { ref: r, id: c.id, outcome: d.outcome, by: d.by || d.rule || '?' }
        for (const m of masked(c, rmask, I, r)) {
          const nk = m.kind + '\u0000' + m.n
          // a sentence a reviewer marked false is never a reference
          if (m.nid && 'false' === verd[m.nid]) continue
          if (!addedNew.has(nk)) addedNew.set(nk, [])
          addedNew.get(nk).push(prov)
          if (null != m.o) { const pk = nk + '\u0000' + m.o; if (!pairs.has(pk)) pairs.set(pk, []); pairs.get(pk).push(prov) }
        }
      }
    }
    if (a.cache && !cached) REFCACHE.set(ck, { addedNew, pairs, often, oftenBy, hasBy, styleBy, exampleOf })
    // and how often this language prints each, per variation: a shared sentence
    // printed more often than any reference prints it (a duplicate) is not matched
    const mine = new Map(), myHas = new Set(), myAny = new Set()
    for (const v of vars) {
      const sect = C.loadSection(a.new, v, section, lang)
      if (null != sect) myHas.add(v)
      for (const u of C.units(sect)) { const mk = u.kind + '\u0000' + myMask(u.text, u.kind); const k = v + '\u0000' + mk; mine.set(k, (mine.get(k) || 0) + 1); myAny.add(mk) }
    }
    // only in a variation some reference has the section in: lone-go and
    // alias-go2 hold go alone, and nothing there can be a duplicate of a reference
    const refHas = (v) => refs.some((r) => hasBy.get(r).has(v))
    const tooOften = (m) => [...mine.entries()].some(([k, n]) => k.endsWith('\u0000' + m.kind + '\u0000' + m.n) && refHas(k.split('\u0000')[0]) && n > (often.get(k) || 0))
    // The opposite: variations where this language prints the unit fewer times
    // than reference `r` does, among the variations both have the section in.
    const shortOf = (m, r) => {
      const out = []
      for (const v of vars) {
        if (!myHas.has(v) || !hasBy.get(r).has(v)) continue
        const k = v + '\u0000' + m.kind + '\u0000' + m.n
        const cr = oftenBy.get(r).get(k) || 0, cl = mine.get(k) || 0
        if (cl < cr) out.push(`${v} (${cl} < ${cr})`)
      }
      return out
    }
    // Shared sentences every reference of this language's result style prints
    // in a variation, which this language prints in none: listed, not failed.
    // Code spans are compared as `…`: a key read or a call is printed by each
    // runtime's own printer, and the sentence around it is what is shared.
    const style = styleOf(myFacts)
    const same = refs.filter((r) => styleBy.get(r) === style)
    const erase = (mk) => mk.replace(/`[^`]*`/g, '`…`')
    const myErased = new Set([...myAny].map(erase))
    const absent = {}
    if (same.length) for (const v of vars) {
      if (!myHas.has(v) || !same.every((r) => hasBy.get(r).has(v))) continue
      const setOf = (r) => new Set([...oftenBy.get(r).keys()].filter((k) => k.startsWith(v + '\u0000')).map((k) => erase(k.slice(v.length + 1))))
      const sets = same.map(setOf)
      for (const ek of sets[0]) {
        if (myErased.has(ek) || !sets.every((x) => x.has(ek))) continue
        const [kind, text] = ek.split('\u0000')
        if (!/[A-Za-z]{3,}.*\s.*[A-Za-z]{3,}/.test(text.replace(/`…`|⟦[^⟧]*⟧/g, ''))) continue
        const exk = [...oftenBy.get(same[0]).keys()].find((k) => k.startsWith(v + '\u0000') && erase(k.slice(v.length + 1)) === ek)
        const ex = exampleOf.get(exk.slice(v.length + 1))
        // keyed by the sentence the reference prints (ident.js identity)
        const id = I.sentenceId(ex.text, ex.kind, ex.lang)
        if (!absent[id]) absent[id] = { kind, masked: text, example: ex, refs: same, variations: [], why: (hand.absent || {})[id] || '' }
        absent[id].variations.push(v)
      }
    }
    K.writeFile(Path.join(a.out, lang, section + '.absent.json'), JSON.stringify({ note: `masked units that every reference of result style '${style}' (${same.join(', ') || 'none'}) prints in a variation and ${lang} prints in none; not failed: say why in hand/${lang}.json absent: { "<id>": "<why>" }`, absent }, null, 1) + '\n')
    const rep = report.sections[section] = { classes: 0, hand: 0, pinned: 0, shared: 0, open: 0, byType: {}, sharedEx: [], openEx: [] }
    const open = {}
    for (const c of classesOf(a, section, lang)) {
      rep.classes++
      const t = rep.byType[c.type] = rep.byType[c.type] || { classes: 0, hand: 0, pinned: 0, shared: 0, open: 0 }
      t.classes++
      const text = c.show.slice(0, 2).join('  =>  ')
      let d = null
      // A person's entry at this very count settles it; any other record at
      // another count leaves the class open again (RECOUNT).
      const handNow = hand[c.id] && hand[c.id].n === c.n
      const was = handNow ? null : [hand[c.id], pinned[c.id], prev[c.id]].find((x) => x && null != x.n && x.n !== c.n)
      const recount = was ? `RECOUNT: recorded at x${was.n}, now x${c.n}` : null
      const h = recount ? null : hand[c.id]
      if (h && (null == h.n || h.n === c.n)) d = { ...h, by: 'hand' }
      // A missing unit is always a person's: restored (where) or dropped (why).
      const p = !d && !recount && 'missing' !== c.type && pinned[c.id]
      if (p && (null == p.n || p.n === c.n)) {
        const r = rules.get(p.rule)
        const tx = c.tool === 'ledger' ? text : c.show.join('\n')
        if (r && r.langs.includes(lang) && (!r.types || r.types.includes(c.type)) && r.re.test(tx) && !(c.tool === 'ledger' && Ledger.invalidFor(c, p))) d = { outcome: p.outcome, why: p.why, n: c.n, by: 'rule:' + p.rule }
      }
      let hint = null
      if (!d && !recount && 'ledger' === c.tool && AUTO_TYPES.has(c.type)) {
        const ms = masked(c, myMask, I, lang)
        const lists = ms.map((m) => null == m.o ? addedNew.get(m.kind + '\u0000' + m.n) : pairs.get(m.kind + '\u0000' + m.n + '\u0000' + m.o))
        const dup = lists.every(Boolean) && ms.some(tooOften)
        if (dup) hint = 'masked, it is a reviewed shared sentence, but this language prints it more often in a variation than any reference does: a duplicate?'
        // the reference matched: one whose every instance matches and that
        // prints none of them more often than this language does
        let few = null, p0 = null
        if (lists.every(Boolean) && !dup) {
          const cands = [...new Set(lists[0].map((x) => x.ref))].filter((r) => lists.every((l) => l.some((x) => x.ref === r)))
          const shorts = cands.map((r) => [r, ms.flatMap((m) => shortOf(m, r))])
          const good = shorts.find(([, s]) => 0 === s.length)
          if (good) p0 = lists[0].find((x) => x.ref === good[0])
          else if (shorts.length) few = shorts[0]
          else p0 = lists[0][0]
        }
        if (few) hint = `masked, it is a reviewed shared sentence, but this language prints it in fewer variations, or fewer times, than ${few[0]} does: ${few[1].slice(0, 8).join(', ')}${few[1].length > 8 ? ' ...' : ''}: a dropped sentence?`
        if (p0) {
          const sids = [...new Set(ms.map((m) => m.nid).filter(Boolean))]
          const unrev = sids.filter((x) => !verd[x])
          d = { outcome: `shared:${p0.ref}:${p0.id}`, why: `masked, it is the ${p0.ref} unit of class ${p0.id} (${p0.outcome}, by ${p0.by})`, n: c.n, by: 'shared', sentences: sids, unreviewed: unrev.length }
          rep.sharedUnreviewed = (rep.sharedUnreviewed || 0) + (unrev.length ? 1 : 0)
          if (rep.sharedEx.length < (+a.quote || 10)) rep.sharedEx.push({ id: c.id, type: c.type, text: text.slice(0, 200), masked: (ms[0].o ? ms[0].o + '  =>  ' : '') + ms[0].n, ref: `${p0.ref}:${p0.id}` })
        } else if (!dup && !few && 'reworded' === c.type) {
          const nh = ms.map((m) => addedNew.get(m.kind + '\u0000' + m.n))
          if (nh.every(Boolean)) hint = `the NEW side is the reviewed ${nh[0][0].ref} unit of class ${nh[0][0].id}; the OLD side matches no reviewed pair: say what the OLD sentence said that the NEW one does not`
        }
      }
      // a class accepted (by hand or a rule record) whose NEW sentence a reviewer called false: counted, shown, not failed (the fix is in shared code)
      if (d && 'ledger' === c.tool && AUTO_TYPES.has(c.type) && !/^(defect|dropped)$/.test(d.outcome)) {
        const fs = masked(c, myMask, I, lang).map((m) => m.nid).filter((x) => x && 'false' === verd[x])
        if (fs.length) { rep.falseVerdict = (rep.falseVerdict || 0) + 1; (report.falseVerdict = report.falseVerdict || []).push({ id: c.id, section, sentences: [...new Set(fs)], text: text.slice(0, 120) }) }
      }
      if (d) { (report.decided = report.decided || {})[c.id] = { by: d.by, outcome: d.outcome, type: c.type, section }; out[c.id] = { outcome: d.outcome, why: d.why || '', n: c.n, by: d.by, type: c.type, section, ...(d.where ? { where: d.where, true: d.true, evidence: d.evidence } : {}), ...(d.sentences ? { sentences: d.sentences, unreviewed: d.unreviewed } : {}) }; const k = d.by === 'hand' ? 'hand' : d.by === 'shared' ? 'shared' : 'pinned'; rep[k]++; t[k]++ }
      else {
        rep.open++; t.open++; (report.open = report.open || {})[c.id] = { type: c.type, section, text: text.slice(0, 200), ...(hint ? { hint } : {}) }
        open[c.id] = { outcome: '', why: '', n: c.n, type: c.type, text: text.slice(0, 400), ...(recount ? { recount, was: was.outcome } : {}), ...(hint ? { hint } : {}), ...('echo' === c.type ? { where: '', true: '', evidence: '' } : {}) }
        if (rep.openEx.length < (+a.quote || 10)) rep.openEx.push({ id: c.id, type: c.type, text: text.slice(0, 200), ...(hint ? { hint: hint.slice(0, 60) } : {}) })
      }
    }
    K.writeFile(Path.join(a.out, lang, section + '.open.json'), JSON.stringify(open, null, 1) + '\n')
    rep.absent = Object.keys(absent).length; rep.absentExplained = Object.values(absent).filter((x) => x.why).length
    rep.fewer = Object.values(open).filter((x) => /fewer variations/.test(x.hint || '')).length
    report.absent = { ...(report.absent || {}), ...Object.fromEntries(Object.entries(absent).map(([k, x]) => [k, { section, masked: x.masked, variations: x.variations }])) }
  }
  const file = a['out-file'] || Path.join(a.classes, lang + '.json')
  if (!a.dry) K.writeFile(file, JSON.stringify(out, null, 1) + '\n')
  report.file = a.dry ? null : file
  // what the portcheck summary prints about shared sentences
  const sum = { matched: 0, unreviewed: 0, fewer: 0, absent: 0, absentExplained: 0, falseVerdict: (report.falseVerdict || []).length, falseList: report.falseVerdict || [], sections: {} }
  for (const [s, r] of Object.entries(report.sections)) { sum.matched += r.shared; sum.unreviewed += r.sharedUnreviewed || 0; sum.fewer += r.fewer || 0; sum.absent += r.absent || 0; sum.absentExplained += r.absentExplained || 0; sum.sections[s] = { matched: r.shared, unreviewed: r.sharedUnreviewed || 0, fewer: r.fewer || 0, absent: r.absent || 0 } }
  report.sentences = sum
  K.writeFile(Path.join(a.out, lang, 'sentences.json'), JSON.stringify(sum, null, 1) + '\n')
  return report
}

function main() {
  const a = K.args(process.argv.slice(2), { classes: Path.join(__dirname, 'classes'), out: Path.join(__dirname, 'review') })
  if (!a.clone || !a.old || !a.new || !a.lang || /,/.test(a.lang)) { console.error('usage: node classify.js --clone <clone> --old <root> --new <root> --lang <one language> [--section s,..] [--refs l,..] [--scratch] [--human-only] [--sentences <reviewed/sentences.json>] [--dry] [--out-file file] [--json]'); process.exit(2) }
  a.humanOnly = !!a['human-only']
  const report = run(a)
  const lang = a.lang, myFacts = { facts: { length: report.facts } }, file = report.file
  if (a.json) { console.log(JSON.stringify(report, null, 1)); return }
  console.log(`classify ${lang}: ${myFacts.facts.length} declared facts masked${a.scratch ? ' (from scratch: no hand entries, no pinned records)' : ''}`)
  for (const [s, r] of Object.entries(report.sections)) {
    console.log(`  ${s.padEnd(9)} ${r.classes} classes: shared sentence ${r.shared} (against an unreviewed sentence ${r.sharedUnreviewed || 0}), by hand ${r.hand}, stage-3a rule record ${r.pinned}, open ${r.open} (printed less often than its reference ${r.fewer || 0}); absent ${r.absent || 0}   (refs ${report.refs[s].join(' ')})`)
    for (const [ty, x] of Object.entries(r.byType)) console.log(`     ${ty.padEnd(22)} ${x.classes}: shared ${x.shared}, hand ${x.hand}, rule ${x.pinned}, open ${x.open}`)
  }
  if (!a.dry) console.log(`  -> ${file}; open classes: review/${lang}/<section>.open.json (fill into hand/${lang}.json)`)
}

module.exports = { run, sentenceId, verdicts }
if (require.main === module) main()
