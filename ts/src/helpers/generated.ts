import Path from 'node:path'

import { ignoredLog } from '../action/copies'


// Every file each generate run emitted, by output root: the only record that
// tells a file the model stopped producing from one nothing generated.
const GENERATED_LOG = 'log/generated.jsonl'

// Every list a run's result can name a file in.
const EMITTED = [
  'written', 'unchanged', 'merged', 'presented', 'diffed', 'preserved', 'conflicted',
]


type GeneratedRecord = Record<string, Set<string>>

type GeneratedEntry = {
  root: string
  files: Record<string, true | null>
}

type Claims = {
  files: string[]
  once: string[]
  injected: string[]
}

type PruneContext = {
  fs: any
  log: any
  project: string
  out: string
  jres: any
  claims?: Claims
  dryrun: boolean
}


function logPath(project: string): string {
  return Path.join(project, '.sdk', ...GENERATED_LOG.split('/'))
}


// The record is read as untrusted: a line that does not parse as an entry is
// skipped rather than failing the run, and pruning checks each path again.
function readGenerated(fs: any, project: string): GeneratedRecord {
  const record: GeneratedRecord = {}
  const path = logPath(project)

  if (!fs.existsSync(path)) {
    return record
  }

  for (const line of String(fs.readFileSync(path, 'utf8')).split('\n')) {
    const entry = parseEntry(line)
    if (null == entry) {
      continue
    }

    const files = record[entry.root] ?? (record[entry.root] = new Set())
    for (const [rel, present] of Object.entries(entry.files)) {
      if (true === present) {
        files.add(rel)
      }
      else if (null === present) {
        files.delete(rel)
      }
    }
  }

  return record
}


function parseEntry(line: string): GeneratedEntry | undefined {
  if ('' === line.trim()) {
    return undefined
  }

  try {
    const entry = JSON.parse(line)
    return 'string' === typeof entry?.root &&
      null != entry.files && 'object' === typeof entry.files ? entry : undefined
  }
  catch (err: any) {
    return undefined
  }
}


// Relative to root with forward slashes, or undefined for a path outside it.
function inside(root: string, path: string): string | undefined {
  const rel = Path.relative(Path.resolve(root), Path.resolve(root, path))
    .split(Path.sep).join('/')

  return ('' === rel || '..' === rel || rel.startsWith('../') || Path.isAbsolute(rel)) ?
    undefined : rel
}


function rootKey(project: string, out: string): string {
  return Path.relative(Path.resolve(project), Path.resolve(out))
    .split(Path.sep).join('/') || '.'
}


function within(out: string, paths: string[]): Set<string> {
  const found = new Set<string>()

  for (const path of paths) {
    const rel = inside(out, path)
    if (null != rel && !rel.startsWith('.jostraca/')) {
      found.add(rel)
    }
  }

  return found
}


// What the run's component tree claims: each File node's output path, written
// or not, and each Inject's target. A file written only when absent is the
// project's once it exists, and an Inject edits a region of a file it does
// not own, so neither is ever the record's.
function claimedFiles(
  node: any, claims: Claims = { files: [], once: [], injected: [] },
): Claims {
  if ('string' === typeof node?.fullpath) {
    if ('file' === node.kind) {
      claims.files.push(node.fullpath)
      if (writtenOnce(node)) {
        claims.once.push(node.fullpath)
      }
    }
    else if ('inject' === node.kind) {
      claims.injected.push(node.fullpath)
    }
  }
  for (const child of node?.children ?? []) {
    claimedFiles(child, claims)
  }
  return claims
}


// As jostraca's FileOp reads `exclude` for an existing file.
function writtenOnce(node: any): boolean {
  const exclude = node.exclude
  return true === exclude ||
    ('string' === typeof exclude ? [exclude] : Array.isArray(exclude) ? exclude : [])
      .includes(node.path?.join('/'))
}


// The top-level directory, or '' for a file at the root.
function part(rel: string): string {
  const at = rel.indexOf('/')
  return -1 === at ? '' : rel.slice(0, at)
}


function isFile(fs: any, abs: string): boolean | undefined {
  try {
    return fs.lstatSync(abs).isFile()
  }
  catch (err: any) {
    return undefined
  }
}


// Whether a directory between `out` and the file is a symbolic link, through
// which a delete could leave the root.
function linked(fs: any, out: string, rel: string): boolean {
  let at = Path.resolve(out)

  for (const name of rel.split('/').slice(0, -1)) {
    at = Path.join(at, name)
    try {
      if (fs.lstatSync(at).isSymbolicLink()) {
        return true
      }
    }
    catch (err: any) {
      return false
    }
  }

  return false
}


