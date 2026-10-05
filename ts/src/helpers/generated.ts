import Path from 'node:path'

import { ignoredLog } from '../action/copies'

import { COMPONENT } from './component'


// Every file each generate run emitted, by output root: the only record that
// tells a file the model stopped producing from one nothing generated.
const GENERATED_LOG = 'log/generated.jsonl'

// Every list a run's result can name a file in.
const EMITTED = [
  'written', 'unchanged', 'merged', 'presented', 'diffed', 'preserved', 'conflicted',
]

// jostraca leaves a file holding this marker as it is.
const PROTECT = 'JOSTRACA_PROTECT'

const SHOWN = 5


// By output root: each recorded path and the scope that produced it.
type GeneratedRecord = Record<string, Map<string, string>>

type GeneratedEntry = {
  root: string
  files: Record<string, string | null>
}

// What a run's component tree claims, keyed by output path as jostraca names
// it. A scope is a component made with sdkgen's `cmp`: the chain of such
// components above it and the tree path it ran at. A file's owner is the
// scope of the nearest one, so a later run can tell a file that scope stopped
// producing from one whose scope did not run.
type Claims = {
  files: Record<string, string>
  once: string[]
  injected: string[]
  copies: { to: string, owner: string }[]
  scopes: string[]
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

    const files = record[entry.root] ?? (record[entry.root] = new Map())
    for (const [rel, owner] of Object.entries(entry.files)) {
      if ('string' === typeof owner) {
        files.set(rel, owner)
      }
      else if (null === owner) {
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


// A path jostraca reported or a claim names, relative to the root with
// forward slashes, or undefined outside it. Such a path is absolute, or
// relative to the working directory when the output folder is.
function inside(root: string, path: string): string | undefined {
  return under(root, Path.resolve(path))
}


// A recorded path, relative to the root it was recorded under.
function canonical(root: string, rel: string): string | undefined {
  return under(root, Path.resolve(root, rel))
}


function under(root: string, abs: string): string | undefined {
  const rel = Path.relative(Path.resolve(root), abs).split(Path.sep).join('/')

  return ('' === rel || '..' === rel || rel.startsWith('../') || Path.isAbsolute(rel)) ?
    undefined : rel
}


function rootKey(project: string, out: string): string {
  return Path.relative(Path.resolve(project), Path.resolve(out))
    .split(Path.sep).join('/') || '.'
}


function within(out: string, paths: string[], outside: Set<string>): Set<string> {
  const found = new Set<string>()

  for (const path of paths) {
    const rel = inside(out, path)
    if (null == rel) {
      outside.add(path)
    }
    else if (!rel.startsWith('.jostraca/')) {
      found.add(rel)
    }
  }

  return found
}


// Every path a save decided on, written or not. A file jostraca declined to
// write, protected or by its `existing` option, is in no result list.
function savedPaths(jres: any): string[] {
  const audit = 'function' === typeof jres?.audit ? jres.audit() : []

  return (Array.isArray(audit) ? audit : [])
    .map((entry: any) => entry?.[1])
    .filter((meta: any) => 'string' === typeof meta?.action && 'string' === typeof meta?.path)
    .map((meta: any) => meta.path)
}


// Each File node's output path, written or not, and each Inject's target. A
// file written only when absent is the project's once it exists, and an
// Inject edits a region of a file it does not own, so neither is ever the
// record's. A Copy's files are owned by the scope that copied them, found by
// destination, as the tree holds no node per copied file.
function claimedFiles(node: any, folder: string): Claims {
  const claims: Claims = { files: {}, once: [], injected: [], copies: [], scopes: [] }
  claimTree(node, folder, [], '', claims)
  return claims
}


// `base` follows the folder stack jostraca builds from Project and Folder
// nodes; a component's own `name` prop joins its path but makes no folder.
function claimTree(node: any, base: string, chain: string[], owner: string, claims: Claims) {
  if (null == node) {
    return
  }

  const name = node.meta?.[COMPONENT]
  if ('string' === typeof name && '' !== name) {
    chain = [...chain, name]
    owner = chain.join('/') + (0 < (node.path?.length ?? 0) ? '@' + node.path.join('/') : '')
    claims.scopes.push(owner)
  }

  if ('project' === node.kind && 'string' === typeof node.folder) {
    base = node.folder
  }
  else if ('folder' === node.kind && 'string' === typeof node.name) {
    base = base + '/' + node.name
  }
  else if ('copy' === node.kind) {
    claims.copies.push({
      to: 'string' === typeof node.name ? base + '/' + node.name : base, owner,
    })
  }
  else if ('string' === typeof node.fullpath) {
    if ('file' === node.kind) {
      claims.files[node.fullpath] = owner
      if (writtenOnce(node)) {
        claims.once.push(node.fullpath)
      }
    }
    else if ('inject' === node.kind) {
      claims.injected.push(node.fullpath)
    }
  }

  for (const child of node.children ?? []) {
    claimTree(child, base, chain, owner, claims)
  }
}


// As jostraca's FileOp reads `exclude` for an existing file.
function writtenOnce(node: any): boolean {
  const exclude = node.exclude
  return true === exclude ||
    ('string' === typeof exclude ? [exclude] : Array.isArray(exclude) ? exclude : [])
      .includes(node.path?.join('/'))
}


// The owner of an emitted file: its File claim, else the deepest Copy whose
// destination holds it, else '' for a file no scope accounts for.
function claimOwners(
  out: string, claims: Claims | undefined, outside: Set<string>,
): (rel: string) => string {
  const files = new Map<string, string>()
  for (const [path, owner] of Object.entries(claims?.files ?? {})) {
    const rel = inside(out, path)
    if (null != rel) {
      files.set(rel, owner)
    }
  }

  const copies: { prefix: string, owner: string }[] = []
  for (const copy of claims?.copies ?? []) {
    const prefix = Path.resolve(copy.to) === Path.resolve(out) ? '' : inside(out, copy.to)
    if (null == prefix) {
      outside.add(copy.to)
    }
    else {
      copies.push({ prefix, owner: copy.owner })
    }
  }

  return (rel: string): string => {
    const direct = files.get(rel)
    if (null != direct) {
      return direct
    }

    let best: { prefix: string, owner: string } | undefined
    for (const copy of copies) {
      if (('' === copy.prefix || rel === copy.prefix || rel.startsWith(copy.prefix + '/')) &&
        (null == best || best.prefix.length < copy.prefix.length)) {
        best = copy
      }
    }
    return best?.owner ?? ''
  }
}


function isFile(fs: any, abs: string): boolean | undefined {
  try {
    return fs.lstatSync(abs).isFile()
  }
  catch (err: any) {
    return undefined
  }
}


function protectedFile(fs: any, abs: string): boolean {
  try {
    return fs.readFileSync(abs).includes(PROTECT)
  }
  catch (err: any) {
    return false
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
  const abs = Path.resolve(out, rel)

  return folded.has(rel.toLowerCase()) ? 'a generated file has its name in another case' :
    linked(fs, out, rel) ? 'a folder above it is a symbolic link' :
    true !== isFile(fs, abs) ? 'it is not a plain file' :
    protectedFile(fs, abs) ? 'it carries the ' + PROTECT + ' marker' :
    undefined
}


function shown(paths: string[]): string {
  return paths.slice(0, SHOWN).join(', ') + (SHOWN < paths.length ? ', ...' : '')
}


// After a run into `out`: delete each recorded file this run did not emit
// whose scope ran again, then record what changed. The first run into a root
// prunes nothing. A file whose scope did not run (a target or a phase
// switched off), one jostraca saw and declined to write, and one carrying
// the protect marker are left as they are.
function pruneGenerated(ctx: PruneContext): string[] {
  const { fs, log, out } = ctx
  const root = rootKey(ctx.project, out)
  const record = readGenerated(fs, ctx.project)
  const known = record[root]
  const outside = new Set<string>()
  const emitted =
    within(out, EMITTED.flatMap((list) => ctx.jres?.files?.[list] ?? []), outside)
  const seen = within(out, savedPaths(ctx.jres), outside)
  const declared = within(out, Object.keys(ctx.claims?.files ?? {}), outside)
  const once = within(out, ctx.claims?.once ?? [], outside)
  const injected = within(out, ctx.claims?.injected ?? [], outside)
  const ownerOf = claimOwners(out, ctx.claims, outside)
  const scopes = new Set(ctx.claims?.scopes ?? [])

  if (0 < outside.size) {
    const paths = Array.from(outside).sort()
    log.warn({ point: 'generate-record-outside', folder: out, files: paths,
      note: paths.length + ' path(s) resolve outside ' + out +
        ', so they are not recorded: ' + shown(paths) })
  }

  for (const rel of once) {
    emitted.delete(rel)
  }
  for (const rel of injected) {
    if (!declared.has(rel)) {
      emitted.delete(rel)
    }
  }

  const folded = new Set(Array.from(emitted).map((rel) => rel.toLowerCase()))
  const files: Record<string, string | null> = {}
  const pruned: string[] = []
  const unowned: string[] = []

  for (const rel of emitted) {
    const owner = ownerOf(rel)
    if ('' === owner) {
      unowned.push(rel)
    }
    if (known?.get(rel) !== owner) {
      files[rel] = owner
    }
  }

  if (0 < unowned.length) {
    unowned.sort()
    log.warn({ point: 'generate-record-unowned', folder: out, files: unowned,
      note: unowned.length + ' generated file(s) came from no component made with ' +
        'sdkgen\'s cmp, so they are recorded but never removed: ' + shown(unowned) })
  }

  for (const [rel, owner] of known ?? []) {
    if (emitted.has(rel) || seen.has(rel) || declared.has(rel) || injected.has(rel) ||
      canonical(out, rel) !== rel) {
      continue
    }

    if (!fs.existsSync(Path.resolve(out, rel))) {
      files[rel] = null
      continue
    }

    if (!scopes.has(owner)) {
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
  ctx: PruneContext, root: string, files: Record<string, string | null>, fresh: boolean,
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
