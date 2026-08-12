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

function realpath(path: any): any {
  if ('string' !== typeof path) {
    return path
  }
  const norm = path.split(Path.sep).join('/')
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


// Targets are referenced by ABSOLUTE path (`<...>/project/<lang>`) — the form
// resolveTarget uses for an out-of-tree target scaffold — so the shipped
// project/.sdk is the source without a node_modules symlink.
function targetRef(target: string): string {
  return PROJECT + '/' + target
}


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
  PROJECT,
  ROOT,
  KIT,
  makeLog,
  recordLog,
  layeredFs,
  makeProject,
  targetRef,
  addTarget,
  target_add,
  feature_add,
}