function removeEmptyDirs(fs: any, out: string, abs: string) {
  const top = Path.resolve(out)
  let dir = Path.dirname(abs)

  while (dir !== top && null != inside(top, dir)) {
    try {
      if (0 < fs.readdirSync(dir).length) {
        return
      }
      fs.rmdirSync(dir)
    }
    catch (err: any) {
      return
    }
    dir = Path.dirname(dir)
  }
}


// Why a recorded file this run did not emit is not this record's to delete.
function keptBecause(
  fs: any, out: string, rel: string, folded: Set<string>,
): string | undefined {
  return folded.has(rel.toLowerCase()) ? 'a generated file has its name in another case' :
    linked(fs, out, rel) ? 'a folder above it is a symbolic link' :
    true !== isFile(fs, Path.resolve(out, rel)) ? 'it is not a plain file' :
    undefined
}


// After a run into `out`: delete each recorded file this run did not emit,
// then record what changed. The first run into a root prunes nothing, and a
// part of the output this run emitted nothing into (a target switched off)
// is left as it is.
function pruneGenerated(ctx: PruneContext): string[] {
  const { fs, log, out } = ctx
  const root = rootKey(ctx.project, out)
  const record = readGenerated(fs, ctx.project)
  const known = record[root]
  const emitted = within(out, EMITTED.flatMap((list) => ctx.jres?.files?.[list] ?? []))
  const declared = within(out, ctx.claims?.files ?? [])
  const once = within(out, ctx.claims?.once ?? [])
  const injected = within(out, ctx.claims?.injected ?? [])

  for (const rel of once) {
    emitted.delete(rel)
  }
  for (const rel of injected) {
    if (!declared.has(rel)) {
      emitted.delete(rel)
    }
  }

  const parts = new Set(Array.from(emitted).map(part))
  const folded = new Set(Array.from(emitted).map((rel) => rel.toLowerCase()))
  const files: Record<string, true | null> = {}
  const pruned: string[] = []

  for (const rel of emitted) {
    if (!known?.has(rel)) {
      files[rel] = true
    }
  }

  for (const rel of known ?? []) {
    if (emitted.has(rel) || declared.has(rel) || injected.has(rel) ||
      inside(out, rel) !== rel) {
      continue
    }

    if (!fs.existsSync(Path.resolve(out, rel))) {
      files[rel] = null
      continue
    }

    if (!parts.has(part(rel))) {
      continue
    }

    const why = keptBecause(fs, out, rel, folded)
    if (null == why) {
      pruned.push(rel)
    }
    else {
      log.warn({ point: 'generate-prune-kept', file: rel,
        note: 'kept ' + rel + ', no longer generated: ' + why })
    }
    files[rel] = null
  }

  pruned.sort()

  for (const rel of pruned) {
    log.info({ point: 'generate-prune', file: rel,
      note: (ctx.dryrun ? 'would remove ' : 'removed ') + rel + ', no longer generated' })

    if (!ctx.dryrun) {
      const abs = Path.resolve(out, rel)
      fs.unlinkSync(abs)
      removeEmptyDirs(fs, out, abs)
    }
  }

  if (!ctx.dryrun && 0 < Object.keys(files).length) {
    appendEntry(ctx, root, files, null == known)
  }

  return pruned
}


function appendEntry(
  ctx: PruneContext, root: string, files: Record<string, true | null>, fresh: boolean,
) {
  const { fs } = ctx
  const path = logPath(ctx.project)
  const sorted = Object.fromEntries(Object.keys(files).sort().map((rel) => [rel, files[rel]]))

  const firstlog = !fs.existsSync(path)
  fs.mkdirSync(Path.dirname(path), { recursive: true })
  fs.appendFileSync(path, JSON.stringify({
    at: new Date(ctx.jres?.when ?? Date.now()).toISOString(),
    op: fresh ? 'record' : 'generate',
    root,
    files: sorted,
  }) + '\n')

  if (firstlog && ignoredLog(fs, Path.join(ctx.project, '.sdk'))) {
    ctx.log.warn({ point: 'generate-log-ignored', note: '.sdk/.gitignore ignores ' +
      'log/, so .sdk/' + GENERATED_LOG + ' is not committed and a fresh clone ' +
      'cannot prune what an earlier run generated. Delete the log/ line.' })
  }
}


export type {
  Claims,
  GeneratedRecord,
}

export {
  GENERATED_LOG,
  readGenerated,
  claimedFiles,
  pruneGenerated,
}
