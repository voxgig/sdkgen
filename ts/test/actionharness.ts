// Shared harness for the ACTION suites (`target add`, `feature add`,
// `doctor`), which the unit suites cannot reach: an action reads the shipped
// scaffold off disk and writes a project tree, so testing one means running it
// for real.
//
// Writes go to memfs; reads fall through to the real scaffold. Nothing here
// can touch the working tree.

import Fs from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'
import { Jostraca } from 'jostraca'

import { target_add } from '../dist/action/target.js'
import { feature_add } from '../dist/action/feature.js'


// The shipped scaffold: what a consumer's
// node_modules/@voxgig/sdkgen/project/.sdk resolves to.
const SCAFFOLD = Path.resolve(__dirname, '..', 'project', '.sdk')
const PROJECT = Path.resolve(__dirname, '..', 'project')
const PACKAGE_ROOT = Path.resolve(__dirname, '..')

const KIT = 'kit'

// Where a project's model tree lives inside the memfs volume.
const ROOT = '/out'


const noop = () => { }

function makeLog(): any {
  const log: any = {
    info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
  }
  log.child = () => log
  return log
}


// A log that RECORDS, for assertions about what an action reported.
function recordLog(): any {
  const lines: any[] = []
  const push = (level: string) => (entry: any) => lines.push({ level, ...entry })
  const log: any = {
    lines,
    info: push('info'), debug: push('debug'), warn: push('warn'),
    error: push('error'), trace: push('trace'), fatal: push('fatal'),
  }
  log.child = () => log
  return log
}


// `feature add` reaches the shipped feature models through the path a consumer
// sees them at — `node_modules/@voxgig/sdkgen/...`, relative to the consumer's
// `.sdk`. This package IS @voxgig/sdkgen, so it has no such directory; stand
// it in rather than creating one on disk.
const CONSUMER_BASE = 'node_modules/@voxgig/sdkgen'

// The same standing-in, for the path RESOLVED against the project root:
// `/out/node_modules/@voxgig/sdkgen/...`. Targets are referenced the way a
// consumer references them (see targetRef), which sends resolveTarget down
// its relative branch, and that branch joins the ref onto `folder` — so the
// mounted absolute form has to resolve as well as the relative one.
//
// BOTH mappings are needed, and the relative one cannot be dropped:
// `feature_add` hardcodes `BASE = 'node_modules/@voxgig/sdkgen'` and reads it
// relative to the CWD, so the feature fan-out that runs after every target
// add would fail without it.
const MOUNTED_BASE = ROOT + '/' + CONSUMER_BASE

function realpath(path: any): any {
  if ('string' !== typeof path) {
    return path
  }
  const norm = path.split(Path.sep).join('/')

  if (norm.startsWith(MOUNTED_BASE + '/')) {
    return Path.join(PACKAGE_ROOT, norm.slice(MOUNTED_BASE.length + 1))
  }

  return norm.startsWith(CONSUMER_BASE + '/') ?
    Path.join(PACKAGE_ROOT, norm.slice(CONSUMER_BASE.length + 1)) : path
}


// WRITE to memfs, READ through to disk.
function layeredFs(mem: any): any {
  const readThrough = (name: string) => (path: any, ...rest: any[]) => {
    const real = realpath(path)
    const target = mem.existsSync(real) ? mem : Fs
    return (target as any)[name](real, ...rest)
  }

  return {
    ...mem,
    existsSync: (path: any) => {
      const real = realpath(path)
      return mem.existsSync(real) || Fs.existsSync(real)
    },
    readFileSync: readThrough('readFileSync'),
    readdirSync: readThrough('readdirSync'),
    statSync: readThrough('statSync'),
    realpathSync: readThrough('realpathSync'),
  }
}


type Project = {
  fs: any
  vol: any
  actx: any
  // Paths written so far, relative to the project root, sorted.
  files: () => string[]
}


