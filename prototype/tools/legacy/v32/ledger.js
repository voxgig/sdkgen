// node ledger.js --old <root> --new <root> [--lang l1,l2] [--section s1,s2]
//   [--vars v1,v2] [--classes <dir>] [--out <dir>] [--template] [--json]
//
// Every prose unit of OLD (sentence, table cell, table header, heading,
// comment inside a code block) against NEW, same language, same variation:
// same, reworded (both shown), missing; and every NEW unit with no OLD
// counterpart: added. Then identifier tokens of the section: novel (in NEW,
// nowhere in OLD for the language) and vanished (the reverse). Units that
// differ only by a model name, the SDK name or the language title are one
// class. Each non-same class needs an outcome in <classes>/<lang>.json, keyed
// by class id. Exit 1 when a class is unclassified or marked defect.
const Fs = require('node:fs')
const Path = require('node:path')
const C = require('./cut.js')
const K = require('./common.js')

const PROSE_TOKEN = /`([^`]*)`/g

function pairSection(O, N, mask) {
  const res = { same: 0, reworded: [], missing: [], added: [] }
  const oUsed = new Array(O.length).fill(false), nUsed = new Array(N.length).fill(false)
  // 1. A table cell is found again by its key: heading path, column, row.
  const nByKey = new Map()
  N.forEach((u, j) => { if (u.key) { if (!nByKey.has(u.key)) nByKey.set(u.key, []); nByKey.get(u.key).push(j) } })
  O.forEach((u, i) => {
    if (!u.key || !nByKey.has(u.key)) return
    const j = nByKey.get(u.key).find((j) => !nUsed[j])
    if (null == j) return
    oUsed[i] = nUsed[j] = true
    if (u.text === N[j].text) res.same++
    else res.reworded.push({ o: u, n: N[j], sim: 0 })
  })
  // 2. Exact text, as a multiset, same kind first.
  const idx = new Map()
  N.forEach((u, j) => { if (nUsed[j]) return; const k = u.kind + '\0' + u.text; if (!idx.has(k)) idx.set(k, []); idx.get(k).push(j) })
  O.forEach((u, i) => {
    if (oUsed[i]) return
    const js = idx.get(u.kind + '\0' + u.text)
    const j = js && js.find((j) => !nUsed[j])
    if (null == j) return
    oUsed[i] = nUsed[j] = true; res.same++
  })
  // 2b. Exact text across kinds (a sentence that became a comment) is a rewording of form.
  const any = new Map()
  N.forEach((u, j) => { if (nUsed[j]) return; if (!any.has(u.text)) any.set(u.text, []); any.get(u.text).push(j) })
  O.forEach((u, i) => {
    if (oUsed[i]) return
    const js = any.get(u.text); const j = js && js.find((j) => !nUsed[j])
    if (null == j) return
    oUsed[i] = nUsed[j] = true; res.reworded.push({ o: u, n: N[j], sim: 1 })
  })
  // 3. Similar wording: best pairs first. Short units only pair under the same heading.
  const oi = O.map((u, i) => i).filter((i) => !oUsed[i]), nj = N.map((u, j) => j).filter((j) => !nUsed[j])
  const ob = new Map(oi.map((i) => [i, K.bag(mask(O[i].text))])), nb = new Map(nj.map((j) => [j, K.bag(mask(N[j].text))]))
  const cand = []
  for (const i of oi) for (const j of nj) {
    const short = C.words(O[i].text).length < 4 || C.words(N[j].text).length < 4
    const sameCtx = O[i].ctx === N[j].ctx
    const likeCtx = sameCtx || mask(O[i].ctx) === mask(N[j].ctx)
    if (short && !sameCtx) continue
    const d = K.dice(ob.get(i), nb.get(j))
    const need = sameCtx ? 0.5 : likeCtx ? 0.65 : 0.75
    if (d >= (short ? Math.max(need, 0.6) : need)) cand.push([d + (sameCtx ? 0.2 : likeCtx ? 0.1 : 0) + (O[i].kind === N[j].kind ? 0.05 : 0), i, j])
  }
  cand.sort((a, b) => b[0] - a[0])
  for (const [s, i, j] of cand) {
    if (oUsed[i] || nUsed[j]) continue
    oUsed[i] = nUsed[j] = true
    res.reworded.push({ o: O[i], n: N[j], sim: +s.toFixed(2) })
  }
  O.forEach((u, i) => { if (!oUsed[i]) res.missing.push(u) })
  N.forEach((u, j) => { if (!nUsed[j]) res.added.push(u) })
  return res
}

// The identifiers a unit shows as code: inside code spans (a comment is code already).
function spanTokens(u) {
  if ('comment' === u.kind) return []
  return C.tokens([...u.text.matchAll(PROSE_TOKEN)].map((m) => m[1]).join(' '))
}

function run(a, section, lang) {
  const mask = C.masker([a.old, a.new], lang)
  const vars = K.variations(a)
  const classes = new Map()
  const tally = { variations: 0, oldUnits: 0, newUnits: 0, same: 0, reworded: 0, missing: 0, added: 0 }
  const oTok = new Map(), nTok = new Map()
  const note = (m, t, v, ctx) => { if (!m.has(t)) m.set(t, { n: 0, v, ctx }); m.get(t).n++ }
  const add = (type, kind, key, show, v, ctx) => {
    const id = K.classId(section + '/' + type, kind + '\u0000' + key)
    if (!classes.has(id)) classes.set(id, { id, type, kind, key, show, n: 0, vars: new Set(), where: `${v}: ${ctx}`, inst: new Map() })
    const c = classes.get(id); c.n++; c.vars.add(v)
    // rekey instrumentation (the only change to the v3.2 code): every occurrence
    ;(c.occ = c.occ || []).push({ v, show })
    // every distinct instance, unmasked: what classify.js compares across languages
    const ik = show.join('\u0000'); if (!c.inst.has(ik)) c.inst.set(ik, show)
  }
  for (const v of vars) {
    const os = C.loadSection(a.old, v, section, lang), ns = C.loadSection(a.new, v, section, lang)
    if (null == os && null == ns) continue
    tally.variations++
    const O = C.units(os), N = C.units(ns)
    tally.oldUnits += O.length; tally.newUnits += N.length
    for (const u of O) for (const t of spanTokens(u)) note(oTok, t, v, u.ctx)
    for (const u of N) for (const t of spanTokens(u)) note(nTok, t, v, u.ctx)
    // A code span in NEW prose naming an identifier no code block of the
    // section shows (an unbound variable), where OLD's same unit had none.
    if (null != ns) {
      const dang = (sect, us) => {
        // identifiers a block uses as a variable: not after `.` or `:`, outside comments and strings
        const code = new Set()
        for (const b of C.blocks(sect)) for (const line of b.code.split('\n')) {
          const cm = C.commentOf(line)
          let l = cm ? (cm.whole ? '' : line.slice(0, line.lastIndexOf(cm.text)).replace(/(\/\/|#|;;|--)\s*$/, '')) : line
          l = l.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, ' ')
          for (const m of l.matchAll(/(?<![.:\w$-])([A-Za-z_][\w-]*)/g)) code.add(m[1])
        }
        const out = new Map()
        for (const u of us) {
          if ('comment' === u.kind || 'heading' === u.kind || 'header' === u.kind) continue
          for (const m of u.text.matchAll(PROSE_TOKEN)) {
            // an identifier the span passes as an argument
            for (const a of m[1].matchAll(/(?<=[(,]\s*|\(\(?:?[\w-]+\s)([a-z_][\w]*)(?=\s*[),])/g)) {
              const t = a[1]
              if (!code.has(t) && !/^(null|nil|none|true|false|undefined)$/i.test(t)) out.set(mask(u.text) + '\u0000' + t, { u, t })
            }
          }
        }
        return out
      }
      const od = os ? new Set([...dang(os, O).values()].map((x) => mask(x.t))) : new Set()
      if (C.blocks(ns).length) for (const [k, x] of dang(ns, N)) if (!od.has(mask(x.t))) add('dangling', x.u.kind, k, [x.u.text, `\`${x.t}\` appears in no code block of this section`], v, x.u.ctx)
    }
    if (null == ns) { O.forEach((u) => { tally.missing++; add('missing', u.kind, mask(u.text), [u.text], v, u.ctx) }); continue }
    if (null == os) { N.forEach((u) => { tally.added++; add('added', u.kind, mask(u.text), [u.text], v, u.ctx) }); continue }
    const r = pairSection(O, N, mask)
    tally.same += r.same; tally.reworded += r.reworded.length; tally.missing += r.missing.length; tally.added += r.added.length
    // Echoes: a value this section now states differently (reworded, added
    // or missing unit) that the SDK's other documents still state in a line
    // that did not change. One fact moved in one place only.
    const docs = [lang + '/README.md', lang + '/REFERENCE.md']
    const outside = []
    for (const d of docs) {
      const nt = C.readIf(Path.join(a.new, v, d)), ot = C.readIf(Path.join(a.old, v, d))
      if (!nt) continue
      const inSect = new Set(String(ns).split('\n'))
      const oldLines = new Set(String(ot || '').split('\n'))
      nt.split('\n').forEach((l, k) => { if (!inSect.has(l) && oldLines.has(l) && /`/.test(l + '') || (!inSect.has(l) && oldLines.has(l) && /\(/.test(l))) outside.push({ d, k: k + 1, l }) })
    }
    const echo = (u, sign) => {
      const spans = new Set()
      for (const m of u.text.matchAll(PROSE_TOKEN)) if (/^[\w.$-]{2,40}(\(\))?$/.test(m[1])) {
        const sp = m[1].replace(/\(\)$/, '')
        spans.add(sp)
        // a dotted key (options.server.region) is stated elsewhere by its last part
        const last = sp.split('.').pop()
        if (last !== sp && last.length > 2) spans.add(last)
      }
      const found = []
      for (const sp of spans) {
        if (mask(sp) !== sp) continue // a model name: it is the model's, not a stated fact
        const re = new RegExp('(?<![\\w$])' + sp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w])')
        const hits = outside.filter((o) => re.test(o.l))
        if (!hits.length || hits.length > 4) continue
        found.push(`\`${sp}\` at ${hits[0].d}:${hits[0].k}: ${hits[0].l.trim().slice(0, 150)}${hits.length > 1 ? ` (+${hits.length - 1} more)` : ''}`)
      }
      if (found.length) add('echo', u.kind, mask(u.text), [(sign === '-' ? '(removed) ' : '') + u.text, 'still stated, unchanged, elsewhere in this SDK: ' + found.join(' | ')], v, u.ctx)
    }
    for (const p of r.reworded) echo(p.n, '+')
    for (const u of r.added) echo(u, '+')
    for (const u of r.missing) echo(u, '-')
    for (const p of r.reworded) {
      const label = p.o.key ? `${p.o.col} of ${p.o.row}` : p.o.kind + (p.o.kind !== p.n.kind ? ' -> ' + p.n.kind : '')
      add('reworded', p.o.kind + (p.o.key ? ':' + mask(p.o.col) : ''), mask(p.o.text) + '\u0000' + mask(p.n.text), [p.o.text, p.n.text, label], v, p.o.ctx)
    }
    for (const u of r.missing) add('missing', u.kind, mask(u.text), [u.text], v, u.ctx)
    for (const u of r.added) add('added', u.kind, mask(u.text), [u.text], v, u.ctx)
  }
  // Tokens: words of the section that one side has and the other never has.
  // Entity and field names are left out (they vary with the model).
  const V = C.vocab([a.old, a.new])
  const isModel = (t) => V.entities.some((e) => t.toLowerCase().includes(e.toLowerCase())) || V.fields.includes(t) || V.sdk.includes(t)
  for (const [t, x] of nTok) if (!oTok.has(t) && !isModel(t)) add('novel-token', 'token', t, [t + `  (${x.n} times)`], x.v, x.ctx)
  for (const [t, x] of oTok) if (!nTok.has(t) && !isModel(t)) add('vanished-token', 'token', t, [t + `  (${x.n} times)`], x.v, x.ctx)
  // entity-named tokens that are new in shape (utilitys): masked shape novel
  const shape = (m) => new Set([...m.keys()].filter(isModel).map(mask))
  const os = shape(oTok)
  for (const [t, x] of nTok) if (isModel(t) && !os.has(mask(t)) && !oTok.has(t)) add('novel-token', 'token', mask(t), [t + `  (${x.n} times; the shape ${mask(t)} is new)`], x.v, x.ctx)
  return { section, lang, tally, classes: [...classes.values()] }
}

