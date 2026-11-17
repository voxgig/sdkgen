// node lines.js --clone <sdkgen-clone> [--base 9aebaf9e] [--rev HEAD|worktree] [--json]
//
// Source lines, total and without blanks and comments.
// BEFORE (at base): per family (ReadmeQuick_, ReadmeTopQuick_, ReadmeRef_) and
// per language, and the shared components of that time (ported.json
// sharedBefore). AFTER (at rev; `worktree` reads the files on disk): every
// shared file under ts/src that differs from base, by name, with its delta;
// per language the provider (Syntax_), the naming hook (Naming_), any guard
// forms (a cmp/<lang>/ file or a ts/test/ file whose name says forms or
// guard and names the language), any family component still present, and the
// delta of other per-language files the port touched. Measured for the
// languages the registry lists as ported; the rest is a PROJECTION.
const Fs = require('node:fs')
const Path = require('node:path')
const CP = require('node:child_process')
const C = require('./cut.js')
const K = require('./common.js')

const CMP = 'ts/project/.sdk/src/cmp/'

function main() {
  const a = K.args(process.argv.slice(2))
  if (!a.clone) { console.error('usage: node lines.js --clone <sdkgen-clone> [--base rev] [--rev HEAD|worktree] [--json]'); process.exit(2) }
  const base = a.base || C.REG.base
  const rev = a.rev || 'worktree'
  const git = (cmd) => CP.execSync('git ' + cmd, { cwd: a.clone, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 })
  const text = (r, p) => {
    try { return 'worktree' === r ? Fs.readFileSync(Path.join(a.clone, p), 'utf8') : git(`show ${r}:${p}`) } catch (e) { return null }
  }
  const count = (t) => {
    if (null == t) return { total: 0, ncnb: 0 }
    const L = t.replace(/\n$/, '').split('\n')
    let b = false, n = 0
    for (const l of L) {
      const s = l.trim()
      if (b) { if (s.includes('*/')) b = false; continue }
      if (s.startsWith('/*')) { if (!s.includes('*/')) b = true; continue }
      if ('' === s || s.startsWith('//')) continue
      n++
    }
    return { total: L.length, ncnb: n }
  }
  const c = (r, p) => count(text(r, p))
  const sum = (xs) => xs.reduce((x, y) => ({ total: x.total + y.total, ncnb: x.ncnb + y.ncnb }), { total: 0, ncnb: 0 })
  const sub = (x, y) => ({ total: x.total - y.total, ncnb: x.ncnb - y.ncnb })
  const fmt = (x) => `${x.total}/${x.ncnb}`
  const files = (r, dir) => 'worktree' === r
    ? (Fs.existsSync(Path.join(a.clone, dir)) ? Fs.readdirSync(Path.join(a.clone, dir)) : [])
    : (() => { try { return git(`ls-tree --name-only ${r} ${dir}/`).split('\n').filter(Boolean).map((f) => Path.basename(f)) } catch (e) { return [] } })()

  const langs = Object.keys(C.REG.languages)
  const fam = C.REG.families
  const sections = Object.keys(fam)
  const portedAny = langs.filter((l) => sections.some((s) => C.REG.ported[s].includes(l)))

  // BEFORE
  const before = { perLang: {}, perFamily: {}, shared: {} }
  for (const s of sections) before.perFamily[s] = { total: 0, ncnb: 0 }
  for (const l of langs) {
    const r = {}
    for (const s of sections) { r[s] = c(base, `${CMP}${l}/${fam[s]}_${l}.ts`); before.perFamily[s] = sum([before.perFamily[s], r[s]]) }
    before.perLang[l] = r
  }
  for (const s of sections) for (const p of C.REG.sharedBefore[s]) before.shared[p] = c(base, p)

  // AFTER: shared files under ts/src that differ from base
  const changed = ('worktree' === rev ? git(`diff --name-status ${base} -- ts/src`) + git(`ls-files --others --exclude-standard -- ts/src`).split('\n').filter(Boolean).map((f) => 'A\t' + f).join('\n')
    : git(`diff --name-status ${base} ${rev} -- ts/src`)).split('\n').filter(Boolean).map((l) => l.split('\t'))
  const shared = {}
  for (const [st, p] of changed) {
    const b = c(base, p), n = c(rev, p)
    shared[p] = { status: st[0], before: b, after: n, delta: sub(n, b) }
  }
  // AFTER: per language
  const perLang = {}
  for (const l of langs) {
    const dir = CMP + l
    const fsAfter = files(rev, dir)
    const pick = (re) => fsAfter.filter((f) => re.test(f))
    const r = {
      provider: sum(pick(new RegExp(`^Syntax_${l}\\.ts$`)).map((f) => c(rev, `${dir}/${f}`))),
      naming: sum(pick(new RegExp(`^Naming_${l}\\.ts$`)).map((f) => c(rev, `${dir}/${f}`))),
      guard: sum([...pick(/(Guard|Forms|forms)/).map((f) => c(rev, `${dir}/${f}`)),
        ...files(rev, 'ts/test').filter((f) => /(forms|guard)/i.test(f) && new RegExp(`(^|[_.-])${l}([_.-])`).test(f)).map((f) => c(rev, `ts/test/${f}`)),
        // a language's runtime forms: ts/test/runtimeforms/<lang>.ts
        ...files(rev, 'ts/test/runtimeforms').filter((f) => f === l + '.ts').map((f) => c(rev, `ts/test/runtimeforms/${f}`))]),
      // a family component still present for a section the language is ported for
      familyLeft: sum(sections.filter((s) => C.REG.ported[s].includes(l)).map((s) => c(rev, `${dir}/${fam[s]}_${l}.ts`))),
      familyLeftNames: sections.filter((s) => null != text(rev, `${dir}/${fam[s]}_${l}.ts`)).map((s) => fam[s] + (C.REG.ported[s].includes(l) ? '' : ' (not ported, not counted)')),
    }
    // other per-language files the port touched (naming functions extracted, and so on)
    let touched = []
    try {
      touched = ('worktree' === rev ? git(`diff --name-only ${base} -- ${dir}`) : git(`diff --name-only ${base} ${rev} -- ${dir}`)).split('\n').filter(Boolean)
        .filter((p) => !/\/(Syntax|Naming)_|\/(ReadmeQuick|ReadmeTopQuick|ReadmeRef)_/.test(p) && !/(Guard|Forms)/.test(p))
    } catch (e) { }
    r.otherDelta = sum(touched.map((p) => sub(c(rev, p), c(base, p))))
    r.otherFiles = touched.map((p) => Path.basename(p))
    perLang[l] = r
  }

  // Totals for the ported set, as measured, and a projection for the rest.
  const famBefore = (l) => sum(sections.filter((s) => C.REG.ported[s].includes(l)).map((s) => before.perLang[l][s]))
  const langAfter = (l) => sum([perLang[l].provider, perLang[l].naming, perLang[l].guard, perLang[l].familyLeft, perLang[l].otherDelta])
  const portedBefore = sum(portedAny.map(famBefore))
  const portedAfterLang = sum(portedAny.map(langAfter))
  const sharedBefore = sum(Object.values(before.shared))
  const sharedDelta = sum(Object.values(shared).filter((x, i) => /\/(cmp|helpers)\//.test(Object.keys(shared)[i])).map((x) => x.delta))
  const docShared = Object.fromEntries(Object.entries(shared).filter(([p]) => /\/(cmp|helpers)\//.test(p)))
  const measured = {
    languages: portedAny,
    before: sum([portedBefore, sharedBefore]),
    after: sum([portedAfterLang, sharedBefore, sharedDelta]),
  }
  measured.ratio = +(measured.before.total / measured.after.total).toFixed(2)
  measured.ratioNcnb = +(measured.before.ncnb / measured.after.ncnb).toFixed(2)
  const unported = langs.filter((l) => !portedAny.includes(l))
  const avg = portedAny.length ? { total: portedAfterLang.total / portedAny.length, ncnb: portedAfterLang.ncnb / portedAny.length } : { total: 0, ncnb: 0 }
  const allFamBefore = sum(langs.map((l) => sum(sections.map((s) => before.perLang[l][s]))))
  const projection = {}
  for (const k of [1, 1.5, 2]) {
    const after = sum([sharedBefore, sharedDelta, portedAfterLang, { total: Math.round(unported.length * avg.total * k), ncnb: Math.round(unported.length * avg.ncnb * k) }])
    const b = sum([allFamBefore, sharedBefore])
    projection['unported providers x' + k] = { before: b, after, ratio: +(b.total / after.total).toFixed(2), ratioNcnb: +(b.ncnb / after.ncnb).toFixed(2) }
  }
  const out = { base, rev, before, shared: docShared, otherShared: Object.fromEntries(Object.entries(shared).filter(([p]) => !/\/(cmp|helpers)\//.test(p))), perLang, measured, projection, note: 'measured: ported languages, every family they are ported for; projection: PROJECTION, the unported languages assumed to need a provider+hook the average size of the ported ones times k' }
  if (a.json) { console.log(JSON.stringify(out, null, 1)); return }
  console.log(`lines (total/without blanks and comments), base ${base}, after ${rev}, clone ${a.clone}`)
  console.log('BEFORE per family (all 20):', sections.map((s) => `${fam[s]}_ ${fmt(before.perFamily[s])}`).join(', '), '| shared then:', Object.entries(before.shared).map(([p, x]) => `${Path.basename(p)} ${fmt(x)}`).join(', '))
  for (const l of langs) {
    const b = before.perLang[l], r = perLang[l]
    const ported = sections.filter((s) => C.REG.ported[s].includes(l))
    console.log(`  ${l.padEnd(7)} before ${sections.map((s) => fmt(b[s])).join(' + ')}  | after${ported.length ? '' : ' (not ported)'}: Syntax ${fmt(r.provider)}, Naming ${fmt(r.naming)}, guard ${fmt(r.guard)}, family left ${fmt(r.familyLeft)}${r.familyLeftNames.length ? ' (' + r.familyLeftNames.join(',') + ')' : ''}, other files ${fmt(r.otherDelta)}${r.otherFiles.length ? ' (' + r.otherFiles.join(',') + ')' : ''}`)
  }
  console.log('AFTER shared files (before -> after, delta):')
  for (const [p, x] of Object.entries(docShared)) console.log(`  ${x.status} ${p}: ${fmt(x.before)} -> ${fmt(x.after)} (${x.delta.total >= 0 ? '+' : ''}${x.delta.total}/${x.delta.ncnb})`)
  const other = Object.entries(out.otherShared)
  if (other.length) console.log('  outside cmp/ and helpers/ (not counted to the documentation):', other.map(([p, x]) => `${p} ${x.delta.total >= 0 ? '+' : ''}${x.delta.total}`).join(', '))
  console.log(`MEASURED (${portedAny.join(' ')}): before ${fmt(measured.before)} -> after ${fmt(measured.after)}: ${measured.ratio}x (${measured.ratioNcnb}x without blanks and comments)`)
  for (const [k, x] of Object.entries(projection)) console.log(`PROJECTION, all 20, ${k}: ${fmt(x.before)} -> ${fmt(x.after)}: ${x.ratio}x (${x.ratioNcnb}x)`)
}
main()
