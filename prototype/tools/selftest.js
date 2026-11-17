// node selftest.js --clone <clone> --old <root> --new <root> [--stage2 <root with old/ new/>] [--v32 <tools dir of v3.2 records>] [--only part,..] [--modes reviewed,scratch]
//
// The tools test themselves, and fail when one has gone blind. Nothing under
// tools/classes, tools/hand or tools/review is written: injections run on a
// root of links to <new> (the injected variation copied), with a copy of
// classes/ and their own review directory under a temporary directory.
//   ledger  each injected regression (controls/injections.json) is flagged:
//           classify + ledger + blocks leave a class open that was not open
//           before the injection (or count one again);
//   accept  each injected false sentence (controls/accept.json) leaves EVERY
//           class it creates for a person: none is accepted as a shared
//           sentence or by a rule record;
//   purity  each provider mutation (controls/purity.json) is an open finding,
//           and the real providers' notes are found and clean;
//   blocks  the block tables of the eight reference languages are the
//           recorded ones (controls/blocktables.txt), and a changed block a
//           normalizer does not explain stays "otherwise";
//   recall  the stage-2 worklists, rebuilt by these tools, flag at least the
//           recorded number of the 51 checker items (needs --stage2).
//   recheck the independent re-check's own 19 injections (controls/recheck.json),
//           each flagged as `ledger` requires;
//   missing a shared sentence dropped from one variation, from every variation,
//           and a table row dropped (controls/missing.json): a new open class
//           (printed less often than its reference), or a new entry in the
//           list of sentences the same result style prints and this language
//           does not (<section>.absent.json);
//   facts   provider mutations of a language or convention fact and of one
//           enumerated fact (controls/factmut/): the fact sheet fails naming
//           the mutated fact; in the reviewed mode against a control hand file
//           recording the true values, so that the unmutated output passes;
//   sentences a reference sentence marked `false` in reviewed/sentences.json
//           is never matched, and every shared match records its verdict.
//   samefact a language's own fact of ANOTHER path where a reference's fact
//           stands (controls/samefact.json): left for a person, nothing
//           accepted automatically, in both modes;
//   pages   pagecheck.js on the unchanged pages of every listed language (no
//           finding) and on a wrong step count, heading number and article
//           (controls/pages.json): a finding of the expected kind;
//   masking a shared word the v3.2 mask hid as a model name or a fact
//           (controls/masking.json), changed on one page: a new class left
//           for a person and nothing accepted automatically, in both modes;
//   identity one template in several languages is one sentence id (printer
//           output, member names, labels, articles, class shapes, numbers,
//           comment facts, a value with its own backticks); a shared word or
//           literal is not a slot; go's bold step lead is split, a
//           `**Returns:**` lead is not; the fixture model's text is left out;
//           a stale build and a stale hand record fail; re-keying records
//           keyed by this code changes nothing (twice), and re-keying the
//           v3.2 records (--v32) loses no hand entry.
// ledger, accept, recheck and missing run in each mode of --modes (default
// both): `reviewed` (hand entries, rule records, the previous record) and
// `scratch` (classify.js --scratch: every class new, as for a new language,
// written to its own classes directory so the references stay reviewed).
const Fs = require('node:fs')
const Path = require('node:path')
const CP = require('node:child_process')
const Os = require('node:os')
const K = require('./common.js')
const Classify = require('./classify.js')
const C0 = require('./cut.js')

const a = K.args(process.argv.slice(2))
if (!a.clone || !a.old || !a.new) { console.error('usage: node selftest.js --clone <clone> --old <root> --new <root> [--stage2 <root>] [--only ledger,accept,purity,blocks,recall]'); process.exit(2) }
const ONLY = K.list(a.only)
const MODES = K.list(a.modes) || ['reviewed', 'scratch']
const want = (p) => !ONLY || ONLY.includes(p)
const CTL = Path.join(__dirname, 'controls')
const TMP = Fs.mkdtempSync(Path.join(a.tmp || Os.tmpdir(), 'selftest-'))
const W = Path.join(TMP, 'new'), TC = Path.join(TMP, 'classes'), TR = Path.join(TMP, 'review'), TCS = Path.join(TMP, 'classes-scratch')
const NEW = Path.resolve(a.new), OLD = Path.resolve(a.old)
const results = []
const t0 = Date.now()
const progress = (msg) => console.log(`[selftest ${((Date.now() - t0) / 1000).toFixed(0)}s] ${msg}`)
const MOVED = (() => { try { return JSON.parse(Fs.readFileSync(Path.join(__dirname, 'controls', 'moved.json'), 'utf8')).moved } catch (e) { return {} } })()
const record = (part, id, ok, detail) => {
  const why = !ok && MOVED[part + ' ' + id]
  results.push({ part, id, ok: ok || !!why, moved: !!why, detail })
  console.log(`  ${ok ? 'ok  ' : why ? 'MOVED' : 'FAIL'} ${part} ${id}: ${detail}${why ? ' -- moved: ' + why.slice(0, 160) : ''}`)
}

Fs.mkdirSync(W); Fs.cpSync(Path.join(__dirname, 'classes'), TC, { recursive: true }); Fs.mkdirSync(TCS)
for (const v of Fs.readdirSync(NEW)) if (Fs.statSync(Path.join(NEW, v)).isDirectory()) Fs.symlinkSync(Path.join(NEW, v), Path.join(W, v))

