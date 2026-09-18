
import Path from 'node:path'

import { isJunk } from './junk'


// The definition file for one item.
function definitionPath(sdkfolder: string, kind: string, name: string): string {
  return Path.join(sdkfolder, 'model', kind, name + '.aon')
}


// The directory holding a kind's definitions.
function definitionFolder(sdkfolder: string, kind: string): string {
  return Path.join(sdkfolder, 'model', kind)
}


// The include list beside them.
function indexName(kind: string): string {
  return kind + '-index.aon'
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

  // The `.aon` suffix is not enough on its own: an emacs lock link is named
  // `.#target.aon` and a merge leaves `target.aon.orig`, so an editor open
  // in the wrong window invents an item called `.#target`, which then fails to
  // resolve everywhere it is named. See helpers/junk.
  return entries
    .filter((n: string) => n.endsWith('.aon') && index !== n && !isJunk(n))
    .map((n: string) => n.replace(/\.aon$/, ''))
    .sort()
}


export {
  definitionPath,
  definitionFolder,
  definitionNames,
  indexName,
}
