// node before/gensdk.js <sdkgen-ts> <sdkroot> <target> [default|crud|basic-server]
// Generates one SDK the way generatedcompile.test.ts generateTo does (the
// standard model, the target alone, top-level files beside it), with the
// test harness of the given sdkgen build. Writes the SDK to <sdkroot> and the
// root README.md to its parent.
const Path = require('node:path')
const Fs = require('node:fs')
const [ts, sdkroot, target, which = 'default'] = process.argv.slice(2)
const H = require(Path.join(ts, 'dist-test', 'generateharness.js'))
const { memfs } = require(Path.join(ts, 'node_modules', 'memfs'))
const { SdkGen } = require(Path.join(ts, 'dist', 'sdkgen.js'))

const BASIC_SERVER = H.CRUD_MODEL + `
main: kit: config: auth: { active: true, prefix: 'Basic', basic: true }
main: kit: info: servers: [ { url: 'https://{tenant}.example.com/{region}', variables: { tenant: { default: '' }, region: { default: 'eu' } } } ]
`
const EXTRA = { default: undefined, crud: H.CRUD_MODEL, 'basic-server': BASIC_SERVER }[which]

function materialise(files, root) {
  for (const [rel, content] of Object.entries(files)) {
    const p = Path.join(root, rel)
    Fs.mkdirSync(Path.dirname(p), { recursive: true })
    Fs.writeFileSync(p, content)
  }
}

;(async () => {
  const { fs, vol } = memfs({})
  const sdkgen = SdkGen({ fs: H.layeredFs(fs), folder: H.STAGE, root: '', pino: H.makeLog() })
  const cwd = process.cwd()
  process.chdir(H.SCAFFOLD)
  const res = await sdkgen.generate({ model: H.makeModel([target], undefined, EXTRA, undefined), root: H.makeRoot() })
  process.chdir(cwd)
  if (true !== res.ok) throw new Error('generation did not report ok')
  const out = {}, top = {}
  for (const [p, content] of Object.entries(vol.toJSON())) {
    const rel = Path.relative(H.STAGE, p).split(Path.sep).join('/')
    if (rel.startsWith('.jostraca/') || rel.includes('/.jostraca/')) continue
    if (!rel.includes('/')) top[rel] = content
    if (!rel.startsWith(target + '/')) continue
    out[rel.slice(target.length + 1)] = content
  }
  materialise(top, Path.dirname(Path.resolve(sdkroot)))
  materialise(out, sdkroot)
  console.log(`generated ${target} (${which}): ${Object.keys(out).length} files in ${sdkroot}`)
})().catch((e) => { console.error(e.stack || e); process.exit(1) })