const node = (args) => { try { return { rc: 0, out: CP.execFileSync(process.execPath, args, { stdio: 'pipe', maxBuffer: 1 << 28 }).toString() } } catch (e) { return { rc: e.status, out: String(e.stdout) + String(e.stderr) } } }

// open ids for one language and section: classify's open classes, plus what ledger and blocks leave unclassified
// In the scratch mode classify ignores hand and pinned records and writes to
// its own directory, so the reference languages' classes stay the reviewed ones.
function state(lang, section, mode = 'reviewed') {
  const scratch = 'scratch' === mode
  const cdir = scratch ? TCS : TC
  const r = Classify.run({ clone: a.clone, old: OLD, new: W, lang, section, classes: TC, out: TR, cache: true, scratch, ...(scratch ? { 'out-file': Path.join(TCS, lang + '.json') } : {}) })
  const open = new Set(Object.keys(r.open || {}))
  let un = 0
  for (const tool of ['ledger.js', 'blocks.js']) {
    const x = node([Path.join(__dirname, tool), '--old', OLD, '--new', W, '--lang', lang, '--section', section, '--classes', cdir, '--out', TR, '--json'])
    try { for (const e of JSON.parse(x.out)) un += e.unclassified } catch (e) { un = NaN }
  }
  // an absent entry counts only without a reason: one with a reason does not fail the one command (T1)
  return { open, decided: r.decided || {}, un, absent: new Set(Object.entries(r.absent || {}).filter(([, x]) => !x.why).map(([k]) => k)), openInfo: r.open || {} }
}

function withInjection(j, fn) {
  const edits = j.edits || [{ file: j.file, from: j.from, to: j.to, all: j.all }]
  const copied = new Set()
  let err = null
  for (const e of edits) {
    const files = e.file.includes('*') ? Fs.readdirSync(W).map((v) => e.file.replace('*', v)).filter((f) => Fs.existsSync(Path.join(W, f))) : [e.file]
    for (const f of files) {
      const v = f.split('/')[0]
      // a real copy (links dereferenced): an edit must never reach the output it was copied from
      if (!copied.has(v)) { Fs.unlinkSync(Path.join(W, v)); Fs.cpSync(Fs.realpathSync(Path.join(NEW, v)), Path.join(W, v), { recursive: true, dereference: true }); copied.add(v) }
      const p = Path.join(W, f), t = Fs.readFileSync(p, 'utf8')
      if (!Fs.realpathSync(p).startsWith(Fs.realpathSync(TMP) + Path.sep)) throw new Error(`selftest: refusing to write ${Fs.realpathSync(p)}, outside its scratch directory`)
      if (!t.includes(e.from)) { if (!e.file.includes('*')) err = `${f}: text to inject not found`; continue }
      Fs.writeFileSync(p, e.all ? t.split(e.from).join(e.to) : t.replace(e.from, e.to))
    }
  }
  try { return err ? { err } : fn() } finally {
    for (const v of copied) { Fs.rmSync(Path.join(W, v), { recursive: true, force: true }); Fs.symlinkSync(Path.join(NEW, v), Path.join(W, v)) }
  }
}

const base = new Map()
function baseline(lang, section, mode) {
  const k = lang + '/' + section + '/' + mode
  if (!base.has(k)) { base.set(k, state(lang, section, mode)); if ('reviewed' === mode) Fs.copyFileSync(Path.join(TC, lang + '.json'), Path.join(TMP, lang + '.base.json')) }
  return base.get(k)
}
const restoreClasses = (lang) => { const f = Path.join(TMP, lang + '.base.json'); if (Fs.existsSync(f)) Fs.copyFileSync(f, Path.join(TC, lang + '.json')) }

function injected(j, mode = 'reviewed') {
  const b = baseline(j.lang, j.section, mode)
  const r = withInjection(j, () => state(j.lang, j.section, mode))
  restoreClasses(j.lang)
  if (r.err) return { err: r.err }
  const newOpen = [...r.open].filter((id) => !b.open.has(id))
  const auto = Object.entries(r.decided).filter(([id, d]) => !(id in b.decided) && 'hand' !== d.by).map(([id, d]) => `${id} ${d.type} -> ${d.outcome} (${d.by})`)
  const newAbsent = [...r.absent].filter((id) => !b.absent.has(id))
  const fewer = newOpen.filter((id) => /fewer variations/.test((r.openInfo[id] || {}).hint || ''))
  return { newOpen, auto, un: r.un, baseUn: b.un, newAbsent, fewer }
}

// What a mode found the from-scratch holes to be: an injection that leaves no
// new open class (and no new unclassified count) from scratch.
const holes = []
const tag = (mode) => 'scratch' === mode ? ' [scratch]' : ''

