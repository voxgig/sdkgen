/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */


import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { Jostraca } from 'jostraca'

import { SdkGen } from './sdkgen'

import { package_add } from './action/package'
import { ACTION_MAP } from './action/dispatch'

import { KIT } from './types'


// This package's own root — `<...>/node_modules/@voxgig/sdkgen` for a
// consumer, or the checkout when sdkgen tests itself. Computed from this
// module's location rather than by `require.resolve`, which would go through
// the `exports` map and answer with `dist/sdkgen.js` instead of the root.
const SDKGEN_ROOT = Path.resolve(__dirname, '..')


const PLACEHOLDERS = [
  'ProjectName', 'PROJECTNAME', 'PROJECTENV', 'PROJECTVERSION', 'GOMODULE',
]


const PLACEHOLDER_REF = /\$\$[A-Za-z_][A-Za-z0-9_.]*\$\$/


type StageOptions = {
  dir?: string

  name?: string

  extra?: string

  // Record log lines instead of discarding them, for assertions about what an
  // action reported. The array is exposed as `consumer.log.lines`.
  recordLog?: boolean
}


type Consumer = {
  // The project root — the directory that HOLDS `.sdk`. Generation is rooted
  // here; an action's folder is `.sdk` itself. Conflating the two is the
  // mistake this pair of fields exists to prevent.
  root: string
  sdk: string

  actx: any
  log: any

  addPackage: (ref: string, flags?: any) => Promise<any>

  add: (kind: string, ref: string, flags?: any) => Promise<any>

  // A bundled target/feature ref, for a consumer that wants one alongside the
  // package's own content — `wfeat`'s overlay for `ts` needs `ts` present.
  bundledRef: (kind: string, name: string) => string

  setModel: (model: any) => void

  // Run `fn` with the working directory set to `.sdk`, which is where a
  // consumer runs generation from. Exposed because a caller doing its own
  // generate() needs the same contract. A promise-returning `fn` is awaited
  // before the directory is restored.
  inSdk: (<T>(fn: () => Promise<T>) => Promise<T>) & (<T>(fn: () => T) => T)

  // Compile `.sdk/src/cmp/**` to `.sdk/dist/cmp/**`, which is what a
  // consumer's own `npm run build` does and what `requirePath` reads.
  compile: (opts?: { transform?: (src: string, file: string) => string }) => number

  files: () => string[]

  cleanup: () => void
}


const noop = () => { }

function makeLog(lines?: any[]): any {
  const push = (level: string) => (entry: any) => {
    if (lines) lines.push({ level, ...entry })
  }
  const log: any = {
    lines,
    info: push('info'), debug: push('debug'), warn: push('warn'),
    error: push('error'), trace: push('trace'), fatal: push('fatal'),
  }
  log.child = () => log
  return log
}


