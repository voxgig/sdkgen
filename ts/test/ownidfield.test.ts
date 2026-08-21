// ownIdField is a TEMPLATE: it ships to users verbatim, outside sdkgen's own
// tsconfig, so nothing here compiled or ran it before. This suite transpiles
// the real shipped file and drives it directly.

import { test, describe } from 'node:test'
import { strictEqual } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


function loadTemplate(rel: string, shims: Record<string, any> = {}): any {
  const file = Path.join(TM, rel)
  const js = transform(readFileSync(file, 'utf8'), {
    transforms: ['typescript', 'imports'],
    filePath: file,
  }).code

  const req = (p: string) => {
    for (const key of Object.keys(shims)) {
      if (p === key || p.endsWith(key)) {
        return shims[key]
      }
    }
    return require(p)
  }

  const mod: any = { exports: {} }
  const fn = new Function('exports', 'require', 'module', '__dirname', '__filename', js)
  fn(mod.exports, req, mod, Path.dirname(file), file)
  return mod.exports
}


const { ownIdField } = loadTemplate('ts/src/feature/test/TestFeature.ts', {
  '../../types': {},
  '../../ProjectNameSDK': {},
  '../base/BaseFeature': { BaseFeature: class { } },
})


// A getpath stand-in that reads the same nested-object shape the real
// struct utility does: config.entity.<name>.op.<opname>.points.
function getpath(config: any, path: string[]): any {
  return path.reduce((o, k) => (null == o ? o : o[k]), config)
}


describe('ownIdField', () => {

  // Airtable's real shape: base_id, table_id, record_id ALPHABETIZE with
  // table_id last — the old opParams-based heuristic in
  // Main_seneca-provider.ts picked that as "the record's own key" and the
  // mock seeded the wrong field entirely. parts preserves true path order.
  test('a 3-param route picks the terminal path param, not the alphabetically last one', () => {
    const config = {
      entity: {
        record: {
          op: {
            load: {
              points: [{
                parts: ['{base_id}', '{table_id}', '{record_id}'],
              }],
            },
          },
        },
      },
    }

    strictEqual(ownIdField(config, getpath, 'record'), 'record_id')
  })


  // The common case: a single path param, already named plainly.
  test('a single-param route picks that param', () => {
    const config = {
      entity: {
        board: {
          op: {
            load: {
              points: [{ parts: ['boards', '{id}'] }],
            },
          },
        },
      },
    }

    strictEqual(ownIdField(config, getpath, 'board'), 'id')
  })


  // No load points at all (list-only entity, or a fresh model) — fall back
  // to the conventional 'id' rather than throwing.
  test('an entity with no points falls back to id', () => {
    const config = { entity: { history: { op: {} } } }
    strictEqual(ownIdField(config, getpath, 'history'), 'id')
  })

})