if (want('ledger') || want('accept') || want('recheck') || want('missing') || want('masking') || want('samefact')) {
  const inj = want('ledger') ? JSON.parse(Fs.readFileSync(Path.join(CTL, 'injections.json'), 'utf8')) : []
  const acc = want('accept') ? JSON.parse(Fs.readFileSync(Path.join(CTL, 'accept.json'), 'utf8')) : []
  const rck = want('recheck') ? JSON.parse(Fs.readFileSync(Path.join(CTL, 'recheck.json'), 'utf8')) : []
  const mis = want('missing') ? JSON.parse(Fs.readFileSync(Path.join(CTL, 'missing.json'), 'utf8')) : []
  // a shared word the v3.2 mask hid as a model name (or as a fact), changed on one page
  const msk = want('masking') ? JSON.parse(Fs.readFileSync(Path.join(CTL, 'masking.json'), 'utf8')) : []
  // a language's own fact of ANOTHER path where a reference's fact stands (the sentence round's check)
  const sfx = want('samefact') ? JSON.parse(Fs.readFileSync(Path.join(CTL, 'samefact.json'), 'utf8')) : []
  const total = (inj.length + acc.length + rck.length + mis.length + msk.length + sfx.length) * MODES.length
  progress(`injections: ${inj.length} regressions, ${acc.length} false sentences, ${rck.length} of the re-check's, ${mis.length} dropped sentences; modes ${MODES.join(', ')} (${total} runs)`)
  let i = 0
  const pct = () => `${i}/${total}, ${Math.round(100 * i / total)}%`
  for (const mode of MODES) {
    progress(`mode ${mode}`)
    for (const [part, list] of [['ledger', inj], ['recheck', rck]]) for (const j of list) {
      i++
      const r = injected(j, mode)
      if (r.err) { record(part, j.id + tag(mode), false, r.err); continue }
      // an absent or dropped sentence with no reason fails the one command as an open class does
      const flagged = r.newOpen.length > 0 || r.un > r.baseUn || r.newAbsent.length > 0
      if (!flagged && 'scratch' === mode) holes.push(`${part} ${j.id}`)
      record(part, j.id + tag(mode), flagged, `${flagged ? 'flagged' : 'NOT FLAGGED'}: ${r.newOpen.length} new open class(es)${r.fewer.length ? ` (${r.fewer.length} printed less often than its reference)` : ''}, ${r.newAbsent.length} new absent or dropped sentence(s), unclassified ${r.baseUn} -> ${r.un} (${pct()})`)
    }
    for (const [part, list] of [['accept', acc], ['masking', msk], ['samefact', sfx]]) for (const j of list) {
      i++
      const r = injected(j, mode)
      if (r.err) { record(part, j.id + tag(mode), false, r.err); continue }
      const ok = 0 === r.auto.length && r.newOpen.length > 0
      if (!ok && 'scratch' === mode) holes.push(`${part} ${j.id}`)
      record(part, j.id + tag(mode), ok, `${r.newOpen.length} new class(es) left for a person; accepted automatically: ${r.auto.length ? r.auto.join('; ') : 'none'} (${pct()})`)
    }
    for (const j of mis) {
      i++
      const r = injected(j, mode)
      if (r.err) { record('missing', j.id + tag(mode), false, r.err); continue }
      const ok = r.newOpen.length > 0 || r.un > r.baseUn || r.newAbsent.length > 0
      record('missing', j.id + tag(mode), ok, `${ok ? 'flagged' : 'NOT FLAGGED'}: ${r.newOpen.length} new open class(es), ${r.fewer.length} printed less often than its reference, ${r.newAbsent.length} new absent sentence(s), unclassified ${r.baseUn} -> ${r.un} (${pct()})`)
    }
  }
}

if (want('pages')) {
  // pagecheck.js: a number the page determines and the article before a word,
  // checked against the page (identity and the match form set both aside).
  // The check reads no hand record, so the reviewed mode and the from-scratch
  // mode run it alike: each control runs once per mode.
  progress('page numbers and articles (controls/pages.json)')
  const PC = require('./pagecheck.js')
  const list = JSON.parse(Fs.readFileSync(Path.join(CTL, 'pages.json'), 'utf8'))
  const langs = [...new Set([...list.map((x) => x.lang), ...Object.values(C0.REG.ported).flat()])]
  for (const l of langs) { const r = PC.run({ new: NEW, lang: l }); record('pages', 'clean:' + l, 0 === r.findings.length, `${r.findings.length} finding(s) on the unchanged pages (${r.counts.steps} step counts, ${r.counts.headings} numbered headings, ${r.counts.lists} lists, ${r.counts.articles} articles, ${r.counts.notJudged} not judged)${r.findings[0] ? ': ' + r.findings[0].why : ''}`) }
  for (const mode of MODES) for (const j of list) {
    const r = withInjection(j, () => PC.run({ new: W, lang: j.lang, section: j.section }))
    if (r.err) { record('pages', j.id + tag(mode), false, r.err); continue }
    const hit = r.findings.filter((f) => f.kind === j.expect)
    record('pages', j.id + tag(mode), hit.length > 0, `${r.findings.length} finding(s): ${hit[0] ? hit[0].kind + ' ' + hit[0].why : 'NONE of kind ' + j.expect}`)
  }
}

