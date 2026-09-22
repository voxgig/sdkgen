
import { test, describe } from 'node:test'
import { ok, deepStrictEqual, strictEqual } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'

import * as struct from '@voxgig/struct'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


// Load a shipped template module. Type-only imports (`../types`) vanish in
// the transpile; value imports of sibling templates are shimmed.
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


const IMPL: [string, any, any][] = [
  [
    'ts',
    loadTemplate('ts/src/utility/PrepareQueryUtility.ts', { '../types': {} }).prepareQuery,
    loadTemplate('ts/src/utility/TransformRequestUtility.ts', { '../types': {} }).transformRequest,
  ],
  [
    'js',
    loadTemplate('js/src/utility/PrepareQueryUtility.js').prepareQuery,
    loadTemplate('js/src/utility/TransformRequestUtility.js').transformRequest,
  ],
]


const utility = {
  struct,
  makeError: (_ctx: any, err: any) => { throw err },
}


function queryCtx(reqmatch: any, params: string[] = ['id']) {
  return { utility, point: { params }, reqmatch }
}


function bodyCtx(reqdata: any, req: any = '`reqdata`') {
  return { utility, spec: {}, point: { transform: { req } }, reqdata }
}


describe('actionstrip: the $action selector never reaches the wire', () => {

  for (const [lang, prepareQuery, transformRequest] of IMPL) {

    test(lang + ': prepareQuery drops $action and keeps the other match keys', () => {
      const reqmatch = { $action: 'archive', id: 'i1', page: 2, q: 'x' }
      const before = JSON.stringify(reqmatch)

      const query = prepareQuery(queryCtx(reqmatch))

      deepStrictEqual(query, { page: 2, q: 'x' })
      strictEqual(JSON.stringify(reqmatch), before, 'reqmatch was mutated')
    })


    test(lang + ': prepareQuery without $action is unchanged', () => {
      deepStrictEqual(prepareQuery(queryCtx({ id: 'i1', page: 2 })), { page: 2 })
      deepStrictEqual(prepareQuery(queryCtx({})), {})
    })


    test(lang + ': transformRequest drops $action from the body via the spec path', () => {
      const reqdata = { $action: 'merge', name: 'n', nested: { $action: 'kept' } }
      const before = JSON.stringify(reqdata)

      const body = transformRequest(bodyCtx(reqdata))

      deepStrictEqual(body, { name: 'n', nested: { $action: 'kept' } })
      ok(!Object.prototype.hasOwnProperty.call(body, '$action'))
      strictEqual(JSON.stringify(reqdata), before, 'reqdata was mutated')
    })


    test(lang + ': transformRequest drops $action from a function transform too', () => {
      const reqform = (ctx: any) => ({ ...ctx.reqdata, extra: true })
      const body = transformRequest(bodyCtx({ $action: 'merge', name: 'n' }, reqform))

      deepStrictEqual(body, { name: 'n', extra: true })
    })


    test(lang + ': transformRequest leaves a body without $action alone', () => {
      const same = (ctx: any) => ctx.reqdata
      const reqdata = { name: 'n' }
      strictEqual(transformRequest(bodyCtx(reqdata, same)), reqdata, 'no copy when nothing to strip')
      deepStrictEqual(transformRequest(bodyCtx({ name: 'n' })), { name: 'n' })
      deepStrictEqual(transformRequest(bodyCtx([1, 2], same)), [1, 2])
      strictEqual(transformRequest(bodyCtx('s', same)), 's')
    })
  }
})


// Where each SDK target assembles the query and the body. A port that loses
// the strip stops mentioning the selector in that function, and fails here.
// The consumer targets (go-cli, go-mcp, py-data) wrap a sibling and have no
// pipeline of their own.
type Site = [file: string, fn?: string]

