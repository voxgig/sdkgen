// node gen/gen.js <out-dir> <sdkgen-ts-root> [--only regex]
// Writes <out-dir>/<variation>/<target>/README.md and REFERENCE.md, and the root README.md.
const Path = require('node:path')
const Fs = require('node:fs')
const [outdir, ts] = process.argv.slice(2)
const side = Path.basename(outdir)
const oi = process.argv.indexOf('--only')
const ONLY = 0 < oi ? new RegExp(process.argv[oi + 1]) : null
process.env.SDKGEN_TS = ts
const L = require('./lib2.js')
const { variations } = require('./variations.js')
const feats = Fs.readdirSync(Path.join(L.H.SCAFFOLD, 'model', 'feature'))
  .filter((f) => f.endsWith('.aontu') && 'feature-index.aontu' !== f).map((f) => f.replace(/\.aontu$/, '')).sort()
const OUT = Path.resolve(outdir)

function stageAlias(from, to) {
  if (ts.startsWith('/home/user/')) throw new Error('alias staging writes the stage; not allowed under /home/user')
  const { aliasCmpText } = require(Path.join(ts, 'dist', 'action', 'target.js'))
  const sdk = Path.join(L.H.STAGE, '.sdk')
  const dd = Path.join(sdk, 'dist', 'cmp', to), sd = Path.join(sdk, 'src', 'cmp', to)
  Fs.mkdirSync(dd, { recursive: true })
  for (const f of Fs.readdirSync(Path.join(sdk, 'dist', 'cmp', from))) {
    if (!f.endsWith('.js')) continue
    Fs.writeFileSync(Path.join(dd, f.replace(new RegExp('_' + from + '\\.js$'), '_' + to + '.js')),
      aliasCmpText(Fs.readFileSync(Path.join(sdk, 'dist', 'cmp', from, f), 'utf8'), from, to, 'cmp/'))
  }
  const frag = Path.join(sdk, 'src', 'cmp', from, 'fragment')
  if (Fs.existsSync(frag)) Fs.cpSync(frag, Path.join(sd, 'fragment'), { recursive: true })
  const model = Fs.readFileSync(Path.join(L.H.SCAFFOLD, 'model', 'target', from + '.aontu'), 'utf8')
    .split(`target: ${from}:`).join(`target: ${to}:`)
    // As `target add go~go2` records it: the provenance names the origin.
    .replace("base: 'BASE'", `base: 'BASE'\n  origname: '${from}'`)
  return { model, cleanup: () => { Fs.rmSync(dd, { recursive: true, force: true }); Fs.rmSync(sd, { recursive: true, force: true }) } }
}

;(async () => {
  process.chdir(L.H.SCAFFOLD)
  const V = variations(L.H, feats).filter((v) => null == ONLY || ONLY.test(v.id))
  let i = 0
  for (const v of V) {
    i++
    const t0 = Date.now()
    let staged = null
    if (v.alias) {
      // Alias staging writes into the clone's staged scaffold: only in a clone under this directory.
      // a porter's workspace (mkworkspace.sh) holds tools/ and its own clone side by side
      const ws = Path.resolve(__dirname, '..', '..')
      if (!Path.resolve(ts).startsWith(ws + Path.sep) || Path.resolve(ts).startsWith('/home/user/')) { console.log(`[${i}/${V.length}] ${v.id}: SKIPPED (alias staging would write into ${ts}, which is not this workspace's own clone; make a workspace with mkworkspace.sh to generate it)`); continue }
      staged = stageAlias(v.alias.from, v.alias.to)
      v.spec.extra += '\n' + staged.model
    }
    try {
      const { out, warnings } = await L.generate(v.spec)
      const dir = Path.join(OUT, v.id)
      Fs.rmSync(dir, { recursive: true, force: true })
      for (const [rel, text] of Object.entries(out)) {
        Fs.mkdirSync(Path.join(dir, Path.dirname(rel)), { recursive: true })
        Fs.writeFileSync(Path.join(dir, rel), text)
      }
      Fs.writeFileSync(Path.join(dir, 'warnings.json'), JSON.stringify(warnings.map((w) => w.note || w.msg || w).filter((w) => /ReadmeQuick|Syntax|tutorial/.test(JSON.stringify(w))), null, 1))
      console.log(`[${i}/${V.length}] ${side} ${v.id}: ${Object.keys(out).length} READMEs in ${Date.now() - t0}ms`)
    } finally { if (staged) staged.cleanup() }
  }
})().catch((e) => { console.error(String(e.stack || e).slice(0, 2000)); process.exit(1) })
