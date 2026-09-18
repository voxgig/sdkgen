import { kindCollection } from '../helpers/kindCollection'

import Path from 'node:path'

import { getelem } from '@voxgig/struct'

import { KIT } from '../types'

import { definitionPath } from '../helpers/definition'
import { readManifest, checkShape, ITEM_NAME_RE } from '../helpers/manifest'


const BUNDLED = 'node_modules/@voxgig/sdkgen/project/.sdk'


type Source = {
  name: string

  // The name it has in the SOURCE. Differs from `name` only for an alias.
  origname: string

  folder: string

  // The same folder relative to the project, '/'-normalised — the value
  // recorded as provenance. See helpers/stdrep.
  base: string

  model: string

  // The sdkgen package that provided it, when the source has a manifest.
  // Undefined for a bare `.sdk`-shaped folder, which stays legal.
  package?: string
}


function lastSegment(ref: string): string {
  return getelem(ref.split('/').flatMap((p: string) => p.split(Path.sep)), -1)
}


function resolveSource(ref: string, kind: string, ctx$: any): Source {
  // Registration and copying must resolve a bare resync name identically.
  const declared = kindCollection(ctx$.model, kind)?.[ref]
  ref = (isBare(ref) && recordedRef(declared, ref)) || ref
  const root = ctx$.folder
  const fs = ctx$.fs()

  let folder = Path.normalize(Path.join(root, BUNDLED))
  let name = lastSegment(ref)

  const sep = Math.max(ref.lastIndexOf('/'), ref.lastIndexOf(Path.sep))
  const dir = sep < 0 ? '' : ref.slice(0, sep + 1)
  const last = sep < 0 ? ref : ref.slice(sep + 1)

  const aliasing = last.split('~')
  const origlast = aliasing[0]

  let aliasref = dir + origlast
  let origname = origlast
  if (1 < aliasing.length) {
    name = aliasing.slice(1).join('~')

    if (!ITEM_NAME_RE.test(name)) {
      throw new Error(
        'Invalid ' + kind + ' alias: ' + JSON.stringify(name) +
        ' in ' + ref + '\n  an alias is a NAME (matching ' +
        ITEM_NAME_RE.source + '), not a path — it becomes the directory the ' +
        kind + ' is installed into')
    }
  }

  const search: string[] = []
  let found = false

  // Windows: an absolute ref is `D:\a\...` or `D:/a/...`, and a Path.join'd
  // one carries backslashes, so neither `includes('/')` nor `startsWith('/')`
  // recognises it. Path.isAbsolute and Path.sep are platform-correct and
  // reduce to the same answers on POSIX.
  if (aliasref.includes('/') || aliasref.includes(Path.sep)) {
    const aliasbase = Path.dirname(aliasref)

    if (!Path.isAbsolute(aliasref)) {
      folder = Path.normalize(Path.join(root, 'node_modules', aliasbase, '.sdk'))
      search.push(folder)
      found = fs.existsSync(folder)

      if (!found) {
        folder = Path.normalize(Path.join(root, aliasbase, '.sdk'))
        search.push(folder)
        found = fs.existsSync(folder)
      }
    }
    else {
      folder = Path.normalize(Path.join(aliasbase, '.sdk'))
      search.push(folder)
      found = fs.existsSync(folder)
    }
  }
  else {
    search.push(folder)
    found = fs.existsSync(folder)
  }

  if (!found) {
    throw new Error(
      capitalise(kind) + ' folder not found in:\n' + search.join('\n  '))
  }

  // `base` is the folder relative to the project root. Compare with the
  // PLATFORM separator: on Windows `root + '/'` never prefixes a normalised
  // absolute path, so the root would not be stripped and `base` would stay
  // absolute. Normalise both sides first for the same reason.
  const nroot = Path.normalize(root)
  const rootslash = nroot.endsWith(Path.sep) ? nroot : nroot + Path.sep

  return {
    name,
    origname,
    folder,
    base: (folder.startsWith(rootslash)
      ? folder.slice(rootslash.length)
      : folder).split(Path.sep).join('/'),
    // Path.join, not concatenation: an absolute Windows ref makes `folder`
    // backslash-separated, and appending '/model/...' produced a mixed-
    // separator path that some readers handle and others do not.
    model: definitionPath(folder, kind, origname),

    package: sourcePackage(fs, folder, kind, origname, ctx$),
  }
}


