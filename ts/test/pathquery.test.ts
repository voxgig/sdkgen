
import { test, describe } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


function loadTemplate(rel: string): any {
  const file = Path.join(TM, rel)
  const js = transform(readFileSync(file, 'utf8'), {
    transforms: ['typescript', 'imports'],
    filePath: file,
  }).code

  const mod: any = { exports: {} }
  const fn = new Function('exports', 'require', 'module', '__dirname', '__filename', js)
  fn(mod.exports, require, mod, Path.dirname(file), file)
  return mod.exports
}


const struct = { items: (o: any) => Object.entries(o ?? {}) }

function ctx(point: any, reqmatch: any) {
  return { utility: { struct }, point, reqmatch }
}


// The generated config lists path parameters as `args.params`, objects with a
// `name`, and never a flat `point.params`. Reading only the flat list, every
// target sent `GET /addresses/adr_1?id=adr_1`, which a strict server rejects,
// and the shared corpus, which pins the flat list alone, stayed green.
describe('prepareQuery', () => {

  const impls: Record<string, any> = {
    ts: loadTemplate('ts/src/utility/PrepareQueryUtility.ts').prepareQuery,
    js: require(Path.join(TM, 'js', 'src', 'utility', 'PrepareQueryUtility.js')).prepareQuery,
  }

  for (const [lang, prepareQuery] of Object.entries(impls)) {
    test(lang + ': a path parameter from args.params stays out of the query', () => {
      const point = { args: { params: [{ name: 'id', orig: 'adr_id', kind: 'param' }] } }
      deepStrictEqual(prepareQuery(ctx(point, { id: 'adr_1', limit: 2 })), { limit: 2 })
    })

    test(lang + ': the flat list of names still counts', () => {
      deepStrictEqual(prepareQuery(ctx({ params: ['a'] }, { a: 'A', b: 'B' })), { b: 'B' })
    })

    test(lang + ': an action and a null never reach the query', () => {
      const point = { args: { params: [] } }
      deepStrictEqual(prepareQuery(ctx(point, { $action: 'x', q: 1, n: null })), { q: 1 })
    })

    // The model offers Lob's caller `resource_id` for `resource_ids` and
    // `campaign_id` for `campaignId`, names the API does not declare.
    test(lang + ': a query argument goes out under its orig', () => {
      const point = { args: { query: [
        { name: 'resource_id', orig: 'resource_ids', kind: 'query' },
        { name: 'campaign_id', orig: 'campaignId', kind: 'query' },
        { name: 'limit', orig: 'limit', kind: 'query' },
      ] } }
      deepStrictEqual(
        prepareQuery(ctx(point, { resource_id: ['r1'], campaign_id: 'c1', limit: 2 })),
        { resource_ids: ['r1'], campaignId: 'c1', limit: 2 })
    })

    test(lang + ': a name the config does not declare passes through', () => {
      const point = { args: { query: [{ name: 'q', kind: 'query' }] } }
      deepStrictEqual(prepareQuery(ctx(point, { q: 1, constructor: 'c', other: 'o' })),
        { q: 1, constructor: 'c', other: 'o' })
    })

    // Novu's `idempotency-key` and Maxio's `Authorization` went out as
    // `?idempotency_key=` and `?authorization=`.
    test(lang + ': a header argument stays out of the query', () => {
      const point = { args: {
        header: [{ name: 'idempotency_key', orig: 'idempotency-key', kind: 'header' }],
        query: [{ name: 'limit', orig: 'limit', kind: 'query' }],
      } }
      deepStrictEqual(prepareQuery(ctx(point, { idempotency_key: 'k1', limit: 2 })), { limit: 2 })
    })
  }


  // A template that reads only `params` is the defect, whatever the language.
  // This reads source, so it proves the shape is looked up, not that it runs.
  // Each entry is the file and the start of the function's definition.
  const TEMPLATES: Record<string, [string, string]> = {
    c: ['c/utility/prepare_query.c', 'voxgig_value* prepare_query_util('],
    clojure: ['clojure/src/sdk/core.clj', '(defn u-prepare-query'],
    cpp: ['cpp/utility/pipeline.hpp', 'inline Value prepareQuery('],
    csharp: ['csharp/utility/PrepareQuery.cs', 'PrepareQueryUtil(Context ctx)'],
    elixir: ['elixir/lib/projectname/utility.ex', 'def prepare_query_impl('],
    go: ['go/utility/prepare_query.go', 'func prepareQueryUtil('],
    java: ['java/utility/PrepareQuery.java', 'static Map<String, Object> prepareQuery('],
    js: ['js/src/utility/PrepareQueryUtility.js', 'function prepareQuery('],
    kotlin: ['kotlin/utility/Prepare.kt', 'fun prepareQuery('],
    lua: ['lua/utility/prepare_query.lua', 'local function prepare_query_util('],
    ocaml: ['ocaml/sdk_runtime.ml', 'let prepare_query_util'],
    perl: ['perl/utility/prepare_query.pm', '$REGISTRY{prepare_query}'],
    php: ['php/utility/PrepareQuery.php', 'public static function call('],
    py: ['py/pkg/utility/prepare_query.py', 'def prepare_query_util('],
    rb: ['rb/utility/prepare_query.rb', 'PrepareQuery = ->'],
    rust: ['rust/utility/prepare_query.rs', 'pub fn prepare_query_util('],
    scala: ['scala/utility/Prepare.scala', 'def prepareQuery('],
    swift: ['swift/Sources/ProjectNameSDK/utility/Prepare.swift', 'func prepareQueryUtil('],
    ts: ['ts/src/utility/PrepareQueryUtility.ts', 'function prepareQuery('],
    zig: ['zig/core/utility.zig', 'pub fn prepare_query_util('],
  }

  test('every target reads args.params in its prepareQuery', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      const at = src.indexOf(def)
      ok(-1 !== at, lang + ': no prepareQuery definition in ' + rel)
      if (!/\bargs\b[\s\S]{0,120}\bparams\b/.test(src.slice(at, at + 2500))) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose prepareQuery never reads args.params')
  })

  // The query name, checked the same way. Only punctuation may sit between
  // `args` and `query`, so a nearby comment cannot pass.
  test('every target keeps a header argument out of the query', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      const at = src.indexOf(def)
      ok(-1 !== at, lang + ': no prepareQuery definition in ' + rel)
      if (!/\bargs\b\W{1,12}header\b/.test(src.slice(at, at + 4000))) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose prepareQuery never reads args.header')
  })

  test('every target sends a query argument under its orig', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      // C looks the name up in a helper defined just before the function.
      const at = src.indexOf('c' === lang ? 'query_wire_name(' : def)
      ok(-1 !== at, lang + ': no prepareQuery definition in ' + rel)
      const body = src.slice(at, at + 4000)
      if (!/\bargs\b\W{1,12}(?:point\W{1,4}args\W{1,4})?query\b/.test(body) ||
        !/\borig\b/.test(body)) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose prepareQuery never maps a query argument to its orig')
  })
})


