
import Path from 'node:path'

import {
  Content,
  cmp,
} from 'jostraca'


import type {
  ActionContext,
} from '../types'

import { indexName, migrateIncludes } from '../helpers/definition'


const indexEntry = (name: string) => `@"./${name}.aontu"`


// Either extension, so a legacy index is READ as naming its items. `.aontu`
// is the only one written; see helpers/definition `migrateIncludes`.
const INDEX_ENTRY_RE = /^\s*@"(?:\.\/)?([^"]+)\.(?:aontu|aon)"\s*(?:#.*)?$/

function indexEntryName(line: string): string | undefined {
  const m = line.match(INDEX_ENTRY_RE)
  return null == m ? undefined : m[1]
}


// Is this name already included by the index?
function hasIndexEntry(content: string, name: string): boolean {
  return content.split('\n')
    .some((line: string) => indexEntryName(line) === name)
}


// Append `@"<name>.aontu"` import lines for each name not already present in
// the index content. Checking against the accumulating result (not the
// original) means duplicate names in the same call are added at most once.
function appendIndexEntries(content: string, names: string[]): string {
  let out = migrateIncludes(content)

  for (const n of names) {
    if (!hasIndexEntry(out, n)) {
      out += '\n' + indexEntry(n)
    }
  }

  return out
}


function removeIndexEntries(content: string, names: string[]): string {
  const drop = new Set(names)

  return content
    .split('\n')
    .filter((line: string) => {
      const name = indexEntryName(line)
      return undefined === name || !drop.has(name)
    })
    .join('\n')
}


const UpdateIndex = cmp(function UpdateIndex(props: any) {
  Content(appendIndexEntries(props.content, props.names))
})


function parseAddNames(args: any[]): string[] {
  return args.slice(2)
    .flatMap((a: any) => 'string' === typeof a ? a.split(',') : a)
    .filter((n: any) => null != n && '' !== n)
}


function loadContent(
  actx: ActionContext, which: string | string[], seed?: Record<string, string>,
) {
  which = Array.isArray(which) ? which : [which]

  const content: any = {}

  const fs = actx.fs()
  const modelfolder = Path.dirname(actx.url)

  which.map((w: string) => {
    const indexfile = Path.join(modelfolder, w, indexName(w))

    content[`${w}_index`] = (null != seed?.[w] && !fs.existsSync(indexfile)) ?
      seed[w] : fs.readFileSync(indexfile, 'utf8')
  })

  return content
}



function ensureModelInclude(actx: ActionContext, kind: string): boolean {
  const fs = actx.fs()
  const url = actx.url

  if (!fs.existsSync(url)) {
    // Said out loud rather than skipped silently: without the include the
    // item is invisible to the next model compile, and a quiet no-op here
    // would look exactly like success.
    actx.log.warn({
      point: 'model-include-absent', kind, file: url,
      note: url + ' not found, so ' + indexEntry(kind + '/' + kind + '-index') +
        ' could not be added — add it by hand, or nothing will see any ' +
        kind + ' item'
    })
    return false
  }

  const name = kind + '/' + kind + '-index'
  const content = String(fs.readFileSync(url, 'utf8'))

  if (hasIndexEntry(content, name)) {
    return false
  }

  if (actx.opts?.dryrun) {
    actx.log.info({
      point: 'model-include-dryrun', kind, file: url, entry: indexEntry(name),
      note: '** DRY RUN ** would add ' + indexEntry(name) + ' to ' + url
    })
    return false
  }

  fs.writeFileSync(url,
    content + (content.endsWith('\n') ? '' : '\n') +
    indexEntry(name) + '\n')

  actx.log.info({
    point: 'model-include-added', kind, file: url, entry: indexEntry(name),
    note: url + ': added ' + indexEntry(name) +
      ' — without it the project model never sees any ' + kind + ' item'
  })

  return true
}


export {
  UpdateIndex,
  ensureModelInclude,
  appendIndexEntries,
  removeIndexEntries,
  hasIndexEntry,
  parseAddNames,
  loadContent
}