function sourcePackage(
  fs: any, folder: string, kind: string, origname: string, ctx$: any,
): string | undefined {
  const read = readManifest(fs, folder)

  if (null != read.err) {
    warnManifest(ctx$, read.file, read.err)
    return undefined
  }

  if (null == read.manifest) {
    return undefined
  }

  const shape = checkShape(read.manifest, read.file)

  if (0 < shape.length) {
    warnManifest(ctx$, read.file,
      shape.map((f: any) => f.note).join('; '))
    return undefined
  }

  const claimed = read.manifest.provides?.[kind]

  if (!Array.isArray(claimed) || !claimed.includes(origname)) {
    ctx$.log?.info({
      point: 'package-item-unclaimed', file: read.file, kind, name: origname,
      note: read.file + ': ' + kind + ' `' + origname + '` is not listed in ' +
        '`provides.' + kind + '`, so the copy records no `package` ' +
        'provenance — add it to the manifest if the package supplies it'
    })
    return undefined
  }

  return read.manifest.name
}


function warnManifest(ctx$: any, file: string, err: string) {
  ctx$.log?.warn({
    point: 'package-manifest-unreadable', file, err,
    note: file + ': ignoring an unusable package manifest (' + err +
      '); the copy records no `package` provenance'
  })
}


function registerInstalled(kind: string, refs: string[], ctx$: any) {
  const kit: any = ctx$.model?.main?.[KIT]

  if (null == kit) {
    return
  }

  const items = kindCollection(ctx$.model, kind, true)

  for (const ref of refs) {
    let source: Source
    try {
      source = resolveSource(ref, kind, ctx$)
    }
    catch (err: any) {
      ctx$.log?.warn({
        point: 'model-register-failed', kind, ref, err: err.message,
        note: ref + ': could not be added to the in-memory model (' +
          err.message + '); anything later in this command will behave as ' +
          'if it is not installed'
      })
      continue
    }

    // Merge, never replace: the model may already carry the project's own
    // configuration for this item, which is the project's, not the source's.
    items[source.name] = {
      ...(items[source.name] ?? {}),
      name: source.name,
      base: source.base,
      origname: source.origname,
      ...(null == source.package ? {} : { package: source.package }),
    }
  }
}


function nameConflict(
  kind: string, source: Source, ctx$: any,
): { package?: string, base?: string } | undefined {
  const declared: any = kindCollection(ctx$.model, kind)?.[source.name]

  if (null == declared || 'object' !== typeof declared) {
    return undefined
  }

  // Nothing recorded — a copy predating provenance. It cannot be shown to be
  // a different source, and refusing on a suspicion would block every
  // pre-provenance project from adopting a package.
  if (null == declared.base || '' === declared.base) {
    return undefined
  }

  const samePackage = null != source.package && '' !== source.package &&
    declared.package === source.package

  const sameBase = normaliseBase(declared.base) === normaliseBase(source.base)

  if (samePackage || sameBase) {
    return undefined
  }

  return providesStill(kind, declared, source, ctx$) ? declared : undefined
}


function providesStill(
  kind: string, declared: any, source: Source, ctx$: any,
): boolean {
  let fs: any
  try {
    fs = ctx$.fs()
  }
  catch (err: any) {
    return true
  }

  const base = String(declared.base)
  const folder = Path.isAbsolute(base) ?
    Path.normalize(base) :
    Path.normalize(Path.join(ctx$.folder, base))

  if (!fs.existsSync(folder)) {
    // Uninstalled, moved, or never fetched. Nothing there to collide with.
    return false
  }

  const seek = declared.origname || source.name

  const read = readManifest(fs, folder)
  const manifest = read.manifest
  if (null != manifest && 0 === checkShape(manifest, read.file).length) {
    const names = manifest.provides?.[kind]
    return Array.isArray(names) && names.includes(seek)
  }

  // No manifest, or one too malformed to be believed: a bare `.sdk`-shaped
  // folder is a legal source, and its definition file is the only claim it
  // makes.
  return fs.existsSync(definitionPath(folder, kind, seek))
}


function recordedRef(declared: any, name: string): string | undefined {
  if (null == declared?.base || '' === declared.base) {
    return undefined
  }

  const origname = declared.origname || name

  return Path.join(declared.base, '..', origname) +
    (origname === name ? '' : '~' + name)
}


function isBare(ref: string): boolean {
  return !ref.includes('/') && !ref.includes(Path.sep)
}


function normaliseBase(base: string): string {
  return Path.normalize(String(base ?? '')).split(Path.sep).join('/')
}


function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


export type {
  Source,
}

export {
  resolveSource,
  recordedRef,
  isBare,
  registerInstalled,
  nameConflict,
  lastSegment,
  BUNDLED,
}
