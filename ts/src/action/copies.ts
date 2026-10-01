import Path from 'node:path'

import { createHash } from 'node:crypto'

import type { ActionContext } from '../types'

import {
  definitionFileName, definitionFolder, indexName,
} from '../helpers/definition'

import { KINDS } from './kind'

import type { Source } from './resolve'


// What every add last wrote into `.sdk`, by fingerprint, and the version of
// the package each item came from. It is the only record that tells a copy
// the project changed from one its source has since moved past.
const COPIES = 'sdkgen-copies.json'

const ABOUT = 'Written by voxgig-sdkgen on every add: what it copied into ' +
  '.sdk, so that doctor, generate and package update can tell an outdated ' +
  'copy from a local edit. Commit it; do not edit it.'


type CopyItem = {
  package?: string
  version?: string
}

type CopyRecord = {
  items: Record<string, CopyItem>
  files: Record<string, string>
}


function copiesPath(folder: string): string {
  return Path.join(folder, COPIES)
}


function itemKey(kind: string, name: string): string {
  return kind + '/' + name
}


function fingerprint(content: any): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}


// An unreadable record is treated as absent: every copy is then unrecorded,
// which is exactly the state of a project from before the record existed.
function readCopies(fs: any, folder: string): CopyRecord {
  const empty: CopyRecord = { items: {}, files: {} }
  const path = copiesPath(folder)

  if (!fs.existsSync(path)) {
    return empty
  }

  try {
    const read = JSON.parse(String(fs.readFileSync(path, 'utf8')))
    return {
      items: { ...(read?.items ?? {}) },
      files: { ...(read?.files ?? {}) },
    }
  }
  catch (err: any) {
    return empty
  }
}


function writeCopies(fs: any, folder: string, record: CopyRecord) {
  const sorted = (obj: Record<string, any>) => Object.fromEntries(
    Object.keys(obj).sort().map((key: string) => [key, obj[key]]))

  fs.writeFileSync(copiesPath(folder), JSON.stringify({
    about: ABOUT,
    items: sorted(record.items),
    files: sorted(record.files),
  }, null, 2) + '\n')
}


function provenanceOf(source: Source): CopyItem {
  return {
    ...(null == source.package ? {} : { package: source.package }),
    ...(null == source.version ? {} : { version: source.version }),
  }
}


// The trees and definition files an add owns. An index is excluded: every
// add rewrites it and no source holds a copy to compare it with.
const TREE_ROOTS = Array.from(new Set(Object.values(KINDS)
  .flatMap((kind: any) => (kind.trees ?? [])
    .map((tree: any) => String(tree.path).split('{name}')[0]))))

function isCopy(rel: string): boolean {
  if (TREE_ROOTS.some((root: string) => rel.startsWith(root))) {
    return true
  }

  const dir = Path.posix.dirname(rel)
  const base = Path.posix.basename(rel)

  return Object.keys(KINDS).some((kind: string) =>
    dir === definitionFolder('', kind).split(Path.sep).join('/') &&
    base !== indexName(kind) &&
    base.endsWith(definitionFileName('')))
}


function relativeTo(folder: string, abs: string): string | undefined {
  const rel = Path.relative(Path.resolve(folder), Path.resolve(abs))
    .split(Path.sep).join('/')

  return ('' === rel || rel.startsWith('../') || Path.isAbsolute(rel)) ?
    undefined : rel
}


// Called by each add with what its own jostraca run wrote. A dry run writes
// nothing, so it records nothing.
function recordCopies(
  actx: ActionContext, jres: any, kind: string, sources: Source[],
) {
  if (true === actx.opts?.dryrun || null == jres?.files) {
    return
  }

  const fs = actx.fs()
  const folder = actx.folder
  const record = readCopies(fs, folder)

  const files: string[] = [
    ...(jres.files.written ?? []), ...(jres.files.unchanged ?? []),
  ]

  for (const abs of files) {
    const rel = relativeTo(folder, abs)

    if (null != rel && isCopy(rel) && fs.existsSync(abs)) {
      record.files[rel] = fingerprint(fs.readFileSync(abs))
    }
  }

  for (const source of sources) {
    record.items[itemKey(kind, source.name)] = provenanceOf(source)
  }

  pruneMissing(fs, folder, record)
  writeCopies(fs, folder, record)
}


// After a remove: the item goes, with every file entry nothing holds now.
function forgetCopies(actx: ActionContext, kind: string, name: string) {
  const fs = actx.fs()
  const folder = actx.folder

  if (true === actx.opts?.dryrun || !fs.existsSync(copiesPath(folder))) {
    return
  }

  const record = readCopies(fs, folder)
  delete record.items[itemKey(kind, name)]
  pruneMissing(fs, folder, record)
  writeCopies(fs, folder, record)
}


function pruneMissing(fs: any, folder: string, record: CopyRecord) {
  for (const rel of Object.keys(record.files)) {
    if (!fs.existsSync(Path.join(folder, ...rel.split('/')))) {
      delete record.files[rel]
    }
  }
}


// Was this project file left exactly as an add wrote it?
function untouched(
  fs: any, folder: string, record: CopyRecord, rel: string,
): boolean | undefined {
  const recorded = record.files[rel]

  if (null == recorded) {
    return undefined
  }

  const abs = Path.join(folder, ...rel.split('/'))

  return fs.existsSync(abs) && recorded === fingerprint(fs.readFileSync(abs))
}


export type {
  CopyItem,
  CopyRecord,
}

export {
  COPIES,
  copiesPath,
  itemKey,
  fingerprint,
  readCopies,
  recordCopies,
  forgetCopies,
  untouched,
  isCopy,
}
