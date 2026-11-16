import Path from 'node:path'

import { createHash } from 'node:crypto'

import { KIT } from '../types'
import type { ActionContext } from '../types'

import { SdkGenError } from '../utility'

import { copyMode, gitVersions, withCopyMerge } from '../helpers/copymerge'
import type { CopyMode } from '../helpers/copymerge'

import {
  definitionFileName, definitionFolder, indexName,
} from '../helpers/definition'

import { KINDS, kindTrees } from './kind'

import { retiredPath } from '../helpers/manifest'

import { aliasCmpName, aliasCmpText } from '../helpers/cmpfile'

import type { Source } from './resolve'


// What every add wrote into `.sdk`, by fingerprint, and the version of the
// package each item came from: the only record that tells a copy the project
// changed from one its source has since moved past. Append-only, one line per
// add or remove that changed the record, holding just the change.
const COPY_LOG = 'log/copies.jsonl'

// The base of each copy the project changed, and the incoming copies of a
// merge that stopped on a conflict.
const BASE_DIR = 'log/base'
const CONFLICT_DIR = 'log/conflict'

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
  // Where a line could not be read: `log/copies.jsonl:<n>`, or the legacy file.
  damaged: string[]
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


// An unreadable line is skipped and named in `damaged`: the copies it held
// read as unrecorded, and doctor reports the line.
function readCopies(fs: any, folder: string): CopyRecord {
  const record: CopyRecord = { items: {}, files: {}, damaged: [] }
  const log = logPath(folder)

  if (fs.existsSync(log)) {
    String(fs.readFileSync(log, 'utf8')).split('\n').forEach((line, i) => {
      const entry = parseEntry(line)
      if (null === entry) {
        record.damaged.push(COPY_LOG + ':' + (i + 1))
      }
      else if (null != entry) {
        apply(record, entry)
      }
    })
  }
  else {
    const legacy = readLegacy(fs, folder)
    if (null === legacy) {
      record.damaged.push(LEGACY)
    }
    else if (null != legacy) {
      apply(record, legacy)
    }
  }

  return record
}


// Undefined for a blank line, null for one that is not an entry.
function parseEntry(line: string): CopyEntry | null | undefined {
  if ('' === line.trim()) {
    return undefined
  }

  try {
    const entry = JSON.parse(line)
    return isEntry(entry) ? entry : null
  }
  catch (err: any) {
    return null
  }
}


function isEntry(entry: any): entry is CopyEntry {
  const map = (v: any) => null == v || ('object' === typeof v && !Array.isArray(v))
  return null != entry && 'object' === typeof entry && !Array.isArray(entry) &&
    map(entry.items) && map(entry.files)
}


function readLegacy(fs: any, folder: string): CopyEntry | null | undefined {
  const path = Path.join(folder, LEGACY)

  if (!fs.existsSync(path)) {
    return undefined
  }

  try {
    const read = JSON.parse(String(fs.readFileSync(path, 'utf8')))
    return { items: read?.items ?? {}, files: read?.files ?? {} }
  }
  catch (err: any) {
    return null
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
  // A line cut short must not swallow the next one.
  else if (!String(fs.readFileSync(log, 'utf8')).endsWith('\n')) {
    lines.unshift('')
  }

  if (changes(entry)) {
    lines.push(entryLine(op, entry))
  }

  if (lines.some((line) => '' !== line)) {
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


// `main.kit.copies` in the project's model.
function projectCopyMode(actx: ActionContext): CopyMode {
  return copyMode((actx.model as any)?.main?.[KIT]?.copies)
}


// Runs an add so that a copy the project changed is merged rather than
// replaced. An add nested in another runs inside the outer guard.
async function guardCopies<T>(
  actx: ActionContext, what: string, run: (actx: ActionContext) => Promise<T>,
): Promise<T> {
  if (true === actx.copyGuarded) {
    return run(actx)
  }

  const fs = actx.fs()
  const record = readCopies(fs, actx.folder)
  const files = record.files
  const flags = actx.flags ?? {}

  if (0 < record.damaged.length) {
    actx.log.warn({
      point: 'copies-damaged', lines: record.damaged,
      note: 'cannot read ' + record.damaged.join(', ') + ': the copies it ' +
        'named read as unrecorded, so a changed one cannot be told from an ' +
        'outdated one. Restore it from git, or delete the line.',
    })
  }

  return withCopyMerge({
    fs,
    folder: actx.folder,
    log: actx.log,
    what,
    mode: projectCopyMode(actx),
    force: true === flags.force,
    keep: true === flags.keep,
    dryrun: true === actx.opts?.dryrun,
    manage: isCopy,
    recorded: (rel: string) => files[rel],
    fingerprint,
    basedir: BASE_DIR,
    conflictdir: CONFLICT_DIR,
    versions: gitVersions,
    error: (msg: string) => new SdkGenError(msg),
  }, (gfs: any) => run({ ...actx, fs: () => gfs, copyGuarded: true }))
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


// Is this project copy, of a file its source no longer ships, byte for byte
// a version a release of that source shipped? Read from the source package's
// retired list, so it holds without the copy record.
function releasedCopy(
  fs: any, folder: string, kind: string, source: Source, rel: string,
): boolean {
  const aliased = source.name !== source.origname
  const from = kindTrees(kind, source.origname)
  const at = kindTrees(kind, source.name)
    .findIndex((tree: any) => rel.startsWith(tree.path + '/'))
  const list = readRetired(fs, source.folder)

  if (at < 0 || null == list) {
    return false
  }

  const inner = rel.slice(kindTrees(kind, source.name)[at].path.length + 1)
  const prints = list[from[at].path + '/' +
    (aliased ? aliasCmpName(inner, source.name, source.origname) : inner)]
  const abs = Path.join(folder, ...rel.split('/'))

  if (!Array.isArray(prints) || !fs.existsSync(abs)) {
    return false
  }

  const bytes = fs.readFileSync(abs)
  return prints.includes(fingerprint(aliased ? Buffer.from(aliasCmpText(
    bytes.toString('latin1'), source.name, source.origname), 'latin1') : bytes))
}


function readRetired(fs: any, sdkfolder: string): Record<string, string[]> | undefined {
  const path = retiredPath(sdkfolder)

  try {
    return fs.existsSync(path) ?
      JSON.parse(String(fs.readFileSync(path, 'utf8')))?.files : undefined
  }
  catch (err: any) {
    return undefined
  }
}


// An unshipped copy is unchanged when the record says so or when it is a
// released version; otherwise the record's verdict stands.
function unchangedCopy(
  fs: any, folder: string, record: CopyRecord, kind: string, source: Source,
  rel: string,
): boolean | undefined {
  const same = untouched(fs, folder, record, rel)
  return true !== same && releasedCopy(fs, folder, kind, source, rel) ? true : same
}


export type {
  CopyItem,
  CopyRecord,
}

export {
  BASE_DIR,
  CONFLICT_DIR,
  COPY_LOG,
  IGNORED_LOG,
  ignoredLog,
  itemKey,
  fingerprint,
  readCopies,
  recordCopies,
  forgetCopies,
  guardCopies,
  projectCopyMode,
  untouched,
  unchangedCopy,
  releasedCopy,
  isCopy,
}
