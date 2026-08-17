/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */

// THE TEST KIT: `@voxgig/sdkgen/testkit`.
//
// See §14 of docs/design/sdkgen-packages.md.
//
// WHY THIS EXISTS
//
// sdkgen's own suites are CLOSED. `parity.test.ts` and `featuremodel.test.ts`
// derive their sets from `ts/project/.sdk` listings; `generate.test.ts` runs
// the per-language components out of a staged copy of that same tree. All of
// it is excellent coverage that an external package gets exactly none of —
// and an external package is where the coverage is needed most, because its
// content reaches a consumer through the same add pipeline with none of the
// same review.
//
// So the machinery is parameterised rather than reimplemented: this module is
// the staging in `build/scaffold-stage.js` and the generation harness in
// `ts/test/generateharness.ts`, with the paths taken as arguments instead of
// hardcoded to the bundled scaffold.
//
// WHAT A PACKAGE AUTHOR DOES WITH IT
//
//   const consumer = stageConsumer()
//   await consumer.addPackage(__dirname + '/..')   // the package under test
//   consumer.compile()                             // as a consumer's build does
//   const { files, leaks } = await generateInto(consumer, { model })
//
// That runs the REAL add pipeline and the REAL generation, so provenance,
// index handling, the feature fan-out and the trim catalogue are all exercised
// against the package as published rather than as described.
//
// NO RUNTIME DEPENDENCIES. This package has none and the test kit does not
// introduce any: `compile()` reaches for a transpiler at call time and says
// which ones it looked for if it finds none.

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


// The placeholder tokens template substitution is supposed to replace. One
// surviving into generated output means a replace map did not reach a file —
// the failure mode `generate.test.ts` scans the bundled targets for, made
// available to packages that ship template trees of their own.
//
// KEPT IN STEP WITH `generate.test.ts` DELIBERATELY. `PROJECTENV` and
// `PROJECTVERSION` are added by `ensureStdrep` / `templateReplacements`, not
// by the name map, and a kit that scanned only for the name tokens would let a
// package ship an unsubstituted version string and still report `leaks: []`.
const PLACEHOLDERS = [
  'ProjectName', 'PROJECTNAME', 'PROJECTENV', 'PROJECTVERSION', 'GOMODULE',
]


// A MODEL PATH between the delimiters — identifiers and dots — not any `$$`
// pair. A surviving `$$model.path$$` means a Fragment or Copy whose model
// interpolation never ran, which the token list above cannot see.
//
// Constrained on purpose, and this is the same pattern `generate.test.ts`
// settled on: in a Makefile `$$` is how you write a literal `$`, so a loose
// pattern reported py-data's `$${GITHUB_TOKEN:-$$(gh auth token)}` — a correct
// recipe — as a leak.
const PLACEHOLDER_REF = /\$\$[A-Za-z_][A-Za-z0-9_.]*\$\$/


