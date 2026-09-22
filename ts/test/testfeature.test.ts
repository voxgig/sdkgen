import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import * as struct from '@voxgig/struct'

import { loadFeature } from './featureharness'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


// The point table the mock reads: one route per op, the record keyed by
// `{id}`, so the match built for every op is the record's own key.
const CONFIG = {
  entity: {
    widget: {
      name: 'widget',
      op: {
        load: { points: [point()] },
        update: { points: [point()] },
        remove: { points: [point()] },
        list: { points: [{ parts: ['widget'], args: { params: [], query: [] } }] },
      },
    },
  },
}

function point() {
  return { parts: ['widget', '{id}'], args: { params: [{ name: 'id', reqd: true }], query: [] } }
}


function makeMock(entity: any) {
  const client: any = { _mode: 'live' }
  const utility: any = {
    struct,
    fetcher: undefined,
    param: (ctx: any, name: string) =>
      null != ctx.reqdata?.[name] ? ctx.reqdata[name] : ctx.reqmatch?.[name],
  }
  const rootctx: any = { client, utility, config: CONFIG }

  const TestFeature = loadFeature('test')
  const f = new TestFeature()
  f.init(rootctx, { active: true, entity })

  return async function call(opname: string, args: { reqdata?: any, reqmatch?: any } = {}) {
    const ctx: any = {
      client, utility, config: CONFIG, ctrl: {},
      op: { name: opname, entity: 'widget', alias: {} },
      entity: { name: 'widget' },
      reqdata: args.reqdata || {},
      reqmatch: args.reqmatch || {},
      match: {},
      data: {},
      point: { transform: {} },
    }
    const res = await utility.fetcher(ctx, 'http://api.test/widget', {})
    return { status: res.status, statusText: res.statusText, data: await res.json() }
  }
}


describe('feature:test mock semantics', () => {

  test('an update that matches nothing is a 404, and touches no record', async () => {
    const seed = { widget: { w1: { name: 'one', nested: { x: 1, y: 2 } } } }
    const call = makeMock(seed)

    const miss = await call('update', { reqdata: { id: 'nope', name: 'changed' } })
    strictEqual(miss.status, 404)
    strictEqual(miss.statusText, 'Not found')

    const load = await call('load', { reqmatch: { id: 'w1' } })
    strictEqual(load.status, 200)
    strictEqual(load.data.name, 'one', 'the miss rewrote an unrelated record')
  })


  test('an update merges deeply', async () => {
    const call = makeMock({ widget: { w1: { name: 'one', nested: { x: 1, y: 2 } } } })

    const hit = await call('update', { reqdata: { id: 'w1', nested: { y: 3 } } })
    strictEqual(hit.status, 200)
    deepStrictEqual(hit.data.nested, { x: 1, y: 3 })
    strictEqual(hit.data.name, 'one')
  })


  test('a remove that matches nothing is a 200 no-op', async () => {
    const call = makeMock({ widget: { w1: { name: 'one' } } })

    const miss = await call('remove', { reqmatch: { id: 'nope' } })
    strictEqual(miss.status, 200)

    const load = await call('load', { reqmatch: { id: 'w1' } })
    strictEqual(load.status, 200, 'the miss removed an unrelated record')
  })


  test('an operation the mock does not know is a 404', async () => {
    const call = makeMock({ widget: {} })

    const res = await call('archive', { reqmatch: { id: 'w1' } })
    strictEqual(res.status, 404)
    strictEqual(res.statusText, 'Unknown operation')
  })


  test('a seed record takes its id from its map key', async () => {
    const call = makeMock({ widget: { w1: { name: 'one' } } })

    const load = await call('load', { reqmatch: { id: 'w1' } })
    strictEqual(load.status, 200)
    strictEqual(load.data.id, 'w1')
  })
})


// The same mock in every target. Each port carries the marker on its
// update-miss branch and reads required QUERY params into the match; a
// port that regains the fall-through to "any record" loses the marker.
describe('feature:test parity', () => {

  const SITES: [string, string][] = [
    ['c', 'feature/test.c'],
    ['clojure', 'src/sdk/features.clj'],
    ['cpp', 'feature/test.hpp'],
    ['csharp', 'feature/TestFeature.cs'],
    ['elixir', 'lib/projectname/feature/test.ex'],
    ['go', 'feature/test_feature.go'],
    ['java', 'feature/TestFeature.java'],
    ['js', 'src/feature/test/TestFeature.js'],
    ['kotlin', 'feature/TestFeature.kt'],
    ['lua', 'feature/test_feature.lua'],
    ['ocaml', 'sdk_features.ml'],
    ['perl', 'feature/test_feature.pm'],
    ['php', 'feature/TestFeature.php'],
    ['py', 'pkg/feature/test_feature.py'],
    ['rb', 'feature/test_feature.rb'],
    ['rust', 'feature/test.rs'],
    ['scala', 'feature/TestFeature.scala'],
    ['swift', 'Sources/ProjectNameSDK/feature/TestFeature.swift'],
    ['ts', 'src/feature/test/TestFeature.ts'],
    ['zig', 'feature/test.zig'],
  ]

  const MARK = 'update miss: 404, never another record'
  const QUERY = /args\.query|["']query["']/

  test('the site table covers every SDK target', () => {
    const NON_SDK = ['go-cli', 'go-mcp', 'py-data']
    const shipped = Fs.readdirSync(TM)
      .filter((n) => Fs.statSync(Path.join(TM, n)).isDirectory())
      .filter((n) => !NON_SDK.includes(n))
      .sort()
    deepStrictEqual(SITES.map(([t]) => t).sort(), shipped)
  })

  for (const [target, rel] of SITES) {
    test(target + ': update miss is a 404 and query params are matched', () => {
      const src = Fs.readFileSync(Path.join(TM, target, rel), 'utf8')
      ok(src.includes(MARK), target + ': the update-miss branch lost its marker (' + rel + ')')
      ok(QUERY.test(src), target + ': required query params are no longer read (' + rel + ')')
    })
  }
})
