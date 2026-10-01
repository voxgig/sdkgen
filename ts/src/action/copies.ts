import Path from 'node:path'

import { createHash } from 'node:crypto'

import type { ActionContext } from '../types'

import {
  definitionFileName, definitionFolder, indexName,
} from '../helpers/definition'

import { KINDS } from './kind'

import type { Source } from './resolve'


// What every add wrote into `.sdk`, by fingerprint, and the version of the
// package each item came from: the only record that tells a copy the project
// changed from one its source has since moved past. Append-only, one line per
// add or remove that changed the record, holding just the change.
const COPY_LOG = 'log/copies.jsonl'

// Where 4.34.0 kept the whole record, until the next write moves it.
const LEGACY = 'sdkgen-copies.json'

const IGNORED_LOG = '.sdk/.gitignore ignores log/, so .sdk/' + COPY_LOG +
  ' is not committed and a fresh clone has no copy record. Delete the ' +
  'log/ line.'


type CopyItem = {
  package?: string
  version?: string
}

type CopyRecord = {
  items: Record<string, CopyItem>
  files: Record<string, string>
}

// A null forgets the item or the file.
type CopyEntry = {
  items?: Record<string, CopyItem | null>
  files?: Record<string, string | null>
}


function logPath(folder: string): string {
  return Path.join(folder, ...COPY_LOG.split('/'))
}


function itemKey(kind: string, name: string): string {
  return kind + '/' + name
}


// CRLF and LF copies of one file share a fingerprint, as doctor compares
// them. latin1 maps each byte to one character, so nothing else changes.
function fingerprint(content: any): string {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(String(content))
  const lf = Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1')
  return createHash('sha256').update(lf).digest('hex').slice(0, 16)
}


// Unreadable lines are skipped. A copy can then only lose its entry, which
// leaves it unrecorded, as in a project from before the record existed.
function readCopies(fs: any, folder: string): CopyRecord {
  const record: CopyRecord = { items: {}, files: {} }
  const log = logPath(folder)

  const entries = fs.existsSync(log) ?
    String(fs.readFileSync(log, 'utf8')).split('\n').map(parseEntry) :
    [readLegacy(fs, folder)]

  for (const entry of entries) {
    if (null != entry) {
      apply(record, entry)
    }
  }

  return record
}


function parseEntry(line: string): CopyEntry | undefined {
  if ('' === line.trim()) {
    return undefined
  }

  try {
    return JSON.parse(line) ?? undefined
  }
  catch (err: any) {
    return undefined
  }
}


function readLegacy(fs: any, folder: string): CopyEntry | undefined {
  const path = Path.join(folder, LEGACY)

  if (!fs.existsSync(path)) {
    return undefined
  }

  try {
    const read = JSON.parse(String(fs.readFileSync(path, 'utf8')))
    return { items: read?.items ?? {}, files: read?.files ?? {} }
  }
  catch (err: any) {
    return undefined
  }
}


function apply(record: CopyRecord, entry: CopyEntry) {
  for (const [key, item] of Object.entries(entry.items ?? {})) {
    if (null == item) {
      delete record.items[key]
    }
    else {
      record.items[key] = item
    }
  }

  for (const [rel, print] of Object.entries(entry.files ?? {})) {
    if (null == print) {
      delete record.files[rel]
    }
    else {
      record.files[rel] = print
    }
  }
}


// The only writer. An entry that changes nothing is not written, so an add
// that rewrites identical copies leaves the log, and git, as they were.
function appendEntry(actx: ActionContext, op: string, entry: CopyEntry) {
  const fs = actx.fs()
  const folder = actx.folder
  const log = logPath(folder)
  const legacy = Path.join(folder, LEGACY)
  const fresh = !fs.existsSync(log)
  const lines: string[] = []

  if (fresh) {
    const imported = readLegacy(fs, folder)
    if (null != imported && changes(imported)) {
      lines.push(entryLine('import', imported))
    }
  }

  if (changes(entry)) {
    lines.push(entryLine(op, entry))
  }

  if (0 < lines.length) {
    fs.mkdirSync(Path.dirname(log), { recursive: true })
    fs.appendFileSync(log, lines.join('\n') + '\n')

    if (fresh && ignoredLog(fs, folder)) {
      actx.log.warn({ point: 'copies-ignored', note: IGNORED_LOG })
    }
  }

  if (fs.existsSync(legacy)) {
    fs.unlinkSync(legacy)
  }
}


// The line every create-sdkgen scaffold wrote before the record moved into
// log/. Only git knows every rule, so this finds that one, not all of them.
function ignoredLog(fs: any, folder: string): boolean {
  const path = Path.join(folder, '.gitignore')

  return fs.existsSync(path) && String(fs.readFileSync(path, 'utf8'))
    .split('\n').some((line: string) => /^\/?log(\/\*?)?$/.test(line.trim()))
}


function changes(entry: CopyEntry): boolean {
  return 0 < Object.keys(entry.items ?? {}).length ||
    0 < Object.keys(entry.files ?? {}).length
}


function entryLine(op: string, entry: CopyEntry): string {
  const sorted = (obj: Record<string, any> = {}) => Object.fromEntries(
    Object.keys(obj).sort().map((key: string) => [key, obj[key]]))

  return JSON.stringify({
    at: new Date().toISOString(),
    op,
    items: sorted(entry.items),
    files: sorted(entry.files),
  })
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

  const items: Record<string, CopyItem> = {}
  const files: Record<string, string | null> = gone(fs, folder, record)

  for (const source of sources) {
    const key = itemKey(kind, source.name)
    const item = provenanceOf(source)
    const known = record.items[key]

    if (null == known ||
      known.package !== item.package || known.version !== item.version) {
      items[key] = item
    }
  }

  const written: string[] = [
    ...(jres.files.written ?? []), ...(jres.files.unchanged ?? []),
  ]

  for (const abs of written) {
    const rel = relativeTo(folder, abs)

    if (null != rel && isCopy(rel) && fs.existsSync(abs)) {
      const print = fingerprint(fs.readFileSync(abs))
      if (print !== record.files[rel]) {
        files[rel] = print
      }
    }
  }

  appendEntry(actx, 'add', { items, files })
}


// After a remove: the item goes, with every file entry nothing holds now.
function forgetCopies(actx: ActionContext, kind: string, name: string) {
  if (true === actx.opts?.dryrun) {
    return
  }

  const fs = actx.fs()
  const folder = actx.folder
  const record = readCopies(fs, folder)
  const key = itemKey(kind, name)

  appendEntry(actx, 'remove', {
    items: null == record.items[key] ? {} : { [key]: null },
    files: gone(fs, folder, record),
  })
}


function gone(
  fs: any, folder: string, record: CopyRecord,
): Record<string, null> {
  const missing: Record<string, null> = {}

  for (const rel of Object.keys(record.files)) {
    if (!fs.existsSync(Path.join(folder, ...rel.split('/')))) {
      missing[rel] = null
    }
  }

  return missing
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
  COPY_LOG,
  IGNORED_LOG,
  ignoredLog,
  itemKey,
  fingerprint,
  readCopies,
  recordCopies,
  forgetCopies,
  untouched,
  isCopy,
}