type StageOptions = {
  // Where to build the consumer. A fresh temp directory by default.
  dir?: string

  // The project's API name, which every derived name comes from.
  name?: string

  // The project's OWN model text, appended to `model/sdk.aontu`.
  //
  // THIS WRITES A FILE. It does NOT reach the action context — see
  // `setModel` on the consumer, and use that if an add needs to SEE what is
  // declared here. The two are separate on purpose rather than by oversight:
  // nothing recompiles a model mid-process, so there is no honest way to make
  // a string written here appear in an action's `actx.model` automatically.
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

  // Install a package by ref, through the real `package add`.
  addPackage: (ref: string, flags?: any) => Promise<any>

  // Install one item of one kind, through the real `<kind> add`.
  add: (kind: string, ref: string, flags?: any) => Promise<any>

  // A bundled target/feature ref, for a consumer that wants one alongside the
  // package's own content — `wfeat`'s overlay for `ts` needs `ts` present.
  bundledRef: (kind: string, name: string) => string

  // Install a compiled model as the one the ADD ACTIONS see.
  //
  // Needed because an action reads `actx.model`, which is compiled from
  // `model/sdk.aontu` BEFORE the run — nothing recompiles mid-process. The
  // CLI does that compile per invocation; a kit staging several adds in one
  // process does not, so a feature declared in the project's model is
  // invisible to a later `target add` unless it is installed here. That
  // matters: `target add` TRIMS feature source down to what the model
  // selects, so a target added against an empty model ships none of it.
  //
  // `package add` handles its own within-run sequencing (it teaches the
  // in-memory model about each kind's items as it installs them), so this is
  // for adds the caller sequences itself.
  setModel: (model: any) => void

  // Run `fn` with the working directory set to `.sdk`, which is where a
  // consumer runs generation from. Exposed because a caller doing its own
  // generate() needs the same contract. A promise-returning `fn` is awaited
  // before the directory is restored.
  inSdk: (<T>(fn: () => Promise<T>) => Promise<T>) & (<T>(fn: () => T) => T)

  // Compile `.sdk/src/cmp/**` to `.sdk/dist/cmp/**`, which is what a
  // consumer's own `npm run build` does and what `requirePath` reads.
  compile: (opts?: { transform?: (src: string, file: string) => string }) => number

  // Paths written so far, relative to `.sdk`, sorted.
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


// A CONSUMER PROJECT ON REAL DISK, not in memfs.
//
// It has to be real: `requirePath` resolves a component with an actual Node
// `require` against `<root>/.sdk/dist/cmp/...`, and components read sibling
// fragment files off disk relative to their own `__dirname`. A memfs project
// can exercise the add pipeline (sdkgen's own action suites do) but can never
// RUN what it installed, which is the half a package author most needs.
function stageConsumer(opts: StageOptions = {}): Consumer {
  // THE ROOT IS USED VERBATIM. Do not "canonicalise" it — that was tried and
  // it broke Windows.
  //
  // This exact string is handed to `generate()` as its output folder, and it
  // is also what `generateInto` strips back off to key the result. Those two
  // uses only agree while it is ONE string, so any transformation here has to
  // be a transformation jostraca performs too — and `realpathSync` is not.
  //
  // On the Windows runner `Os.tmpdir()` carries an 8.3 short name
  // (`D:\Users\RUNNER~1\…`). Resolving it moved `root` to the long form while
  // the generated paths kept the short one, so nothing relativised and every
  // key came back absolute — for a test asserting on `wtest/src/client.wt`,
  // that reads as "the component did not run".
  //
  // The macOS case it was added for (`/var/folders` vs `/private/var/folders`)
  // was measured BEFORE the change and does not arise: jostraca realpaths a
  // copy's SOURCE, not the output folder. Hardening against a hazard that was
  // not there cost a real platform.
  const root = opts.dir ?? Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-consumer-'))
  const sdk = Path.join(root, '.sdk')

  Fs.mkdirSync(Path.join(sdk, 'model', 'target'), { recursive: true })
  Fs.mkdirSync(Path.join(sdk, 'model', 'feature'), { recursive: true })

  Fs.writeFileSync(Path.join(sdk, 'model', 'target', 'target-index.aontu'),
    '# Targets\n')
  Fs.writeFileSync(Path.join(sdk, 'model', 'feature', 'feature-index.aontu'),
    '# Features\n')

  const name = opts.name ?? 'demo'

  // The project's OWN model, written once by create-sdkgen at init. It
  // includes the indexes of the kinds that existed THEN — which is why a
  // consumer staged here can show what an existing project does when a new
  // kind arrives, rather than assuming every index is already wired.
  Fs.writeFileSync(Path.join(sdk, 'model', 'sdk.aontu'),
    "name: '" + name + "'\n" +
    '@"target/target-index.aontu"\n' +
    '@"feature/feature-index.aontu"\n' +
    (opts.extra ? opts.extra + '\n' : ''))

  // `@voxgig/sdkgen` has to be resolvable FROM THE CONSUMER, because the
  // feature fan-out reads the bundled feature models through the path a
  // consumer sees them at (`node_modules/@voxgig/sdkgen/...`, relative to the
  // project) and scaffold components `require('@voxgig/sdkgen')` by name.
  //
  // 'junction' is the portable spelling: on Windows it creates a directory
  // junction, which needs no elevation, and on POSIX the type argument is
  // ignored and an ordinary symlink results. A copy would work too and costs
  // the whole 27-target template tree per staged consumer.
  // NODE_MODULES LIVES INSIDE `.sdk`, NOT BESIDE IT.
  //
  // A generated SDK's `.sdk` is itself an npm package root — it has its own
  // package.json and its own install — so that is where a consumer's
  // `@voxgig/sdkgen` actually sits. It matters because the feature fan-out
  // composes the path from the ACTION FOLDER (`<.sdk>/node_modules/...`)
  // rather than resolving it upward; put the link one level too high and
  // every bundled feature reports `feature-source-unresolved` while
  // `require('@voxgig/sdkgen')` from a component keeps working, because
  // Node's upward search finds either. One of the two readers is forgiving
  // and the other is not.
  const modules = Path.join(sdk, 'node_modules')
  const links = [linkModule(modules, '@voxgig/sdkgen', SDKGEN_ROOT)]

  // ...and sdkgen's PEERS, because the base model schema a consumer compiles
  // against pulls in `@voxgig/apidef/model/apidef.aontu` by package name. A
  // consumer that really installed sdkgen has these; a staged one has to be
  // given them, or every model compile here fails on an include that resolves
  // fine everywhere else.
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
      // `[kind, cmd, ...refs]` — the CLI's own argv shape, which is what
      // `action_<kind>` parses (it reads the verb at args[1]).
      return action([kind, 'add', ref], actx)
    },

    // CONSUMER-RELATIVE, not absolute, and that is not a stylistic choice.
    //
    // `target add` records `base` as the resolved source folder, so an
    // absolute ref writes THIS MACHINE'S path into the installed model. Two
    // things then go wrong at once: the copy is not reproducible across
    // machines, and the feature fan-out compares the target's own tm folder
    // against the one it reaches through `node_modules` — textually different
    // paths for the same tree, which it reports as a shadowing overlay. Both
    // disappear when the ref is spelled the way a consumer spells it.
    bundledRef: (kind: string, name: string) =>
      'target' === kind ? 'node_modules/@voxgig/sdkgen/project/' + name : name,

    setModel: (model: any) => { actx.model = model },

    // AWAITS A PROMISE-RETURNING CALLBACK before restoring the directory.
    //
    // A synchronous `finally` would put the cwd back the moment `fn` RETURNS,
    // which for an async callback is its first `await` — so the generation it
    // was wrapping would do most of its work, including every CWD-relative
    // template copy and the later docs and out-of-tree passes, from the
    // caller's directory. The wrapper would look correct and protect almost
    // nothing.
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


// REMOVE A LINK, WHICHEVER KIND IT TURNED OUT TO BE.
//
// `linkModule` makes a symlink on POSIX and a directory JUNCTION on Windows,
// and falls back to a real directory holding a re-export shim. `unlinkSync`
// removes the first, fails with EPERM on the second, and cannot remove the
// third.
//
// WHAT THIS IS AND IS NOT FOR. Node's recursive `rmSync` does NOT follow a
// symlink or a junction — it removes the link itself — so the tree walk that
// follows is not going to reach through into the sdkgen checkout. That was
// measured, not assumed. What this function buys is narrower and still worth
// having: cleanup that does not throw on Windows (a junction refuses
// `unlink`, and `force: true` forgives only ENOENT), and not depending on
// that `rmSync` behaviour holding forever for an operation whose blast radius
// would be a developer's checkout.
function unlink(link: string): void {
  let stat: any
  try {
    stat = Fs.lstatSync(link)
  }
  catch (err) {
    return
  }

  // A LINK OF SOME KIND — never recurse. `lstat` reports a Windows junction as
  // a symbolic link, which is exactly the case a recursive remove must not
  // reach: it would delete the sdkgen checkout on the other side.
  //
  // `unlink` removes a POSIX symlink and refuses a junction (EPERM); `rmdir`
  // removes a junction and refuses a symlink. Try both rather than branch on
  // the platform.
  if (stat.isSymbolicLink()) {
    try { Fs.unlinkSync(link); return } catch (err) { /* junction */ }
    try { Fs.rmdirSync(link) } catch (err) { /* already gone */ }
    return
  }

  // Not a link: the re-export shim `linkModule` writes when symlinking is
  // refused. A real directory we created, so removing its contents is safe.
  try {
    Fs.rmSync(link, { recursive: true, force: true })
  }
  catch (err) { /* already gone */ }
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


// WHERE A PEER ACTUALLY LIVES — asked of Node, not guessed from a path.
//
// The tempting version is `<SDKGEN_ROOT>/node_modules/<dep>`, and it is right
// only in this checkout. npm HOISTS: in a real installation sdkgen's peers are
// siblings of `@voxgig/sdkgen` under the host project's `node_modules`, not
// children of it. So the guessed path exists here, misses everywhere else, and
// the failure is silent — the peer is skipped, the staged consumer has no
// `@voxgig/apidef`, and the model compile fails on an include that resolves
// fine in every other context.
//
// `require.resolve` with `paths` walks the real chain, hoisted or not. The
// package.json is resolved rather than the entry point because a peer may not
// export one, and its directory is what has to be linked.
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
    catch (err2) { /* genuinely not installed */ }

    return undefined
  }
}


