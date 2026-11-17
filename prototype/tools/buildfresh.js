// node buildfresh.js <clone>
//
// Is the clone's build current? Every source the tools read the output of
// must be no newer than what the build made from it:
//   ts/src/**/*.ts                         -> ts/dist/**/*.js
//   ts/test/**/*.ts                        -> ts/dist-test/**/*.js
//   ts/project/.sdk/src/cmp/**/*.ts        -> ts/dist-test-scaffold/.sdk/dist/cmp/**/*.js
//   ts/project/.sdk/src/cmp/**/fragment/*  -> ts/dist-test-scaffold/.sdk/src/cmp/**/fragment/* (staged copy)
//   ts/project/.sdk/{model,src}/**          -> ts/dist-test-scaffold/.sdk/{model,src}/** (staged copies,
//                                              compared by CONTENT: generation reads the target and
//                                              feature models from the staged copy, whatever its time)
// A failed build leaves the previous output in place, so without this the one
// command passes on the old code. Exit 1 naming each stale or missing output.
// (*.d.ts sources make nothing and are skipped.)
const Fs = require('node:fs')
const Path = require('node:path')

function walk(dir, out = []) {
  if (!Fs.existsSync(dir)) return out
  for (const e of Fs.readdirSync(dir, { withFileTypes: true })) {
    const p = Path.join(dir, e.name)
    if (e.isDirectory()) { if ('node_modules' !== e.name) walk(p, out) } else out.push(p)
  }
  return out
}

function check(clone) {
  const ts = Path.join(Path.resolve(clone), 'ts')
  const stale = [], missing = [], differ = []
  let n = 0
  const pair = (src, out) => {
    n++
    if (!Fs.existsSync(out)) { missing.push({ src, out }); return }
    const s = Fs.statSync(src).mtimeMs, o = Fs.statSync(out).mtimeMs
    if (s > o) stale.push({ src, out, by: Math.round((s - o) / 1000) })
  }
  const js = (f) => f.replace(/\.ts$/, '.js')
  for (const f of walk(Path.join(ts, 'src'))) if (/\.ts$/.test(f) && !/\.d\.ts$/.test(f)) pair(f, js(Path.join(ts, 'dist', Path.relative(Path.join(ts, 'src'), f))))
  // test/tsconfig.json excludes solardemo; a fixture package's .sdk tree is type-checked (check-fixture), never emitted
  const testSkip = (f) => { const r = Path.relative(Path.join(ts, 'test'), f).split(Path.sep); return 'solardemo' === r[0] || r.includes('.sdk') }
  for (const f of walk(Path.join(ts, 'test'))) if (/\.ts$/.test(f) && !/\.d\.ts$/.test(f) && !testSkip(f)) pair(f, js(Path.join(ts, 'dist-test', Path.relative(Path.join(ts, 'test'), f))))
  const cmp = Path.join(ts, 'project/.sdk/src/cmp')
  for (const f of walk(cmp)) {
    const rel = Path.relative(cmp, f)
    if (rel.split(Path.sep).includes('fragment')) pair(f, Path.join(ts, 'dist-test-scaffold/.sdk/src/cmp', rel))
    else if (/\.ts$/.test(f) && !/\.d\.ts$/.test(f)) pair(f, js(Path.join(ts, 'dist-test-scaffold/.sdk/dist/cmp', rel)))
  }
  const staged = Path.join(ts, 'dist-test-scaffold/.sdk')
  for (const top of ['model', 'src']) {
    const root = Path.join(ts, 'project/.sdk', top)
    for (const f of walk(root)) {
      const out = Path.join(staged, top, Path.relative(root, f))
      n++
      if (!Fs.existsSync(out)) { missing.push({ src: f, out }); continue }
      if (!Fs.readFileSync(f).equals(Fs.readFileSync(out))) differ.push({ src: f, out })
    }
  }
  return { checked: n, stale, missing, differ }
}

function main() {
  const clone = process.argv[2]
  if (!clone) { console.error('usage: node buildfresh.js <clone>'); process.exit(2) }
  const r = check(clone)
  const ts = Path.join(Path.resolve(clone), 'ts')
  const rel = (p) => Path.relative(ts, p)
  for (const x of r.stale) console.log(`STALE BUILD: ts/${rel(x.src)} is ${x.by}s newer than ts/${rel(x.out)}`)
  for (const x of r.missing) console.log(`STALE BUILD: ts/${rel(x.src)} has no build output ts/${rel(x.out)}`)
  for (const x of r.differ) console.log(`STALE BUILD: ts/${rel(x.src)} differs from its staged copy ts/${rel(x.out)}, which generation reads`)
  const bad = r.stale.length + r.missing.length + r.differ.length
  console.log(`build: ${r.checked} sources checked, ${bad ? bad + ' STALE (rebuild: cd ts && npm run build, and read its exit code)' : 'current'}`)
  process.exit(bad ? 1 : 0)
}

module.exports = { check }
if (require.main === module) main()