if (want('facts')) {
  progress('fact mutations (controls/factmut)')
  const FM = Path.join(CTL, 'factmut')
  const idx = JSON.parse(Fs.readFileSync(Path.join(FM, 'index.json'), 'utf8')).mutations
  const GR = Path.join(TMP, 'guard-report.txt')
  const sheet = (root, lang, mode, override) => {
    const out = Path.join(TMP, 'facts-' + Math.random().toString(36).slice(2))
    const args = [Path.join(__dirname, 'factsheet.js'), '--clone', a.clone, '--old', OLD, '--new', root, '--lang', lang, '--guard-report', GR, '--out', out, ...('scratch' === mode ? ['--scratch'] : ['--hand', Path.join(FM, 'hand', lang + '.json')])]
    let rc = 0
    try { CP.execFileSync(process.execPath, args, { stdio: 'pipe', env: { ...process.env, ...(override ? { TOOLS_SYNTAX_OVERRIDE: override } : {}) } }) } catch (e) { rc = e.status }
    const j = JSON.parse(Fs.readFileSync(Path.join(out, lang, 'facts.json'), 'utf8'))
    return { rc, un: j.unattested.map((x) => x.path), rows: j.unattested }
  }
  let i = 0
  for (const m of idx) for (const mode of MODES) {
    // a control that only a decision can catch runs in the reviewed mode only (index.json `modes`)
    if (m.modes && !m.modes.includes(mode)) continue
    i++
    // the output under test with the mutated language's files laid over it
    const R = Path.join(TMP, 'fm-' + m.id)
    if (!Fs.existsSync(R)) {
      Fs.mkdirSync(R)
      for (const v of Fs.readdirSync(NEW)) {
        const over = Path.join(FM, m.id, 'new', v)
        if (!Fs.existsSync(over)) { Fs.symlinkSync(Path.join(NEW, v), Path.join(R, v)); continue }
        Fs.cpSync(Fs.realpathSync(Path.join(NEW, v)), Path.join(R, v), { recursive: true, dereference: true })
        Fs.cpSync(over, Path.join(R, v), { recursive: true })
      }
    }
    const b = sheet(NEW, m.lang, mode, null)
    const x = sheet(R, m.lang, mode, Path.join(FM, m.id, 'override.json'))
    const named = x.un.includes(m.fact) && 0 !== x.rc
    const disc = !b.un.includes(m.fact)
    const ok = named && ('scratch' === mode || disc)
    const why = (x.rows.find((r) => r.path === m.fact) || {}).detail || ''
    record('facts', m.id + tag(mode), ok, `${m.change}: fact sheet ${0 !== x.rc ? 'fails' : 'PASSES'}, unattested ${x.un.join(', ') || 'none'}${named ? ` (names ${m.fact}: ${String(why).slice(0, 80)})` : ` (DOES NOT NAME ${m.fact})`}; unmutated: ${b.un.length ? b.un.join(', ') : 'none'}${disc ? '' : ' (the true value is itself unattested in this mode)'} (${i}/${idx.length * MODES.length})`)
  }
}

if (want('sentences')) {
  progress('sentence verdicts')
  // a reference sentence marked false is never matched: the rb class matched against it opens
  const lang = 'rb', section = 'reference'
  const r0 = Classify.run({ clone: a.clone, old: OLD, new: NEW, lang, section, classes: TC, out: TR, scratch: true, dry: true })
  const cls = JSON.parse(Fs.readFileSync(Path.join(TC, lang + '.json'), 'utf8'))
  const shared = Object.entries(r0.decided || {}).filter(([, d]) => 'shared' === d.by)
  const recorded = shared.length && shared.every(([id]) => true)
  const sf = Path.join(TMP, 'sentences-false.json')
  // the first matched class's reference sentences, marked false
  const tf = Path.join(TMP, 'probe-classes.json')
  Classify.run({ clone: a.clone, old: OLD, new: NEW, lang, section, classes: TC, out: TR, scratch: true, 'out-file': tf })
  const probe = JSON.parse(Fs.readFileSync(tf, 'utf8'))
  const [pid, pd] = Object.entries(probe).find(([, d]) => 'shared' === d.by && d.sentences && d.sentences.length)
  record('sentences', 'shared-records-verdict', Object.values(probe).filter((d) => 'shared' === d.by).every((d) => Array.isArray(d.sentences) && 'number' === typeof d.unreviewed), `${shared.length} shared matches, each records its reference sentences and how many have no verdict`)
  Fs.writeFileSync(sf, JSON.stringify({ sentences: Object.fromEntries(pd.sentences.map((x) => [x, { verdict: 'false', note: 'selftest' }])) }))
  const r1 = Classify.run({ clone: a.clone, old: OLD, new: NEW, lang, section, classes: TC, out: TR, scratch: true, dry: true, sentences: sf })
  record('sentences', 'false-never-matched', !!(r1.open || {})[pid] && !((r1.decided || {})[pid]), `class ${pid} (${pd.outcome}) with its sentence marked false: ${(r1.open || {})[pid] ? 'left open' : 'STILL MATCHED as ' + ((r1.decided || {})[pid] || {}).outcome}`)
  void cls; void recorded
}

