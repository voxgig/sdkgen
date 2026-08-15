// WHERE A KIND'S DEFINITION FILES LIVE.
//
// `model/<kind>/<name>.aontu`, with `model/<kind>/<kind>-index.aontu` as the
// include list beside them. One line of path-building — and it was written out
// longhand in three places (the resolver, the feature catalogue, doctor), each
// with its own idea of which files in that directory count.
//
// That is the same shape of defect this workstream has now fixed four times:
// the same rule expressed twice, drifting. The manifest makes it four callers,
// so it becomes one function first.
//
// The EXCLUSIONS matter as much as the path. A `model/<kind>/` directory holds
// the index file (a list of includes, not a definition) and, in the shipped
// scaffold, a `README.md`. Neither is an item, and a caller that forgets one
// invents a `feature-index` feature.

import Path from 'node:path'


// The definition file for one item.
function definitionPath(sdkfolder: string, kind: string, name: string): string {
  return Path.join(sdkfolder, 'model', kind, name + '.aontu')
}


// The directory holding a kind's definitions.
function definitionFolder(sdkfolder: string, kind: string): string {
  return Path.join(sdkfolder, 'model', kind)
}


// The include list beside them.
function indexName(kind: string): string {
  return kind + '-index.aontu'
}


// Every item of `kind` a `.sdk` folder DEFINES, sorted. Sorted because it
// feeds an exact-set comparison against a manifest and, through
// `availableFeatures`, the feature-trim catalogue — both of which are compared
// as text, so a readdir order that varies by filesystem would vary the result.
//
// An absent directory is not an error: a package providing only features has
// no `model/target/`, and that is the normal shape of a feature package.
function definitionNames(fs: any, sdkfolder: string, kind: string): string[] {
  const dir = definitionFolder(sdkfolder, kind)

  if (!fs.existsSync(dir)) {
    return []
  }

  const index = indexName(kind)

  return fs.readdirSync(dir)
    .filter((n: string) => n.endsWith('.aontu') && index !== n)
    .map((n: string) => n.replace(/\.aontu$/, ''))
    .sort()
}


export {
  definitionPath,
  definitionFolder,
  definitionNames,
  indexName,
}
