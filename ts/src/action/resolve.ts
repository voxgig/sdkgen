// Where a `<kind> add <ref>` gets its definition from.
//
// One resolver for every KIND of thing an add can install — targets today,
// features as of this change, more later — because the ref grammar is the
// same whatever is being added, and it had drifted: `target add` accepted a
// path ref and an alias, while `feature add` accepted only a bare name and
// read from a hardcoded `node_modules/@voxgig/sdkgen`. A feature defined
// anywhere else could not be added at all.
//
// It lives in its own module rather than in `target.ts` because `target.ts`
// imports `feature_add`, so a resolver there would put `feature.ts` and
// `target.ts` in a require cycle.

import Path from 'node:path'

import { getelem } from '@voxgig/struct'


// The bundled scaffold: what a bare name resolves to.
const BUNDLED = 'node_modules/@voxgig/sdkgen/project/.sdk'


type Source = {
  // The name it is INSTALLED as (the alias, when one was given).
  name: string

  // The name it has in the SOURCE. Differs from `name` only for an alias.
  origname: string

  // The resolved `.sdk` folder, as a path to read from.
  folder: string

  // The same folder relative to the project, '/'-normalised — the value
  // recorded as provenance. See helpers/stdrep.
  base: string

  // The definition file inside that folder, for this kind.
  model: string
}


// Last path segment of a ref. A ref may be a bare name ('go'), a
// package-relative path ('@acme/kit/go'), or an ABSOLUTE path — and on Windows
// an absolute path is separated by `\`, so splitting on '/' alone hands back
// the whole path as the name and every lookup below then misses. On POSIX
// Path.sep IS '/', so this is the same split it always was.
function lastSegment(ref: string): string {
  return getelem(ref.split('/').flatMap((p: string) => p.split(Path.sep)), -1)
}


function resolveSource(ref: string, kind: string, ctx$: any): Source {
  const root = ctx$.folder
  const fs = ctx$.fs()

  let folder = Path.normalize(Path.join(root, BUNDLED))
  let name = lastSegment(ref)

  // `<ref>~<alias>` installs the ref's definition under a different name.
  let aliasref = ref
  let origname = lastSegment(aliasref)
  const aliasing = ref.split('~')
  if (1 < aliasing.length) {
    aliasref = aliasing[0]
    name = aliasing.slice(1).join('~')
    origname = lastSegment(aliasref)
  }

  const search: string[] = []
  let found = false

  // Windows: an absolute ref is `D:\a\...` or `D:/a/...`, and a Path.join'd
  // one carries backslashes, so neither `includes('/')` nor `startsWith('/')`
  // recognises it. Path.isAbsolute and Path.sep are platform-correct and
  // reduce to the same answers on POSIX.
  if (aliasref.includes('/') || aliasref.includes(Path.sep)) {
    // NOTE: the last path element of the ref is the name, not a folder.
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
    // '/'-normalised, unlike `folder`. `base` is the one value here that gets
    // WRITTEN INTO A COMMITTED FILE (the provenance stamp), so it must not
    // depend on the OS that ran the add: on Windows Path.join yields
    // `node_modules\@voxgig\sdkgen\project\.sdk`, so the same project resynced
    // on Linux and on Windows produced two different model files and each
    // churned the other's. Forward slashes are accepted by every Node path API
    // on Windows, so the readers are unaffected.
    base: (folder.startsWith(rootslash)
      ? folder.slice(rootslash.length)
      : folder).split(Path.sep).join('/'),
    model: folder + '/model/' + kind + '/' + origname + '.aontu',
  }
}


function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


export type {
  Source,
}

export {
  resolveSource,
  lastSegment,
  BUNDLED,
}