const headerStruct = {
  clone: (v: any) => JSON.parse(JSON.stringify(v)),
  getprop: (o: any, k: string) => null == o ? undefined : o[k],
  stringify: (v: any) => 'string' === typeof v ? v : JSON.stringify(v).replace(/"/g, ''),
}

function hctx(point: any, reqmatch: any, reqdata: any, headers: any = {}) {
  return {
    utility: { struct: headerStruct },
    client: { options: () => ({ headers }) },
    point, reqmatch, reqdata,
  }
}


// A header parameter goes out as a header, under the definition's name,
// lowercased so the credential the auth step sets under the same name wins.
describe('prepareHeaders', () => {

  const impls: Record<string, any> = {
    ts: loadTemplate('ts/src/utility/PrepareHeadersUtility.ts').prepareHeaders,
    js: require(Path.join(TM, 'js', 'src', 'utility', 'PrepareHeadersUtility.js')).prepareHeaders,
  }

  const point = { args: { header: [
    { name: 'idempotency_key', orig: 'Idempotency-Key', kind: 'header' },
    { name: 'x_trace', orig: 'X-Trace', kind: 'header' },
    { name: 'page_size', orig: 'Page-Size', kind: 'header' },
  ] } }

  for (const [lang, prepareHeaders] of Object.entries(impls)) {
    test(lang + ': a header argument from the match goes out under its orig', () => {
      deepStrictEqual(prepareHeaders(hctx(point, { idempotency_key: 'k1', page_size: 3 }, {},
        { 'user-agent': 'sdk' })),
      { 'user-agent': 'sdk', 'idempotency-key': 'k1', 'page-size': '3' })
    })

    test(lang + ': a header argument from the data goes out too', () => {
      deepStrictEqual(prepareHeaders(hctx(point, {}, { x_trace: 't1', name: 'n' })),
        { 'x-trace': 't1' })
    })

    test(lang + ': an absent or null header argument is not sent', () => {
      deepStrictEqual(prepareHeaders(hctx(point, { idempotency_key: null }, {})), {})
    })

    test(lang + ': a header argument replaces a default of the same name in any case', () => {
      deepStrictEqual(prepareHeaders(hctx(point, { idempotency_key: 'call' }, {},
        { 'Idempotency-Key': 'default', 'user-agent': 'sdk' })),
      { 'user-agent': 'sdk', 'idempotency-key': 'call' })
    })
  }


  const TEMPLATES: Record<string, [string, string]> = {
    c: ['c/utility/prepare_headers.c', 'voxgig_value* prepare_headers_util('],
    clojure: ['clojure/src/sdk/core.clj', '(defn u-prepare-headers'],
    cpp: ['cpp/utility/pipeline.hpp', 'inline Value prepareHeaders('],
    csharp: ['csharp/utility/PrepareHeaders.cs', 'PrepareHeadersUtil(Context ctx)'],
    elixir: ['elixir/lib/projectname/utility.ex', 'def prepare_headers_impl('],
    go: ['go/utility/prepare_headers.go', 'func prepareHeadersUtil('],
    java: ['java/utility/PrepareHeaders.java', 'static Map<String, Object> prepareHeaders('],
    js: ['js/src/utility/PrepareHeadersUtility.js', 'function prepareHeaders('],
    kotlin: ['kotlin/utility/Prepare.kt', 'fun prepareHeaders('],
    lua: ['lua/utility/prepare_headers.lua', 'local function prepare_headers_util('],
    ocaml: ['ocaml/sdk_runtime.ml', 'let prepare_headers_util'],
    perl: ['perl/utility/prepare_headers.pm', '$REGISTRY{prepare_headers}'],
    php: ['php/utility/PrepareHeaders.php', 'public static function call('],
    py: ['py/pkg/utility/prepare_headers.py', 'def prepare_headers_util('],
    rb: ['rb/utility/prepare_headers.rb', 'PrepareHeaders = ->'],
    rust: ['rust/utility/prepare_headers.rs', 'pub fn prepare_headers_util('],
    scala: ['scala/utility/Prepare.scala', 'def prepareHeaders('],
    swift: ['swift/Sources/ProjectNameSDK/utility/Prepare.swift', 'func prepareHeadersUtil('],
    ts: ['ts/src/utility/PrepareHeadersUtility.ts', 'function prepareHeaders('],
    zig: ['zig/core/utility.zig', 'pub fn prepare_headers_util('],
  }

  // Source, so it proves the shape is read, not that it runs: the header
  // list, its orig, and a lowercased name.
  test('every target sends a header argument as a header', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      const at = src.indexOf(def)
      ok(-1 !== at, lang + ': no prepareHeaders definition in ' + rel)
      const body = src.slice(at, at + 2500)
      if (!/\bargs\b\W{1,12}header\b/.test(body) || !/\borig\b/.test(body) ||
        !/lower|downcase|\blc\b/i.test(body)) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose prepareHeaders never sends a header argument')
  })

  // Source again: a default of the same name, in another case, is removed
  // before the argument is set, or both values go out for one header.
  test('every target replaces a default header whatever its case', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      const body = src.slice(src.indexOf(def), src.indexOf(def) + 2500)
      if (!/\bdelete\b|\bdel\b|delete_if|[Rr]emove|erase|unset|delprop|=\s*nil\b/.test(body)) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose prepareHeaders keeps a differently cased default')
  })
})