if (want('regen')) {
  // T5: the one command with REGEN=1 measures nothing it did not regenerate.
  // A generator that throws (a clone with no generator in it) and a
  // regeneration that skips a variation old/ holds (the alias variation, from
  // a clone outside a workspace) must each fail before any number is printed.
  progress('regeneration: a generation that throws, and one that regenerates fewer variations than old/ holds')
  const pc = Path.join(__dirname, 'portcheck.sh')
  const mk = (name) => { const r = Path.join(TMP, 'regen-' + name); Fs.mkdirSync(Path.join(r, 'new'), { recursive: true }); Fs.symlinkSync(OLD, Path.join(r, 'old')); return r }
  const run = (clone, root) => { try { return { rc: 0, out: CP.execFileSync('bash', [pc, clone, root, 'lua'], { stdio: 'pipe', env: { ...process.env, REGEN: '1' }, maxBuffer: 1 << 26 }).toString() } } catch (e) { return { rc: e.status, out: String(e.stdout) + String(e.stderr) } } }
  const bad = Path.join(TMP, 'regen-noclone'); Fs.mkdirSync(Path.join(bad, 'ts'), { recursive: true })
  const r1 = run(bad, mk('throw'))
  record('regen', 'generation-throws', 0 !== r1.rc && /REGENERATION FAILED/.test(r1.out) && !/^== portcheck/m.test(r1.out), `exit ${r1.rc}: ${(/REGENERATION FAILED[^\n]*|regenerated[^\n]*/.exec(r1.out) || ['no line'])[0].slice(0, 120)}`)
  // old/ holds one variation more than the generator makes, so the control
  // does not depend on where the clone sits (a clone inside a workspace
  // stages the alias variation, and then nothing is short)
  const short = Path.join(TMP, 'regen-short'); Fs.mkdirSync(Path.join(short, 'new'), { recursive: true }); Fs.mkdirSync(Path.join(short, 'old'))
  for (const v of Fs.readdirSync(OLD)) Fs.symlinkSync(Path.join(Fs.realpathSync(OLD), v), Path.join(short, 'old', v))
  Fs.cpSync(Path.join(Fs.realpathSync(OLD), 'B'), Path.join(short, 'old', 'zz-not-generated'), { recursive: true })
  const r2 = run(a.clone, short)
  record('regen', 'regeneration-short', 0 !== r2.rc && /REGENERATION SHORT/.test(r2.out) && !/^== portcheck/m.test(r2.out), `exit ${r2.rc}: ${(/REGENERATION SHORT[^\n]*|regenerated[^\n]*/.exec(r2.out) || ['no line'])[0].slice(0, 140)}`)
}

if (want('calls')) {
  // The printed-call check (callcheck.js): each reviewer's changed example
  // that it can see is a finding of the kind expected; the ones it cannot see
  // (expect: none) are run too, so the report says what it misses.
  progress('printed calls (controls/calls.json)')
  const CC = require('./callcheck.js')
  const list = JSON.parse(Fs.readFileSync(Path.join(CTL, 'calls.json'), 'utf8'))
  const base0 = {}
  for (const l of [...new Set(list.map((x) => x.lang))]) base0[l] = CC.run({ clone: a.clone, new: NEW, lang: l }).findings.length
  for (const l of Object.keys(base0)) record('calls', 'clean:' + l, 0 === base0[l], `${base0[l]} finding(s) on the unchanged pages`)
  for (const j of list) {
    const R = Path.join(TMP, 'calls-' + j.id)
    Fs.mkdirSync(R)
    for (const v of Fs.readdirSync(NEW)) {
      const vd = Path.join(NEW, v)
      if (!Fs.statSync(vd).isDirectory()) continue
      const out = Path.join(R, v)
      Fs.cpSync(Fs.realpathSync(vd), out, { recursive: true, dereference: true })
      for (const f of [Path.join(out, 'README.md'), Path.join(out, j.lang, 'README.md'), Path.join(out, j.lang, 'REFERENCE.md')]) if (Fs.existsSync(f)) Fs.writeFileSync(f, Fs.readFileSync(f, 'utf8').replace(new RegExp(j.re, 'g'), j.to))
    }
    const r = CC.run({ clone: a.clone, new: R, lang: j.lang })
    const kinds = [...new Set(r.findings.map((f) => f.kind))]
    Fs.rmSync(R, { recursive: true, force: true })
    if ('none' === j.expect) console.log(`  info calls ${j.id}: ${kinds.length ? 'CAUGHT ' + kinds.join(',') : 'not caught, as stated'} (${j.why.slice(0, 90)})`)
    else record('calls', j.id, kinds.includes(j.expect), `${r.findings.length} finding(s): ${kinds.join(', ') || 'NONE'}${r.findings[0] ? ' - ' + r.findings[0].why.slice(0, 100) : ''}`)
  }
}