// An outcome the class's type does not allow: an echo is a contradiction, a
// defect, or same-meaning with a reason; a missing unit or an echo is never
// accepted as a shared sentence (classify.js does not, and a hand edit cannot).
function invalidFor(c, d) {
  if ('echo' === c.type && !/^(contradiction|defect|same-meaning)$/.test(d.outcome)) return `an echo is contradiction, defect or same-meaning (was ${d.outcome})`
  if ('echo' === c.type && 'same-meaning' === d.outcome && !(d.why && d.why.trim())) return 'an echo is same-meaning only with a reason'
  if (/^shared:/.test(d.outcome) && !/^(reworded|added)$/.test(c.type)) return `a ${c.type} class is never matched automatically`
  if ('missing' === c.type && !/^rule:/.test(d.by || '') && !(d.why && d.why.trim())) return 'a missing unit is restored (say where) or dropped (say why)'
  if ('missing' === c.type && /^rule:/.test(d.by || '')) return 'a missing unit is classified by hand, never by a rule'
  return null
}

function render(r, decided) {
  const L = []
  const t = r.tally
  L.push(`# ledger ${r.lang} ${r.section}: ${t.variations} variations, OLD ${t.oldUnits} units, NEW ${t.newUnits}`)
  L.push(`# units: same ${t.same}, reworded ${t.reworded}, missing ${t.missing}, added ${t.added}`)
  const order = ['dangling', 'echo', 'missing', 'reworded', 'added', 'vanished-token', 'novel-token']
  for (const type of order) {
    const cs = r.classes.filter((c) => c.type === type).sort((a, b) => b.n - a.n)
    if (!cs.length) continue
    L.push('', `## ${type}: ${cs.length} classes`)
    for (const c of cs) {
      const d = decided[c.id]
      L.push(`[${c.id}] ${d ? d.outcome + (d.why ? ' (' + d.why + ')' : '') : 'UNCLASSIFIED'}  ${c.kind}  x${c.n} in ${c.vars.size} var  @ ${c.where}`)
      if ('dangling' === type || 'echo' === type) { L.push('   + ' + c.show[0]); L.push('     (' + c.show[1] + ')') }
      else if ('reworded' === type) { L.push('   - ' + c.show[0]); L.push('   + ' + c.show[1]); if (c.show[2] && c.show[2] !== c.kind) L.push('     (' + c.show[2] + ')') }
      else L.push('   ' + ('missing' === type || 'vanished-token' === type ? '- ' : '+ ') + c.show[0])
    }
  }
  return L.join('\n') + '\n'
}