const SITES: Record<string, { query: Site, body: Site }> = {
  ts: {
    query: ['ts/src/utility/PrepareQueryUtility.ts'],
    body: ['ts/src/utility/TransformRequestUtility.ts'],
  },
  js: {
    query: ['js/src/utility/PrepareQueryUtility.js'],
    body: ['js/src/utility/TransformRequestUtility.js'],
  },
  go: {
    query: ['go/utility/prepare_query.go'],
    body: ['go/utility/transform_request.go'],
  },
  py: {
    query: ['py/pkg/utility/prepare_query.py'],
    body: ['py/pkg/utility/transform_request.py'],
  },
  rb: {
    query: ['rb/utility/prepare_query.rb'],
    body: ['rb/utility/transform_request.rb'],
  },
  php: {
    query: ['php/utility/PrepareQuery.php'],
    body: ['php/utility/TransformRequest.php'],
  },
  java: {
    query: ['java/utility/PrepareQuery.java'],
    body: ['java/utility/TransformRequest.java'],
  },
  c: {
    query: ['c/utility/prepare_query.c'],
    body: ['c/utility/transform_request.c'],
  },
  csharp: {
    query: ['csharp/utility/PrepareQuery.cs'],
    body: ['csharp/utility/TransformRequest.cs'],
  },
  lua: {
    query: ['lua/utility/prepare_query.lua'],
    body: ['lua/utility/transform_request.lua'],
  },
  perl: {
    query: ['perl/utility/prepare_query.pm'],
    body: ['perl/utility/transform_request.pm'],
  },
  rust: {
    query: ['rust/utility/prepare_query.rs'],
    body: ['rust/utility/transform_request.rs'],
  },
  cpp: {
    query: ['cpp/utility/pipeline.hpp', 'inline Value prepareQuery('],
    body: ['cpp/utility/pipeline.hpp', 'inline Value transformRequest('],
  },
  zig: {
    query: ['zig/core/utility.zig', 'pub fn prepare_query_util('],
    body: ['zig/core/utility.zig', 'pub fn transform_request_util('],
  },
  swift: {
    query: ['swift/Sources/ProjectNameSDK/utility/Prepare.swift', 'func prepareQueryUtil('],
    body: ['swift/Sources/ProjectNameSDK/utility/ResultUtil.swift', 'func transformRequestUtil('],
  },
  kotlin: {
    query: ['kotlin/utility/Prepare.kt', 'fun prepareQuery('],
    body: ['kotlin/utility/ResultTransform.kt', 'fun transformRequest('],
  },
  scala: {
    query: ['scala/utility/Prepare.scala', 'def prepareQuery('],
    body: ['scala/utility/Transform.scala', 'def transformRequest('],
  },
  elixir: {
    query: ['elixir/lib/projectname/utility.ex', 'def prepare_query_impl('],
    body: ['elixir/lib/projectname/utility.ex', 'def transform_request_impl('],
  },
  clojure: {
    query: ['clojure/src/sdk/core.clj', '(defn u-prepare-query '],
    body: ['clojure/src/sdk/core.clj', '(defn u-transform-request '],
  },
  ocaml: {
    query: ['ocaml/sdk_runtime.ml', 'let prepare_query_util '],
    body: ['ocaml/sdk_runtime.ml', 'let transform_request_util '],
  },
}

const SDK_TARGETS = [
  'ts', 'js', 'go', 'py', 'php', 'rb', 'lua', 'csharp', 'java', 'kotlin',
  'scala', 'swift', 'rust', 'c', 'cpp', 'zig', 'perl', 'clojure', 'elixir',
  'ocaml',
]


// A window around the named definition: wide enough to hold the strip helper
// declared beside it, narrow enough to exclude the target's makePoint, which
// legitimately reads `$action`.
function siteText([file, fn]: Site): string {
  const lines = readFileSync(Path.join(TM, file), 'utf8').split('\n')
  if (null == fn) {
    return lines.join('\n')
  }
  const at = lines.findIndex((l) => l.includes(fn))
  ok(-1 < at, file + ': function not found: ' + fn)
  return lines.slice(Math.max(0, at - 40), at + 60).join('\n')
}


describe('actionstrip: every SDK target strips the selector', () => {

  test('the site table covers exactly the SDK targets', () => {
    deepStrictEqual(Object.keys(SITES).sort(), [...SDK_TARGETS].sort())
  })


  for (const lang of SDK_TARGETS) {
    test(lang + ': prepare-query and transform-request both mention $action', () => {
      const site = SITES[lang]
      ok(siteText(site.query).includes('$action'),
        lang + ': ' + site.query[0] + ' no longer strips $action from the query')
      ok(siteText(site.body).includes('$action'),
        lang + ': ' + site.body[0] + ' no longer strips $action from the body')
    })
  }
})