if (want('identity')) {
  progress('identity: one template one sentence, the bold lead, comment facts, model text, re-key, stale build, stale hand record')
  const C = require('./cut.js')
  const I = require('./ident.js').make({ clone: a.clone, old: OLD, new: NEW })
  const same = (id, xs, want = true) => {
    const ids = xs.map(([text, kind, lang]) => I.sentenceId(text, kind, lang))
    const ok = want === (new Set(ids).size === 1)
    record('identity', id, ok, `${want ? 'one id' : 'different ids'} expected: ${xs.map(([t, , l], k) => `${l} ${ids[k]} "${t.slice(0, 50)}"`).join(' | ')}`)
  }
  same('template-two-langs', [['A failure is reported in the result, not as an error, so branch on `result.ok`.', 'sentence', 'ts'], ['A failure is reported in the result, not as an error, so branch on `result["ok"]`.', 'sentence', 'py'], ['A failure is reported in the result, not as an error, so branch on `getp(&result, "ok") == Value::Bool(true)`.', 'sentence', 'rust']])
  same('member-name', [['Accepts the same parameters as `direct()`.', 'sentence', 'ts'], ['Accepts the same parameters as `Direct()`.', 'sentence', 'go'], ['Accepts the same parameters as `sdk_direct()`.', 'sentence', 'c']])
  same('label-none', [['The first argument holds the test feature\'s options, which the call switches on, and replaces any `options.feature.test` in the second, which holds the other client options; both may be `undefined`.', 'sentence', 'ts'], ['The first argument holds the test feature\'s options, which the call switches on, and replaces any `options["feature"]["test"]` in the second, which holds the other client options; both may be `nil`.', 'sentence', 'go'], ['The first argument holds the test feature\'s options, which the call switches on, and replaces any `feature.test` in the second, which holds the other client options; both may be `NULL`.', 'sentence', 'c']])
  same('article-and-class', [['Create a new `AmbientEntity` instance.', 'sentence', 'ts'], ['Create a new `Ambient` instance.', 'sentence', 'c'], ['Create a new `Demo.Entity.Ambient` instance.', 'sentence', 'elixir']])
  same('number', [['The program below runs these 2 steps in order.', 'sentence', 'go'], ['The program below runs these 4 steps in order.', 'sentence', 'go']])
  same('comment-fact', [['Load an ambient: Ok is the entity; Err holds the failure', 'comment', 'rust'], ['Load an ambient: .ok is the entity; .err holds the failure', 'comment', 'zig']])
  same('comment-collection', [['List planet records: a list of entities, one per record; raises on failure', 'comment', 'py'], ['List planet records: a vector of entities, one per record; raises on failure', 'comment', 'clojure']])
  same('vec-own-backticks', [['The result\'s `Ok` is a `Vec` of entities, one per record, and its `Err` reports failure.', 'sentence', 'rust'], ['The result\'s `.ok` is a slice of entities, one per record, and its `.err` reports failure.', 'sentence', 'zig']])
  // the converse: a shared word is not a slot
  same('shared-word-stays', [['Resolves to an array of entities, one per record, and throws on failure.', 'sentence', 'ts'], ['Resolves to an array of entities, one per planet, and throws on failure.', 'sentence', 'ts']], false)
  same('shared-literal-stays', [['A failure is reported in the result, not as an error, so branch on `result.ok`.', 'sentence', 'ts'], ['A failure is reported in the result, not as an error, and so branch on `result.ok`.', 'sentence', 'ts']], false)
  const parts = C.splitSentences('**Create a client.** The client reads its API key from the `DEMO_APIKEY` environment variable.')
  record('identity', 'bold-step-lead', 2 === parts.length && '**Create a client.**' === parts[0], `split into ${parts.length}: ${parts.map((p) => JSON.stringify(p.slice(0, 40))).join(' | ')}`)
  const ret = C.splitSentences('**Returns:** `dict`, the fetch definition: the request `direct()` would send.')
  record('identity', 'returns-lead-kept', 1 === ret.length, `**Returns:** lead kept with its sentence (${ret.length} unit)`)
  record('identity', 'model-text-left-out', I.isModelText('Words the project chose | not the spec') && I.isModelText('Level \\| percent see the guide or [site](https://example.com/x)') && !I.isModelText('The match must include `planet_id`.'), 'the fixture model\'s descriptions are model text; a shared sentence is not')
  // the stale build: a mirror whose one source is newer than its output
  const BF = require('./buildfresh.js')
  const real = BF.check(a.clone)
  record('identity', 'build-current', 0 === real.stale.length + real.missing.length + real.differ.length, `the clone: ${real.checked} sources, ${real.stale.length + real.missing.length + real.differ.length} stale`)
  const SB = Path.join(TMP, 'stalebuild', 'ts')
  for (const d of ['src/helpers', 'dist/helpers']) Fs.mkdirSync(Path.join(SB, d), { recursive: true })
  Fs.writeFileSync(Path.join(SB, 'dist/helpers/x.js'), '1'); Fs.utimesSync(Path.join(SB, 'dist/helpers/x.js'), new Date(1e12), new Date(1e12))
  Fs.writeFileSync(Path.join(SB, 'src/helpers/x.ts'), '1')
  const sb = node([Path.join(__dirname, 'buildfresh.js'), Path.dirname(SB)])
  record('identity', 'stale-build', 0 !== sb.rc && /STALE BUILD: ts\/src\/helpers\/x\.ts/.test(sb.out), sb.out.trim().split('\n')[0])
  // a model the generator reads from its staged copy: edited and not re-staged (the sentence round's check, required fix 4)
  const SM = Path.join(TMP, 'stalemodel', 'ts')
  for (const d of ['project/.sdk/model/feature', 'dist-test-scaffold/.sdk/model/feature']) Fs.mkdirSync(Path.join(SM, d), { recursive: true })
  Fs.writeFileSync(Path.join(SM, 'dist-test-scaffold/.sdk/model/feature/log.aontu'), 'active: true\n')
  Fs.writeFileSync(Path.join(SM, 'project/.sdk/model/feature/log.aontu'), 'active: false\n')
  const sm = node([Path.join(__dirname, 'buildfresh.js'), Path.dirname(SM)])
  record('identity', 'stale-staged-model', 0 !== sm.rc && /STALE BUILD: ts\/project\/\.sdk\/model\/feature\/log\.aontu differs/.test(sm.out), sm.out.trim().split('\n')[0])
  // the stale hand record: a reason quoting text that no page and no file holds
  const HS = require('./handstale.js')
  const hf = Path.join(TMP, 'hand-stale.json')
  Fs.writeFileSync(hf, JSON.stringify({ 'aaaaaaaaaa': { outcome: 'same-meaning', why: 'the page says `getp(result, "ok")` as it did', n: 1 }, 'bbbbbbbbbb': { outcome: 'same-meaning', why: 'the page says `voxgig_branch_on_okay(result)` as it did', n: 1 } }))
  const hs = HS.run({ clone: a.clone, old: OLD, new: NEW, lang: 'c', hand: hf })
  record('identity', 'stale-hand-record', 1 === hs.stale.length && 'bbbbbbbbbb' === hs.stale[0].id, `${hs.stale.length} stale: ${hs.stale.map((s) => s.id + ' ' + s.missing.join(',')).join('; ')}`)
  // a quotation only an OLD page holds stands only where the record says it quotes OLD (the sentence round's check, required fix 5)
  const ho = Path.join(TMP, 'hand-old-only.json')
  Fs.writeFileSync(ho, JSON.stringify({ 'cccccccccc': { outcome: 'same-meaning', why: 'the page says "Get the entity data. Pass a map to set it."', n: 1 }, 'dddddddddd': { outcome: 'same-meaning', why: 'OLD said "Get the entity data. Pass a map to set it."; NEW says the same', n: 1 } }))
  const hso = HS.run({ clone: a.clone, old: OLD, new: NEW, lang: 'c', hand: ho })
  record('identity', 'old-only-quotation', 1 === hso.stale.length && 'cccccccccc' === hso.stale[0].id, `${hso.stale.length} stale: ${hso.stale.map((s) => s.id).join('; ')} (a quotation only OLD holds, unmarked, is stale; marked OLD, it stands)`)
  // re-key: records keyed by this code are left alone, twice; a decision is never lost
  const RK = require('./rekey.js')
  const RT = Path.join(TMP, 'rekey')
  for (const d of ['hand', 'pinned', 'classes', 'counts', 'normalizers']) Fs.cpSync(Path.join(__dirname, d), Path.join(RT, d), { recursive: true })
  const lang = 'clojure'
  const before = Fs.readFileSync(Path.join(RT, 'hand', lang + '.json'), 'utf8')
  const r1 = RK.rekeyLang({ clone: a.clone, old: OLD, new: NEW, lang, from: RT })
  const r2 = RK.rekeyLang({ clone: a.clone, old: OLD, new: NEW, lang, from: RT })
  record('identity', 'rekey-idempotent', r1.already && r2.already && before === Fs.readFileSync(Path.join(RT, 'hand', lang + '.json'), 'utf8'), `records keyed by this code: ${r1.already ? 'left alone' : 'CHANGED'}, twice: ${r2.already ? 'left alone' : 'CHANGED'}`)
  // from the v3.2 records (the base, read-only) into a copy: every hand entry carried, stale before, or listed
  const RV = Path.join(TMP, 'rekey-v32')
  if (a.v32) {
    for (const d of ['hand', 'pinned', 'classes', 'counts', 'normalizers']) Fs.cpSync(Path.join(a.v32, d), Path.join(RV, d), { recursive: true })
    const v = RK.rekeyLang({ clone: a.clone, old: OLD, new: NEW, lang, from: RV })
    const handN = Object.keys(JSON.parse(Fs.readFileSync(Path.join(a.v32, 'hand', lang + '.json'), 'utf8'))).filter((k) => /^[0-9a-f]{10}$/.test(k)).length
    const accounted = v.stale.hand.length + v.dropped.hand.length + new Set(Object.keys(JSON.parse(Fs.readFileSync(Path.join(RV, 'hand', lang + '.json'), 'utf8'))).filter((k) => /^[0-9a-f]{10}$/.test(k))).size
    const again = RK.rekeyLang({ clone: a.clone, old: OLD, new: NEW, lang, from: RV })
    record('identity', 'rekey-never-loses', 0 === v.dropped.hand.length && again.already && accounted >= handN - v.merged.length, `${lang}: ${handN} hand entries -> carried ${v.carried.hand} (stale before ${v.stale.hand.length}, not carried ${v.dropped.hand.length}, conflicts ${v.conflicts.length}); re-keyed again: ${again.already ? 'nothing to do' : 'CHANGED'}`)
  }
}