// A fresh empty project: the two index files `loadContent` needs, and an
// action context wired to memfs.
function makeProject(
  opts: { feature?: Record<string, any>, target?: Record<string, any>, dryrun?: boolean, log?: any } = {},
): Project {
  const { fs, vol } = memfs({})

  fs.mkdirSync(ROOT + '/model/target', { recursive: true })
  fs.mkdirSync(ROOT + '/model/feature', { recursive: true })
  fs.writeFileSync(ROOT + '/model/target/target-index.aontu', '# Targets\n')
  fs.writeFileSync(ROOT + '/model/feature/feature-index.aontu', '# Features\n')

  // The project's OWN model, which create-sdkgen writes once at init and
  // which includes the indexes of the kinds that existed then. A fixture
  // without it cannot show what an existing project does when a NEW kind
  // arrives — which is the whole upgrade path for `docs`.
  fs.writeFileSync(ROOT + '/model/sdk.aontu',
    "name: 'demo'\n" +
    '@"target/target-index.aontu"\n' +
    '@"feature/feature-index.aontu"\n')

  const actx: any = {
    fs: () => layeredFs(fs),
    log: opts.log || makeLog(),
    folder: ROOT,
    model: {
      const: { Name: 'Demo', name: 'demo' },
      main: {
        [KIT]: {
          feature: opts.feature || {},
          entity: {},
          target: opts.target || {},
        },
      },
    },
    url: ROOT + '/model/sdk.aontu',
    jostraca: Jostraca({ existing: { txt: { write: true, merge: false } } }),
    opts: { dryrun: !!opts.dryrun },
  }

  const files = () => Object.keys(vol.toJSON())
    .map((p: string) => Path.relative(ROOT, p).split(Path.sep).join('/'))
    .filter((p: string) => !p.startsWith('.jostraca/') && !p.includes('/.jostraca/'))
    .sort()

  return { fs, vol, actx, files }
}


// Targets are referenced the way a CONSUMER references them: package-relative
// (`node_modules/@voxgig/sdkgen/project/<lang>`), resolved against the project
// root by resolveTarget's relative branch and mapped back to the shipped
// scaffold by realpath above.
//
// It used to be an ABSOLUTE path (`<...>/project/<lang>`). That works, but it
// makes the output MACHINE-DEPENDENT: resolveTarget records `base` as the
// resolved folder with the project root stripped, and an absolute source is
// not under the project root, so `base` stayed absolute and the `'BASE'`
// substitution wrote this checkout's location into the copied target model.
// Harmless while nothing compared bytes; fatal to the golden trees in
// characterize.test.ts, which have to be identical on every machine, in a
// worktree, and in CI.
//
// The absolute branch is still exercised, deliberately, by
// `absoluteTargetRef` below — see target.test.ts and characterize.test.ts.
function targetRef(target: string): string {
  return CONSUMER_BASE + '/project/' + target
}


// The out-of-tree form: an absolute path to a target scaffold. Kept so the
// branch targetRef no longer takes still has coverage.
function absoluteTargetRef(target: string): string {
  return PROJECT + '/' + target
}


// The `base` value `target add` records for a target added via targetRef —
// the scaffold folder relative to the project root. A test that stubs a
// target into the model must use THIS, not the absolute SCAFFOLD path:
// doctor re-applies the `'BASE'` substitution with whatever `base` says, and
// a value that disagrees with the file on disk reads as a fork.
const SCAFFOLD_BASE = CONSUMER_BASE + '/project/.sdk'


// Run `target add` for one target into a fresh project and return what it
// wrote (empty on a dry run — that is the point of the flag).
async function addTarget(
  target: string,
  feature: Record<string, any> = {},
  opts: { dryrun?: boolean, log?: any } = {},
): Promise<string[]> {
  const project = makeProject({ feature, ...opts })
  await target_add([targetRef(target)], project.actx)
  return project.files()
}


export type {
  Project,
}

export {
  SCAFFOLD,
  SCAFFOLD_BASE,
  PROJECT,
  ROOT,
  KIT,
  makeLog,
  recordLog,
  layeredFs,
  makeProject,
  targetRef,
  absoluteTargetRef,
  addTarget,
  target_add,
  feature_add,
}
