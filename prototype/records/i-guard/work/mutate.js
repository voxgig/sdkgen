// node mutate.js <mutations.json> <out.json>: each mutation applied to the mut clone, rebuilt, guard and reader run, restored.
const Fs = require('fs'), Path = require('path'), { execSync } = require('child_process')
const TS = '/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/i-guard/mut/ts'
const env = { ...process.env, PATH: '/opt/node24/bin:' + process.env.PATH }
const muts = JSON.parse(Fs.readFileSync(process.argv[2], 'utf8'))
const res = []
let i = 0
const t0 = Date.now()
for (const m of muts) {
  i++
  const edits = m.edits || [{ file: m.file, from: m.from, to: m.to, delete: m.delete, create: m.create, content: m.content }]
  let bad = null
  for (const e of edits) {
    const p = Path.join(TS, e.file)
    if (e.delete) { Fs.renameSync(p, p + '.gone'); continue }
    if (e.create) { Fs.writeFileSync(p, e.content); continue }
    const src = Fs.readFileSync(p, 'utf8')
    const n = src.split(e.from).length - 1
    if (1 !== n) { bad = `${e.file}: 'from' occurs ${n} times`; break }
    Fs.writeFileSync(p, src.replace(e.from, e.to))
  }
  let out = '', rc = 0
  if (null == bad) {
    try { execSync('npm run build', { cwd: TS, env, stdio: 'pipe' }) } catch (e) { bad = 'build failed: ' + String(e.stdout).slice(-400) }
  }
  if (null == bad) {
    try { out = execSync('node --test dist-test/runtimefacts.test.js dist-test/runtimereader.test.js', { cwd: TS, env, stdio: 'pipe' }).toString() }
    catch (e) { rc = e.status; out = String(e.stdout) }
  }
  const fails = (out.match(/^\s*✖ .*$/gm) || []).filter((l) => !/runtime(facts|reader) \(|failing tests/.test(l)).map((l) => l.trim().replace(/ \([\d.]+ms\)$/, '')).filter((v, j, a) => a.indexOf(v) === j)
  const checks = new Set([...out.matchAll(/check: '(\w+)'/g)].map((x) => x[1]))
  for (const f of fails) {
    if (/accounted for/.test(f)) checks.add('account')
    if (/compiled forms file/.test(f)) checks.add('stale-forms')
    if (/declares its runtime forms/.test(f)) checks.add('forms-missing')
    if (/the forms read the runtime/.test(f)) checks.add('reader')
    if (/negative controls/.test(f)) checks.add('controls')
  }
  const whats = [...out.matchAll(/^\s*\+\s+'([^']*)'/gm), ...out.matchAll(/what: '([^']*)'/g)].map((x) => x[1]).filter((v, j, a) => a.indexOf(v) === j).slice(0, 3)
  for (const e of edits) {
    if (e.delete) Fs.renameSync(Path.join(TS, e.file) + '.gone', Path.join(TS, e.file))
    if (e.create) Fs.unlinkSync(Path.join(TS, e.file))
  }
  execSync('git checkout -- .', { cwd: TS })
  const r = { id: m.id, lang: m.lang, caught: null == bad ? 0 !== rc : null, error: bad, checks: [...checks], fails, whats }
  res.push(r)
  console.log(`[${i}/${muts.length} ${Math.round(100 * i / muts.length)}% ${Math.round((Date.now() - t0) / 1000)}s] ${m.id}: ${null != bad ? 'ERROR ' + bad.slice(0, 160) : r.caught ? 'CAUGHT ' + r.checks.join(',') : 'NOT CAUGHT'}`)
}
execSync('npm run build', { cwd: TS, env, stdio: 'pipe' })
Fs.writeFileSync(process.argv[3], JSON.stringify(res, null, 1))
