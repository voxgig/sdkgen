// seedRecord is a COMPONENT: it imports real @voxgig/sdkgen via node_modules
// (no local sibling files, so no shims needed beyond the package itself) and
// is transpiled + driven directly here.

import { test, describe } from 'node:test'
import { strictEqual } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'


const SHIMS: Record<string, any> = {
  '@voxgig/sdkgen': require('../dist/sdkgen.js'),
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


const { seedRecord } = loadComponent('seneca-provider/Extras_seneca-provider.ts')


describe('seedRecord', () => {

  // GitHub's real shape: `owner` is both a required PARENT PATH PARAM (the
  // {owner} URL segment) and an unrelated response FIELD (the repo's owner
  // object) — no entity in the model is literally named `owner`, so
  // parentEntity resolves to ''. The old `${f.parentEntity}0` formula seeded
  // '0'; the query built elsewhere (parentPairs/parentSeed) filtered for
  // 'owner0' — seed and query disagreed.
  test('a parent key colliding with an unrelated same-named field seeds via parentSeed, not a bare index', () => {
    const e = {
      name: 'repo',
      idf: 'id',
      parents: ['owner'],
      fields: [
        { name: 'id', kind: 'string', parentEntity: '' },
        { name: 'owner', kind: 'object', parentEntity: '' },
      ],
    }

    const rec = seedRecord(e, 0)
    strictEqual(rec.owner, 'owner0')
  })

  // Zoom's real shape: `user_id` guards `list`/`create` but has NO matching
  // response field at all — Main forces it into `e.fields` as a synthetic
  // required field (kind: 'string', parentEntity: '') so the mock can filter
  // by it. Same formula, same bug: seeded '0' instead of 'user0', so a
  // list$({user_id: 'user0'}) query matched nothing.
  test('a parent key with no real matching field (Main\'s forced-in field) seeds via parentSeed too', () => {
    const e = {
      name: 'meeting',
      idf: 'id',
      parents: ['user_id'],
      fields: [
        { name: 'id', kind: 'string', parentEntity: '' },
        { name: 'user_id', kind: 'string', parentEntity: '' },
      ],
    }

    const rec = seedRecord(e, 0)
    strictEqual(rec.user_id, 'user0')
  })

  // The working case, unchanged: a parent key that DOES resolve to a real
  // entity in the model seeds that entity's id, exactly as before.
  test('a parent key resolving to a real entity still seeds that entity\'s id', () => {
    const e = {
      name: 'table',
      idf: 'id',
      parents: ['base_id'],
      fields: [
        { name: 'id', kind: 'string', parentEntity: '' },
        { name: 'base_id', kind: 'string', parentEntity: 'base' },
      ],
    }

    const rec = seedRecord(e, 0)
    strictEqual(rec.base_id, 'base0')
  })

})
