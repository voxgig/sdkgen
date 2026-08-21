// recordKey is a COMPONENT: it imports real @voxgig/sdkgen and
// @voxgig/apidef helpers via node_modules (no local sibling files, so no
// shims needed) and is transpiled + driven directly here.

import { test, describe } from 'node:test'
import { strictEqual } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'


// @voxgig/sdkgen has no self-referencing node_modules symlink (unlike the
// staged dist-test-scaffold), so the bare package name does not resolve
// from inside this repo's own tests — point it at the local build instead.
const SHIMS: Record<string, any> = {
  '@voxgig/sdkgen': require('../dist/sdkgen.js'),
  // Local siblings unrelated to recordKey — stubbed out entirely.
  './Extras_seneca-provider': { Tests: () => { }, Scripts: () => { }, Workflow: () => { }, Readme: () => { }, Docs: () => { } },
  './Gitignore_seneca-provider': { Gitignore: () => { } },
}

function loadComponent(rel: string): any {
  const file = Path.resolve(__dirname, '..', 'project', '.sdk', 'src', 'cmp', rel)
  const js = transform(readFileSync(file, 'utf8'), {
    transforms: ['typescript', 'imports'],
    filePath: file,
  }).code

  const req = (p: string) => (p in SHIMS ? SHIMS[p] : require(p))

  const mod: any = { exports: {} }
  const fn = new Function('exports', 'require', 'module', '__dirname', '__filename', js)
  fn(mod.exports, req, mod, Path.dirname(file), file)
  return mod.exports
}


const { recordKey } = loadComponent('seneca-provider/Main_seneca-provider.ts')


describe('recordKey', () => {

  // Airtable's real shape. opParams() alphabetizes for output stability
  // (base_id, record_id, table_id) — table_id sorts last, so the old
  // "last required param" heuristic picked it as the record's own key
  // instead of record_id, and every downstream mapping was backwards.
  test('a 3-param route picks the terminal path param, not the alphabetically last one', () => {
    const ent = {
      name: 'record',
      fields: {},
      op: {
        load: {
          points: [{
            parts: ['{base_id}', '{table_id}', '{record_id}'],
            args: { params: {
              base_id: { name: 'base_id', reqd: true },
              table_id: { name: 'table_id', reqd: true },
              record_id: { name: 'record_id', reqd: true },
            } },
          }],
        },
      },
    }

    strictEqual(recordKey(ent), 'record_id')
  })


  // The common case: a single path param, already named plainly — matched
  // by entityIdField before the points-based fallback ever runs.
  test('a single-param route with a field named id uses entityIdField', () => {
    const ent = {
      name: 'board',
      fields: { id: { name: 'id' } },
      op: {
        load: {
          points: [{
            parts: ['boards', '{id}'],
            args: { params: { id: { name: 'id', reqd: true } } },
          }],
        },
      },
    }

    strictEqual(recordKey(ent), 'id')
  })

})