function main() {
  const a = K.args(process.argv.slice(2), { classes: Path.join(__dirname, 'classes'), out: Path.join(__dirname, 'review') })
  if (!a.old || !a.new) { console.error('usage: node ledger.js --old <root> --new <root> [--lang l] [--section s] [--vars v,..] [--classes dir] [--out dir] [--template] [--json]'); process.exit(2) }
  let bad = 0
  const json = []
  for (const { section, lang, ported } of K.plan(a)) {
    const r = run(a, section, lang)
    const cfile = Path.join(a.classes, lang + '.json')
    const decided = K.loadClasses(cfile)
    const byType = {}
    let un = 0, defect = 0
    const contra = []
    for (const c of r.classes) {
      byType[c.type] = (byType[c.type] || 0) + 1
      const d = decided[c.id]
      // a class reviewed at another size is reviewed again: a regression that
      // joins an already classified class changes its count
      if (d && null != d.n && d.n !== c.n) { d.outcome = 'RECOUNT'; d.why = `classified at x${d.n}, now x${c.n}` }
      const bad = d && invalidFor(c, d)
      if (bad) { d.outcome = 'INVALID'; d.why = bad }
      if (!d || 'RECOUNT' === d.outcome || 'INVALID' === d.outcome) un++; else if ('defect' === d.outcome) defect++
      if (d && 'contradiction' === d.outcome) contra.push({ id: c.id, text: c.show[0], where: d.where, true: d.true, evidence: d.evidence })
    }
    const outFile = Path.join(a.out, lang, section + '.ledger.txt')
    K.writeFile(outFile, render(r, decided))
    if (a.template) {
      const tf = Path.join(a.out, lang, section + '.ledger.template.json')
      const tmpl = {}
      for (const c of r.classes) if (!decided[c.id]) tmpl[c.id] = { outcome: '', why: '', n: c.n, type: c.type, text: c.show.slice(0, 2).join('  =>  ').slice(0, 300) }
      K.writeFile(tf, JSON.stringify(tmpl, null, 1) + '\n')
    }
    const t = r.tally
    const by = {}
    for (const c of r.classes) { const d = decided[c.id]; const k = !d || /^(RECOUNT|INVALID)$/.test(d.outcome) ? 'open' : /^shared:/.test(d.outcome) ? 'shared' : 'contradiction' === d.outcome ? 'contradiction' : 'defect' === d.outcome ? 'defect' : 'missing' === c.type ? 'missing' : /^rule:/.test(d.by || '') ? 'rule' : 'hand'; by[k] = (by[k] || 0) + 1 }
    const line = `ledger ${lang.padEnd(7)} ${section.padEnd(9)} ${ported ? '' : '(unported) '}vars ${t.variations} | units OLD ${t.oldUnits} NEW ${t.newUnits}: same ${t.same} reworded ${t.reworded} missing ${t.missing} added ${t.added} | classes ${r.classes.length} (${Object.entries(byType).map(([k, v]) => k + ' ' + v).join(', ')}) | shared ${by.shared || 0}, stage-3a rule record ${by.rule || 0}, by hand ${by.hand || 0}, missing (classified) ${by.missing || 0}, contradictions ${contra.length} | unclassified ${un}, defect ${defect} -> ${Path.relative(process.cwd(), outFile)}`
    if (!a.json) { console.log(line); for (const x of contra) console.log(`  contradiction [${x.id}] ${String(x.text).slice(0, 100)}\n      other: ${x.where}\n      true: ${x.true}; evidence: ${x.evidence}`) }
    json.push({ lang, section, ported, tally: t, classes: r.classes.length, byType, by, contradictions: contra, unclassified: un, defect, file: outFile })
    if (un || defect) bad++
  }
  if (a.json) console.log(JSON.stringify(json, null, 1))
  process.exit(bad ? 1 : 0)
}

module.exports = { run, pairSection, invalidFor }
if (require.main === module) main()