if (want('purity')) {
  progress('purity mutations and the real notes')
  const cmp = Path.join(Path.resolve(a.clone), 'ts/project/.sdk/src/cmp')
  // a mirror of the clone's provider tree to mutate: sources copied, the built scaffold linked
  const M = Path.join(TMP, 'mut', 'ts')
  Fs.mkdirSync(Path.join(M, 'project/.sdk/src'), { recursive: true })
  Fs.cpSync(cmp, Path.join(M, 'project/.sdk/src/cmp'), { recursive: true })
  Fs.symlinkSync(Path.join(Path.resolve(a.clone), 'ts/dist-test-scaffold'), Path.join(M, 'dist-test-scaffold'))
  Fs.symlinkSync(Path.join(Path.resolve(a.clone), 'ts/project/.sdk/model'), Path.join(M, 'project/.sdk/model'))
  const r = node([Path.join(__dirname, 'puritymut.js'), Path.join(CTL, 'purity.json'), Path.join(M, 'project/.sdk/src/cmp'), NEW])
  for (const l of r.out.split('\n')) { const m = /^(\S+)\s+(FLAGGED|MISSED |ERROR)/.exec(l); if (m) record('purity', m[1], 'FLAGGED' === m[2], l.replace(/^\S+\s+/, '').slice(0, 150)) }
  const langs = Fs.readdirSync(Path.join(Path.resolve(a.clone), 'ts/dist-test-scaffold/.sdk/dist/cmp')).filter((l) => Fs.existsSync(Path.join(cmp, l, 'Syntax_' + l + '.ts')))
  const p = node([Path.join(__dirname, 'purity.js'), '--providers', cmp, '--lang', langs.join(','), '--root', NEW, '--json'])
  const pj = JSON.parse(p.out)
  for (const [l, x] of Object.entries(pj)) if (x.declaredNotes) {
    // a note finding a reviewer accepted with a reason (purity-allow/<lang>.json) is not open
    const acc = (x.accepted || []).map((y) => y.check + '\u0000' + y.text)
    const lint = x.syntax.lint.filter((f) => /^note/.test(f.check) && !acc.includes(f.check + '\u0000' + f.text)).length
    record('purity', 'notes:' + l, x.noteRegions > 0 && 0 === x.notesMissed.length && 0 === lint, `${x.declaredNotes} declared, ${x.noteRegions} region(s) found, ${x.notesMissed.length} outside a region, ${lint} open lint finding(s), ${(x.accepted || []).filter((y) => /^note/.test(y.check)).length} accepted`)
  }
}

