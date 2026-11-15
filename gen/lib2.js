// Generation library for the quick-start prototype. Adapted from the spike's
// lib.js: the sdkgen ts root is a parameter (env SDKGEN_TS), so the same code
// generates OLD (/home/user/sdkgen/ts, read-only) and NEW (the clone).
// Only README.md is produced, through a docs-only Root.
const Path = require('node:path')
const Fs = require('node:fs')
const TS = process.env.SDKGEN_TS
if (!TS) throw new Error('set SDKGEN_TS')
const H = require(Path.join(TS, 'dist-test', 'generateharness.js'))
const S = require(Path.join(TS, 'dist', 'sdkgen.js'))
const { memfs } = require(Path.join(TS, 'node_modules', 'memfs'))
const { Aontu } = require(Path.join(TS, 'node_modules', 'aontu'))
const { each, names, Project, Folder } = require(Path.join(TS, 'node_modules', 'jostraca'))
const KIT = H.KIT

// The model-stage mirror: entry files are written here, never under TS.
// target/ and feature/ point at TS's own staged models (read only).
const MSTAGE = Path.join(__dirname, 'mstage-' + Path.basename(Path.dirname(TS)) + '-' + require('node:crypto').createHash('md5').update(TS).digest('hex').slice(0, 6))
function ensureStage() {
  const c = Path.join(MSTAGE, 'a', 'b', 'c')
  Fs.mkdirSync(c, { recursive: true })
  const link = (to, at) => { if (!Fs.existsSync(at)) Fs.symlinkSync(to, at) }
  link(Path.join(H.STAGE, '.sdk', 'model', 'target'), Path.join(c, 'target'))
  link(Path.join(H.STAGE, '.sdk', 'model', 'feature'), Path.join(c, 'feature'))
  link(Path.join(TS, 'model'), Path.join(MSTAGE, 'model'))
  link(Path.join(TS, 'node_modules'), Path.join(MSTAGE, 'node_modules'))
  return c
}

function makeModel(spec) {
  const c = ensureStage()
  const features = spec.features || ['test', 'log']
  let api = H.API_MODEL
  if (spec.api) api = spec.api(api)
  const src = [
    '@"@voxgig/apidef/model/apidef.aontu"',
    '@"../../../model/sdkgen.aontu"',
    ...spec.targets.map((t) => `@"target/${t}.aontu"`),
    ...features.map((f) => `@"feature/${f}.aontu"`),
    api,
    spec.extra || '',
  ].join('\n')
  const path = Path.join(c, 'gen-' + process.pid + '.aontu')
  Fs.writeFileSync(path, src)
  const errs = []
  const model = new Aontu().generate(src, { path, errs })
  try { Fs.unlinkSync(path) } catch (e) { }
  if (0 < errs.length) throw new Error('model did not compile: ' + errs.map((e) => `[${e.why}] ${e.msg}`).join(' | '))
  return model
}

function docsRoot() {
  return S.cmp(function Root(props) {
    const { model, ctx$ } = props
    model.const = { name: model.name }; names(model.const, model.name); model.const.year = 2026; names(model, model.name)
    ctx$.model = model; ctx$.stdrep = {}; names(ctx$.stdrep, model.Name, 'ProjectName')
    const kit = model.main[KIT]; const target = kit.target || {}; const entity = kit.entity || {}; const feature = kit.feature || {}
    each(entity, (e) => names(e, e.name)); each(feature, (f) => names(f, f.name))
    Project({}, () => {
      // The root README: ReadmeTop is the only route to ReadmeTopQuick_<lang>.
      S.ReadmeTop({})
      each(target, (target) => {
        if (false === target.active) return
        names(target, target.name)
        Folder({ name: target.name }, () => {
          const phase = target.phase || {}
          if (false !== (phase.readme && phase.readme.active)) S.Readme({ target })
        })
      })
    })
  })
}

async function generate(spec) {
  const { fs, vol } = memfs({})
  const warnings = []
  const sdkgen = S.SdkGen({ fs: H.layeredFs(fs), folder: H.STAGE, root: '', pino: H.makeLog(undefined, warnings) })
  const res = await sdkgen.generate({ model: makeModel(spec), root: docsRoot() })
  if (true !== res.ok) throw new Error('generation did not report ok')
  const out = {}
  for (const [p, c] of Object.entries(vol.toJSON())) {
    const rel = Path.relative(H.STAGE, p).split(Path.sep).join('/')
    if (rel.includes('.jostraca') || rel.startsWith('.sdk/log/')) continue
    if (/(^|\/)(README|REFERENCE)\.md$/.test(rel)) out[rel] = String(c)
  }
  return { out, warnings }
}

module.exports = { H, S, KIT, TS, makeModel, generate }