function stageConsumer(opts: StageOptions = {}): Consumer {
  const root = opts.dir ?? Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-consumer-'))
  const sdk = Path.join(root, '.sdk')

  Fs.mkdirSync(Path.join(sdk, 'model', 'target'), { recursive: true })
  Fs.mkdirSync(Path.join(sdk, 'model', 'feature'), { recursive: true })

  Fs.writeFileSync(Path.join(sdk, 'model', 'target', 'target-index.aontu'),
    '# Targets\n')
  Fs.writeFileSync(Path.join(sdk, 'model', 'feature', 'feature-index.aontu'),
    '# Features\n')

  const name = opts.name ?? 'demo'

  Fs.writeFileSync(Path.join(sdk, 'model', 'sdk.aontu'),
    "name: '" + name + "'\n" +
    '@"./target/target-index.aontu"\n' +
    '@"./feature/feature-index.aontu"\n' +
    (opts.extra ? opts.extra + '\n' : ''))

  const modules = Path.join(sdk, 'node_modules')
  const links = [linkModule(modules, '@voxgig/sdkgen', SDKGEN_ROOT)]

  for (const dep of peerNames()) {
    const from = peerRoot(dep)
    if (null != from) {
      links.push(linkModule(modules, dep, from))
    }
  }

  const lines: any[] = []
  const log = makeLog(opts.recordLog ? lines : undefined)

  const actx: any = {
    fs: () => Fs,
    log,
    folder: sdk,
    model: {
      const: { name, Name: name.charAt(0).toUpperCase() + name.slice(1) },
      main: {
        [KIT]: { feature: {}, entity: {}, target: {} },
      },
    },
    url: Path.join(sdk, 'model', 'sdk.aontu'),
    jostraca: Jostraca({ existing: { txt: { write: true, merge: false } } }),
    opts: { dryrun: false },
  }

  const files = () => walk(sdk)
    .map((p: string) => Path.relative(sdk, p).split(Path.sep).join('/'))
    .filter((p: string) => !p.startsWith('.jostraca/') && !p.includes('/.jostraca/'))
    .sort()

  return {
    root, sdk, actx, log,

    addPackage: async (ref: string, flags: any = {}) => {
      actx.flags = flags
      return package_add([ref], actx)
    },

    // Through `ACTION_MAP`, which is the SAME dispatch the CLI uses — so a
    // kind registered later is installable here with no change to the kit,
    // and a kind whose action is missing fails the way the CLI fails.
    add: async (kind: string, ref: string, flags: any = {}) => {
      const action = (ACTION_MAP as any)[kind]
      if (null == action) {
        throw new Error('testkit: no such kind: ' + kind +
          ' (known: ' + Object.keys(ACTION_MAP).sort().join(', ') + ')')
      }
      actx.flags = flags
      return action([kind, 'add', ref], actx)
    },

    bundledRef: (kind: string, name: string) =>
      'target' === kind ? 'node_modules/@voxgig/sdkgen/project/' + name : name,

    setModel: (model: any) => { actx.model = model },

    inSdk: (fn: any): any => {
      const prev = process.cwd()
      process.chdir(sdk)

      let out: any
      try {
        out = fn()
      }
      catch (err) {
        process.chdir(prev)
        throw err
      }

      if (null != out && 'function' === typeof out.then) {
        return out.then(
          (v: any) => { process.chdir(prev); return v },
          (err: any) => { process.chdir(prev); throw err })
      }

      process.chdir(prev)
      return out
    },

    compile: (copts = {}) => compileComponents(sdk, copts.transform),

    files,

    cleanup: () => {
      if (null == opts.dir) {
        // The links go FIRST, explicitly. `rmSync` would remove them without
        // following (measured), so this is belt and braces for the walk — but
        // it is NOT redundant on Windows, where a junction refuses `unlink`
        // and `force: true` forgives only ENOENT, so leaving it to the walk
        // can throw.
        for (const link of links) {
          unlink(link)
        }
        Fs.rmSync(root, { recursive: true, force: true })
      }
    },
  }
}


function unlink(link: string): void {
  let stat: any
  try {
    stat = Fs.lstatSync(link)
  }
  catch (err) {
    return
  }

  if (stat.isSymbolicLink()) {
    try { Fs.unlinkSync(link); return } catch (err) {   }
    try { Fs.rmdirSync(link) } catch (err) {   }
    return
  }

  try {
    Fs.rmSync(link, { recursive: true, force: true })
  }
  catch (err) {   }
}


function volumeKey(p: string): string {
  return p.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
}


// The peer packages a consumer necessarily has installed alongside sdkgen.
// Read from the manifest rather than listed here, so a peer added later is
// linked without anyone remembering to.
function peerNames(): string[] {
  try {
    const pkg = JSON.parse(
      Fs.readFileSync(Path.join(SDKGEN_ROOT, 'package.json'), 'utf8'))
    return Object.keys(pkg.peerDependencies ?? {})
  }
  catch (err) {
    return []
  }
}


function peerRoot(dep: string): string | undefined {
  try {
    return Path.dirname(
      require.resolve(dep + '/package.json', { paths: [SDKGEN_ROOT] }))
  }
  catch (err) {
    // Some packages restrict `exports` and refuse the package.json subpath.
    // Fall back to the entry point and climb to the directory that holds one.
    try {
      let dir = Path.dirname(require.resolve(dep, { paths: [SDKGEN_ROOT] }))
      for (let up = 0; up < 8; up++) {
        if (Fs.existsSync(Path.join(dir, 'package.json'))) return dir
        const parent = Path.dirname(dir)
        if (parent === dir) break
        dir = parent
      }
    }
    catch (err2) {   }

    return undefined
  }
}


function linkModule(modules: string, name: string, from: string): string {
  const link = Path.join(modules, ...name.split('/'))
  Fs.mkdirSync(Path.dirname(link), { recursive: true })

  if (Fs.existsSync(link)) return link

  try {
    Fs.symlinkSync(from, link, 'junction')
  }
  catch (err: any) {
    Fs.mkdirSync(link, { recursive: true })
    Fs.writeFileSync(Path.join(link, 'package.json'),
      JSON.stringify({ name, version: '0.0.0', main: 'index.js' }) + '\n')
    Fs.writeFileSync(Path.join(link, 'index.js'),
      'module.exports = require(' + JSON.stringify(from) + ')\n')
  }

  return link
}