if (want('blocks')) {
  progress('block tables')
  const exp = Fs.readFileSync(Path.join(CTL, 'blocktables.txt'), 'utf8').trim().split('\n').filter((l) => !l.startsWith('#'))
  const langs = [...new Set(exp.map((l) => l.split(/\s+/)[0]))]
  const r = node([Path.join(__dirname, 'blocktable.js'), OLD, NEW, ...langs])
  const got = r.out.trim().split('\n')
  for (const e of exp) { const k = e.split(/\s{2,}/)[0]; const g = got.find((x) => x.split(/\s{2,}/)[0] === k) || '(absent)'; record('blocks', k.replace(/\s+/g, ' '), g.replace(/\s+/g, ' ').trim() === e.replace(/\s+/g, ' ').trim(), g.replace(/\s+/g, ' ').trim().slice(k.length)) }
  // a block change no normalizer explains is "otherwise"
  // B's ts tutorial load block is byte-identical to OLD; renaming its variable is explained by no normalizer
  const j = { id: 'unexplained-block', lang: 'ts', section: 'tutorial', file: 'B/ts/README.md', from: 'const ambient = await client.Ambient().load()', to: 'const amb = await client.Ambient().load()', all: true }
  const x = withInjection(j, () => JSON.parse(node([Path.join(__dirname, 'blocks.js'), '--old', OLD, '--new', W, '--lang', 'ts', '--section', 'tutorial', '--classes', TC, '--out', TR, '--json']).out)[0])
  const b0 = JSON.parse(node([Path.join(__dirname, 'blocks.js'), '--old', OLD, '--new', W, '--lang', 'ts', '--section', 'tutorial', '--classes', TC, '--out', TR, '--json']).out)[0]
  record('blocks', 'unexplained-block', x.tally && x.tally.changed > b0.tally.changed, `otherwise ${b0.tally.changed} -> ${x.tally ? x.tally.changed : '?'}`)
}

if (want('recall') && a.stage2) {
  progress('recall on the stage-2 worklists')
  const R = Path.join(TMP, 'rev2'), E = Path.join(TMP, 'empty')
  Fs.mkdirSync(E)
  for (const t of ['ledger.js', 'blocks.js']) node([Path.join(__dirname, t), '--old', Path.join(a.stage2, 'old'), '--new', Path.join(a.stage2, 'new'), '--classes', E, '--out', R])
  const r = node([Path.join(__dirname, 'recall.js'), '--review', R])
  const m = /(\d+) items: flagged (\d+)/.exec(r.out)
  const floor = +Fs.readFileSync(Path.join(CTL, 'recall-floor.txt'), 'utf8').trim()
  record('recall', 'stage2-worklists', m && +m[2] >= floor, m ? `${m[2]} of ${m[1]} flagged (floor ${floor})` : 'recall did not run')
}

if (holes.length) console.log(`\nfrom scratch, no new open class (holes): ${holes.join('; ')}`)
const bad = results.filter((r) => !r.ok)
const by = {}
for (const r of results) { const k = r.part + (/ \[scratch\]$/.test(r.id) ? ' scratch' : ''); by[k] = by[k] || [0, 0]; by[k][r.ok ? 0 : 1]++ }
const moved = results.filter((r) => r.moved)
if (moved.length) console.log(`moved (controls/moved.json, each a finding): ${moved.map((r) => r.part + ' ' + r.id).join('; ')}`)
console.log(`\nselftest: ${results.length} controls, ${bad.length} failed, ${moved.length} moved (${Object.entries(by).map(([p, [o, f]]) => `${p} ${o}/${o + f}`).join(', ')}) in ${((Date.now() - t0) / 1000).toFixed(0)}s; scratch ${TMP}`)
if (a.json) Fs.writeFileSync(a.json, JSON.stringify(results, null, 1))
if (!a.keep) Fs.rmSync(TMP, { recursive: true, force: true })
process.exit(bad.length ? 1 : 0)