// One `node_modules/<name>` entry pointing at an existing package directory.
//
// 'junction' is the portable spelling: on Windows it creates a directory
// junction, which needs no elevation, and on POSIX the type argument is
// ignored and an ordinary symlink results. A copy would work too and costs the
// whole 27-target template tree per staged consumer.
function linkModule(modules: string, name: string, from: string): string {
  const link = Path.join(modules, ...name.split('/'))
  Fs.mkdirSync(Path.dirname(link), { recursive: true })

  if (Fs.existsSync(link)) return link

  try {
    Fs.symlinkSync(from, link, 'junction')
  }
  catch (err: any) {
    // Last resort: a re-export shim. It satisfies `require('<name>')` but NOT
    // deep file reads under the package, so a model include would still fail
    // — which is why this is the fallback and not the mechanism.
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


// TRANSPILE, DO NOT TYPE-CHECK.
//
// Type-checking a package's components is a BUILD-time gate (the package runs
// `tsc --noEmit` over its own `src/cmp/**`, the way this repo's
// `check-scaffold` does). Doing it again per staged consumer would add seconds
// to every test for an answer the build already has. What the kit needs here
// is only executable JS at the path `requirePath` reads.
//
// Neither transpiler is a dependency of this package, which has none. They are
// looked up at call time, and if neither is present the error names both
// rather than failing later as a missing module inside `requirePath`.
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
      // Components read sibling non-TS files (fragments, docs) relative to
      // their own __dirname, so those have to arrive in dist too.
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
  catch (err) { /* fall through to typescript */ }

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
  catch (err) { /* fall through to the error */ }

  throw new Error(
    'testkit: no TypeScript transpiler found (looked for: ' +
    tried.join(', ') + '). Add one as a devDependency, or pass ' +
    '`compile({ transform })` with your own.')
}


type GenerateOptions = {
  // The compiled model. A caller with aontu source unifies it themselves —
  // the kit does not choose a model-compilation strategy for a package.
  model: any

  // The Root component. Defaults to one that renders every active target the
  // way a create-sdkgen consumer's Root does.
  root?: any

  // Placeholder mentions that are NOT leaks, exactly as `parity.test.ts`
  // keeps its list: a stated policy, not a mute button.
  allowPlaceholder?: (path: string, token: string) => boolean
}


type GenerateResult = {
  // Every generated path, relative to the consumer root, mapped to content.
  files: Record<string, string>

  // `<path>: <token>` for each surviving placeholder.
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
  // memfs is a devDependency of whoever is testing, not of this package.
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

  // GENERATION RUNS FROM `.sdk`.
  //
  // Components copy their template tree with a CWD-RELATIVE path
  // (`Copy({ from: 'tm/<lang>' })`), because that is how a consumer runs it —
  // `npm run generate` from the `.sdk` directory. Run it from anywhere else
  // and the first feature copy fails on a `tm/...` path that does not exist
  // relative to the caller's cwd, naming the template rather than the reason.
  //
  // The chdir is restored even when generation throws, because a test runner
  // shares one process across suites and a leaked cwd breaks whatever runs
  // next, somewhere else entirely.
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

  const files: Record<string, string> = {}
  for (const [path, content] of Object.entries(vol.toJSON() as Record<string, string>)) {
    const rel = Path.relative(consumer.root, path).split(Path.sep).join('/')

    // A KEY THAT DID NOT RELATIVISE IS A BUG HERE, NOT A RESULT.
    //
    // It means the string generation wrote under and the string being
    // stripped off have diverged, and the caller then sees a file map keyed by
    // absolute path — which reads as "my component never ran" rather than as a
    // path problem. That is exactly how a Windows short-name mismatch
    // (`D:\Users\RUNNER~1\…`) presented, so it fails loudly and names both
    // sides instead of returning a map nobody can match against.
    if (Path.isAbsolute(rel) || rel.startsWith('..')) {
      throw new Error(
        'testkit: generated path is not under the consumer root, so the ' +
        'result cannot be keyed.\n  root: ' + consumer.root +
        '\n  path: ' + path +
        '\nThese must be the SAME string modulo separators — the root is ' +
        'handed to generate() verbatim and stripped back off here.')
    }

    if (rel.startsWith('.jostraca/') || rel.includes('/.jostraca/')) continue
    files[rel] = content
  }

  const allow = opts.allowPlaceholder ?? (() => false)
  const leaks: string[] = []
  for (const [path, content] of Object.entries(files)) {
    if ('string' !== typeof content) continue

    for (const token of PLACEHOLDERS) {
      if (content.includes(token) && !allow(path, token)) {
        leaks.push(path + ': ' + token)
      }
    }

    const ref = content.match(PLACEHOLDER_REF)
    if (null != ref && !allow(path, ref[0])) {
      leaks.push(path + ': ' + ref[0])
    }
  }

  return { files, leaks: leaks.sort() }
}


// Write to memfs, read through to the real project.
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


// The Root a create-sdkgen consumer has: per target, a folder holding the
// entity, feature, main, readme, agentguide and test phases.
//
// Deliberately minimal. A package author testing their own target wants to
// know that THEIR components ran, not to re-test the scaffold's Root — and a
// kit that shipped an elaborate Root would make its own behaviour part of
// every package's test result.
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


// THE PARITY TIER A PACKAGE DECLARES, from its manifest.
//
// `ts/test/parity.test.ts` owns the tier declaration for BUNDLED targets, and
// §18.4a refused to duplicate that map into the bundled manifest for exactly
// the reason this function exists to eventually resolve: the manifest should
// become the source and the parity suite should read it, not the reverse. For
// an EXTERNAL package there is no such conflict — its manifest is the only
// place its tier can live, so reading it here is the whole mechanism.
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
  stageConsumer,
  generateInto,
  manifestParity,
}