function walk(dir: string): string[] {
  if (!Fs.existsSync(dir)) return []
  const out: string[] = []
  for (const entry of Fs.readdirSync(dir, { withFileTypes: true })) {
    const full = Path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}


function compileComponents(
  sdk: string,
  transform?: (src: string, file: string) => string,
): number {
  const srcdir = Path.join(sdk, 'src', 'cmp')
  const outdir = Path.join(sdk, 'dist', 'cmp')

  if (!Fs.existsSync(srcdir)) return 0

  const xform = transform ?? defaultTransform()

  let count = 0
  for (const file of walk(srcdir)) {
    const rel = Path.relative(srcdir, file)

    // Fragments are template source carrying placeholder tokens, not valid
    // standalone modules — the same exclusion `tsconfig.scaffold.json` makes.
    if (rel.split(Path.sep).includes('fragment')) continue

    const out = Path.join(outdir, rel.replace(/\.ts$/, '.js'))
    Fs.mkdirSync(Path.dirname(out), { recursive: true })

    if (!file.endsWith('.ts')) {
      Fs.copyFileSync(file, Path.join(outdir, rel))
      continue
    }

    Fs.writeFileSync(out, xform(Fs.readFileSync(file, 'utf8'), file))
    count++
  }

  return count
}


function defaultTransform(): (src: string, file: string) => string {
  const tried: string[] = []

  try {
    tried.push('sucrase')
    const sucrase = require('sucrase')
    return (src: string, file: string) => sucrase.transform(src, {
      transforms: ['typescript', 'imports'],
      filePath: file,
    }).code
  }
  catch (err) {   }

  try {
    tried.push('typescript')
    const ts = require('typescript')
    return (src: string, file: string) => ts.transpileModule(src, {
      fileName: file,
      compilerOptions: {
        target: ts.ScriptTarget.ES2021,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    }).outputText
  }
  catch (err) {   }

  throw new Error(
    'testkit: no TypeScript transpiler found (looked for: ' +
    tried.join(', ') + '). Add one as a devDependency, or pass ' +
    '`compile({ transform })` with your own.')
}


type GenerateOptions = {
  // The compiled model. A caller with aontu source unifies it themselves —
  // the kit does not choose a model-compilation strategy for a package.
  model: any

  root?: any

  allowPlaceholder?: (path: string, token: string) => boolean

  outside?: string[]
}


type GenerateResult = {
  files: Record<string, string>

  // Files written OUTSIDE the consumer root, one map per destination declared
  // in `outside`, keyed by the destination as the caller spelled it and then
  // by the path relative to that destination. Empty unless `outside` was
  // passed.
  outside: Record<string, Record<string, string>>

  // `<path>: <token>` for each surviving placeholder, across `files` AND
  // every `outside` destination — an external target's output is generated
  // by the same replace maps and leaks the same way.
  leaks: string[]
}


// GENERATE INTO MEMORY, from a consumer staged on disk.
//
// The split matters: the project (components, templates, model) is real,
// because that is what generation READS; the output is a memfs volume,
// because a test wants to assert on it rather than clean it up.
async function generateInto(
  consumer: Consumer, opts: GenerateOptions,
): Promise<GenerateResult> {
  let memfs: any
  try {
    memfs = require('memfs').memfs
  }
  catch (err) {
    throw new Error('testkit: generateInto needs `memfs` — add it as a devDependency')
  }

  const { fs, vol } = memfs({})

  const sdkgen = SdkGen({
    fs: layeredFs(fs),
    folder: consumer.root,
    root: '',
    pino: consumer.log,
  })

  const prevcwd = process.cwd()
  process.chdir(consumer.sdk)

  let res: any
  try {
    res = await sdkgen.generate({
      model: opts.model,
      root: opts.root ?? defaultRoot(),
    })
  }
  finally {
    process.chdir(prevcwd)
  }

  if (true !== res.ok) {
    throw new Error('testkit: generation failed: ' + JSON.stringify(res))
  }

  const rootkey = volumeKey(consumer.root)

  const declared = (opts.outside ?? [])
    .map((dest) => ({ dest, key: volumeKey(Path.resolve(consumer.root, dest)) }))
    .sort((a, b) => b.key.length - a.key.length)

  const files: Record<string, string> = {}
  const outside: Record<string, Record<string, string>> = {}
  for (const { dest } of declared) {
    outside[dest] = {}
  }

  for (const [path, content] of Object.entries(vol.toJSON() as Record<string, string>)) {
    const key = volumeKey(path)

    const under = (base: string) => key === base || key.startsWith(base + '/')
    const rel = (base: string) => key === base ? '' : key.slice(base.length + 1)

    // The generator's own bookkeeping, wherever it landed. Skipped in both
    // views for the same reason: the caller is asking what package was
    // written, not what jostraca recorded about writing it.
    const junk = (p: string) =>
      p.startsWith('.jostraca/') || p.includes('/.jostraca/')

    if (under(rootkey)) {
      const p = rel(rootkey)
      if (!junk(p)) files[p] = content
      continue
    }

    const hit = declared.find((d) => under(d.key))
    if (null != hit) {
      const p = rel(hit.key)
      if (!junk(p)) outside[hit.dest][p] = content
      continue
    }

    throw new Error(
      'testkit: generated path is not under the consumer root or any ' +
      'declared out-of-tree destination, so the result cannot be keyed.' +
      '\n  root: ' + consumer.root +
      '\n  path: ' + path +
      '\n  compared as: ' + rootkey + '  vs  ' + key +
      (0 === declared.length
        ? '\nIf this target declares `output: path`, pass that path in the ' +
          '`outside` option.'
        : '\n  declared: ' + declared.map((d) => d.key).join(', ')) +
      '\nThese must agree once separators and any drive letter are ' +
      'normalised — memfs stores volume keys, not OS paths.')
  }

  const allow = opts.allowPlaceholder ?? (() => false)
  const leaks: string[] = []

  // SCANNED IN BOTH VIEWS. An out-of-tree target's output goes through the
  // same replace maps and leaks a placeholder the same way, so a scan that
  // covered only the in-tree files would report `leaks: []` for a package
  // whose whole output is external.
  const scan = (prefix: string, map: Record<string, string>) => {
    for (const [path, content] of Object.entries(map)) {
      if ('string' !== typeof content) continue

      const label = prefix + path

      for (const token of PLACEHOLDERS) {
        if (content.includes(token) && !allow(label, token)) {
          leaks.push(label + ': ' + token)
        }
      }

      const ref = content.match(PLACEHOLDER_REF)
      if (null != ref && !allow(label, ref[0])) {
        leaks.push(label + ': ' + ref[0])
      }
    }
  }

  scan('', files)
  for (const { dest } of declared) {
    scan(dest + '/', outside[dest])
  }

  return { files, outside, leaks: leaks.sort() }
}


function layeredFs(mem: any): any {
  const readThrough = (name: string) => (path: any, ...rest: any[]) => {
    const target = mem.existsSync(path) ? mem : Fs
    return (target as any)[name](path, ...rest)
  }

  return {
    ...mem,
    existsSync: (path: any) => mem.existsSync(path) || Fs.existsSync(path),
    readFileSync: readThrough('readFileSync'),
    readdirSync: readThrough('readdirSync'),
    statSync: readThrough('statSync'),
    realpathSync: readThrough('realpathSync'),
  }
}


function defaultRoot(): any {
  const { cmp, each, names, Project, Folder } = require('jostraca')
  const { Main, Entity, Feature, Test, Readme, AgentGuide } = require('./sdkgen')

  return cmp(function Root(props: any) {
    const { model, ctx$ } = props

    model.const = model.const || { name: model.name }
    names(model.const, model.name)
    if (null == model.const.year) model.const.year = new Date().getFullYear()
    names(model, model.name)

    ctx$.model = model
    ctx$.stdrep = ctx$.stdrep || {}
    names(ctx$.stdrep, model.Name, 'Project' + 'Name')

    const target = model.main[KIT].target || {}
    const feature = model.main[KIT].feature || {}
    const entity = model.main[KIT].entity || {}

    Project({}, () => {
      each(target)
        .filter((t: any) => t && false !== t.active)
        .map((t: any) => {
          names(t, t.name)

          const phase = t.phase || {}
          const on = (n: string) => false !== (phase[n] && phase[n].active)

          Folder({ name: t.name }, () => {
            if (on('entity')) {
              each(entity)
                .filter((e: any) => e && false !== e.active)
                .map((e: any) => {
                  names(e, e.name)
                  Entity({ target: t, entity: e })
                })
            }

            if (on('feature')) {
              each(feature)
                .filter((f: any) => f && f.active)
                .map((f: any) => {
                  names(f, f.name)
                  Feature({ target: t, feature: f })
                })
            }

            Main({ target: t })

            if (on('readme')) Readme({ target: t })
            if (on('agentguide')) AgentGuide({ target: t })
            if (on('test')) Test({ target: t })
          })
        })
    })
  })
}


function manifestParity(pkgRoot: string): Record<string, string> {
  const file = Path.join(pkgRoot, 'sdkgen-package.json')
  if (!Fs.existsSync(file)) return {}
  const manifest = JSON.parse(Fs.readFileSync(file, 'utf8'))
  return manifest.parity ?? {}
}


export type {
  Consumer,
  StageOptions,
  GenerateOptions,
  GenerateResult,
}

export {
  PLACEHOLDERS,
  SDKGEN_ROOT,
  volumeKey,
  stageConsumer,
  generateInto,
  manifestParity,
}
