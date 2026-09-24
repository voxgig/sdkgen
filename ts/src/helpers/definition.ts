
import Path from 'node:path'

import { isJunk } from './junk'


// The definition file for one item.
function definitionPath(sdkfolder: string, kind: string, name: string): string {
  return Path.join(sdkfolder, 'model', kind, name + '.aontu')
}


// The file an item ACTUALLY has: `.aontu`, else the pre-rename `.aon`. Without
// the fallback a remove reports success and leaves the file behind.
function definitionPathAny(
  fs: any, sdkfolder: string, kind: string, name: string,
): string {
  const current = definitionPath(sdkfolder, kind, name)
  if (fs.existsSync(current)) {
    return current
  }

  const legacy = Path.join(sdkfolder, 'model', kind, name + '.aon')

  return fs.existsSync(legacy) ? legacy : current
}


// The directory holding a kind's definitions.
function definitionFolder(sdkfolder: string, kind: string): string {
  return Path.join(sdkfolder, 'model', kind)
}


// The include list beside them.
function indexName(kind: string): string {
  return kind + '-index.aontu'
}


function definitionNames(fs: any, sdkfolder: string, kind: string): string[] {
  const dir = definitionFolder(sdkfolder, kind)
  const index = indexName(kind)

  let entries: string[]
  try {
    entries = fs.readdirSync(dir)
  }
  catch (err: any) {
    return []
  }

  // The suffix alone is not enough: `.#target.aontu` is an emacs lock link and
  // `target.aontu.orig` a merge leftover, either of which would invent an item
  // that then resolves nowhere. See helpers/junk. Both extensions, deduped.
  const names = new Set<string>(entries
    .filter((n: string) => /\.(aontu|aon)$/.test(n) && index !== n && !isJunk(n))
    .map((n: string) => n.replace(/\.(aontu|aon)$/, '')))

  return [...names].sort()
}


export {
  definitionPath,
  definitionPathAny,
  definitionFolder,
  definitionNames,
  indexName,
}
