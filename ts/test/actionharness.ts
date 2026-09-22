
import Fs from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'
import { Jostraca } from 'jostraca'

import { target_add } from '../dist/action/target.js'
import { feature_add } from '../dist/action/feature.js'


const SCAFFOLD = Path.resolve(__dirname, '..', 'project', '.sdk')
const PROJECT = Path.resolve(__dirname, '..', 'project')
const PACKAGE_ROOT = Path.resolve(__dirname, '..')

const KIT = 'kit'

const ROOT = '/out'


const noop = () => { }

function makeLog(): any {
  const log: any = {
    info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
  }
  log.child = () => log
  return log
}


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
  files: () => string[]
}


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
    '@"./target/target-index.aontu"\n' +
    '@"./feature/feature-index.aontu"\n')

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


function targetRef(target: string): string {
  return CONSUMER_BASE + '/project/' + target
}


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
