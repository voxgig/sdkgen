const Fs = require('node:fs')
const Path = require('node:path')
const { memfs } = require('memfs')
const { SdkGen } = require('/home/user/sdkgen/ts/dist/sdkgen.js')
const { makeModel, makeRoot, layeredFs, makeLog } =
  require('/home/user/sdkgen/ts/dist-test/generateharness.js')

const PKG = '/home/user/sdkgen/ts'
const STAGE = Path.join(PKG, 'dist-test-scaffold')
const SCAFFOLD = Path.join(PKG, 'project', '.sdk')

const TARGET = process.argv[2]
const OUT = process.argv[3]

;(async () => {
  const { fs, vol } = memfs({})
  const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
  const cwd = process.cwd()
  process.chdir(SCAFFOLD)
  const res = await sdkgen.generate({
    model: makeModel([TARGET], undefined, undefined, undefined), root: makeRoot() })
  process.chdir(cwd)
  if (!res.ok) { console.error('generate failed'); process.exit(1) }
  let n = 0
  for (const [path, content] of Object.entries(vol.toJSON())) {
    const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
    if (rel.startsWith('.jostraca/') || rel.includes('/.jostraca/')) continue
    if (!rel.startsWith(TARGET + '/')) continue
    const dest = Path.join(OUT, rel)
    Fs.mkdirSync(Path.dirname(dest), { recursive: true })
    Fs.writeFileSync(dest, content)
    n++
  }
  console.log('wrote', n, TARGET, 'files')
})()