const urlStruct = {
  escre: (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  escurl: (v: any) => encodeURIComponent(String(v)),
  items: (o: any) => Object.entries(o ?? {}),
  join: (arr: any[], sep: string) => arr.filter((s) => 'string' === typeof s && '' !== s)
    .map((s, i, a) => (0 < i ? s.replace(/^\/+/, '') : s).replace(i < a.length - 1 ? /\/+$/ : /$^/, ''))
    .join(sep),
}

function uctx(orig: string, spec: any) {
  return {
    utility: { struct: urlStruct },
    point: { orig },
    spec: { base: 'https://api.test', prefix: '', suffix: '', params: {}, query: {}, ...spec },
    result: {},
    error: (code: string) => new Error(code),
  }
}


// PokeAPI declares every route with a trailing slash, as a Django REST server
// does, and redirects or refuses one without it.
describe('makeUrl', () => {

  const impls: Record<string, any> = {
    ts: loadTemplate('ts/src/utility/MakeUrlUtility.ts').makeUrl,
    js: require(Path.join(TM, 'js', 'src', 'utility', 'MakeUrlUtility.js')).makeUrl,
  }

  for (const [lang, makeUrl] of Object.entries(impls)) {
    test(lang + ': a trailing slash the definition declares is kept', () => {
      const url = makeUrl(uctx('/api/v2/ability/{id}/',
        { path: 'api/v2/ability/{id}', params: { id: 1 } }))
      deepStrictEqual(url, 'https://api.test/api/v2/ability/1/')
    })

    test(lang + ': a route without one gains none', () => {
      deepStrictEqual(makeUrl(uctx('/pets/{id}', { path: 'pets/{id}', params: { id: 'p1' } })),
        'https://api.test/pets/p1')
    })

    test(lang + ': a suffix wins over the slash', () => {
      deepStrictEqual(makeUrl(uctx('/pets/', { path: 'pets', suffix: '.json' })),
        'https://api.test/pets/.json')
    })
  }


  const TEMPLATES: Record<string, [string, string]> = {
    c: ['c/utility/make_url.c', 'char* make_url_util('],
    clojure: ['clojure/src/sdk/core.clj', '(defn u-make-url '],
    cpp: ['cpp/utility/pipeline.hpp', 'inline std::string makeUrl('],
    csharp: ['csharp/utility/MakeUrl.cs', 'MakeUrlUtil(Context ctx)'],
    elixir: ['elixir/lib/projectname/utility.ex', 'def make_url_impl('],
    go: ['go/utility/make_url.go', 'func makeUrlUtil('],
    java: ['java/utility/MakeUrl.java', 'static String makeUrl('],
    js: ['js/src/utility/MakeUrlUtility.js', 'function makeUrl('],
    kotlin: ['kotlin/utility/MakeSpecUrl.kt', 'fun makeUrl('],
    lua: ['lua/utility/make_url.lua', 'local function make_url_util('],
    ocaml: ['ocaml/sdk_runtime.ml', 'let make_url_util'],
    perl: ['perl/utility/make_url.pm', '$REGISTRY{make_url}'],
    php: ['php/utility/MakeUrl.php', 'public static function call('],
    py: ['py/pkg/utility/make_url.py', 'def make_url_util('],
    rb: ['rb/utility/make_url.rb', 'MakeUrl = ->'],
    rust: ['rust/utility/make_url.rs', 'pub fn make_url_util('],
    scala: ['scala/utility/Make.scala', 'def makeUrl('],
    swift: ['swift/Sources/ProjectNameSDK/utility/Make.swift', 'func makeUrlUtil('],
    ts: ['ts/src/utility/MakeUrlUtility.ts', 'function makeUrl('],
    zig: ['zig/core/utility.zig', 'pub fn make_url_util('],
  }

  // Source, so it proves the check is there, not that it runs: the point's
  // orig and a test of its last character.
  test('every target keeps a trailing slash the definition declares', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      const at = src.indexOf(def)
      ok(-1 !== at, lang + ': no makeUrl definition in ' + rel)
      const body = src.slice(at, at + 2000)
      if (!/\borig\b/.test(body) ||
        !/[Ee]nds?[-_]?[Ww]ith|[Hh]asSuffix|sub\(-1\)|ends_slash|back\(\)|\/\\z|olen - 1/.test(body)) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose makeUrl drops a trailing slash')
  })
})
