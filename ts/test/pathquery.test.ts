
import { test, describe } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


// A ts template, with its sibling imports loaded from the templates beside it.
function loadTemplate(rel: string): any {
  const file = Path.join(TM, rel)
  const js = transform(readFileSync(file, 'utf8'), {
    transforms: ['typescript', 'imports'],
    filePath: file,
  }).code

  const req = (p: string) => '../types' === p ? {} : p.startsWith('.') ?
    loadTemplate(Path.relative(TM, Path.resolve(Path.dirname(file), p)) + '.ts') : require(p)

  const mod: any = { exports: {} }
  const fn = new Function('exports', 'require', 'module', '__dirname', '__filename', js)
  fn(mod.exports, req, mod, Path.dirname(file), file)
  return mod.exports
}


const struct = {
  items: (o: any) => Object.entries(o ?? {}),
  getprop: (o: any, k: string) => null == o ? undefined : o[k],
}


// A call of the shared argument helper for one location, in any target's
// spelling: callArgs(ctx, 'query'), call_args($ctx, 'query'), (call-args ctx
// "query"), call_args ctx "query".
function callsArgs(kind: string): RegExp {
  return new RegExp('call[_-]?args\\W{1,4}(?:\\$?\\w+\\W{1,4})?' + kind + '\\b', 'i')
}

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

    test(lang + ': a cookie argument stays out of the query', () => {
      const point = { args: {
        cookie: [{ name: 'session_id', orig: 'SESSIONID', kind: 'cookie' }],
        query: [{ name: 'limit', orig: 'limit', kind: 'query' }],
      } }
      deepStrictEqual(prepareQuery(ctx(point, { session_id: 's1', limit: 2 })), { limit: 2 })
    })

    // A parameter is unique by name AND location, so a query parameter may
    // share its name with a header or cookie: then the value goes to both.
    test(lang + ': a query argument that shares a header or cookie name still goes out', () => {
      const point = { args: {
        header: [{ name: 'trace', orig: 'X-Trace', kind: 'header' }],
        cookie: [{ name: 'lang', orig: 'lang', kind: 'cookie' }],
        query: [{ name: 'lang', orig: 'lang', kind: 'query' }, { name: 'trace', orig: 'trace', kind: 'query' }],
      } }
      deepStrictEqual(prepareQuery(ctx(point, { lang: 'en', trace: 't1' })), { lang: 'en', trace: 't1' })
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

  test('every target keeps a cookie argument out of the query', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      const at = src.indexOf(def)
      ok(-1 !== at, lang + ': no prepareQuery definition in ' + rel)
      if (!/\bargs\b\W{1,12}cookie\b/.test(src.slice(at, at + 4500))) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose prepareQuery never reads args.cookie')
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

  // A create or update has no match, so its query arguments were left in the
  // body.
  test('every target takes the declared query arguments from the call', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      const at = src.indexOf(def)
      ok(-1 !== at, lang + ': no prepareQuery definition in ' + rel)
      if (!callsArgs('query').test(src.slice(at, at + 4000))) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose prepareQuery reads only the match')
  })
})


const headerStruct = {
  clone: (v: any) => JSON.parse(JSON.stringify(v)),
  getprop: (o: any, k: string) => null == o ? undefined : o[k],
  stringify: (v: any) => 'string' === typeof v ? v : JSON.stringify(v).replace(/"/g, ''),
  escurl: (s: string) => encodeURIComponent(s),
  islist: (v: any) => Array.isArray(v),
  ismap: (v: any) => null != v && 'object' === typeof v && !Array.isArray(v),
  keysof: (v: any) => Object.keys(v).sort(),
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

    // A cookie argument travels in the cookie header as name=value, after the
    // cookies the caller's headers already send.
    const cookiePoint = { args: {
      header: [{ name: 'x_trace', orig: 'X-Trace', kind: 'header' }],
      cookie: [
        { name: 'session_id', orig: 'SESSIONID', kind: 'cookie' },
        { name: 'theme', orig: 'theme', kind: 'cookie' },
        { name: 'prefs', orig: 'prefs', kind: 'cookie' },
      ],
    } }

    test(lang + ': a cookie argument goes out in the cookie header as name=value', () => {
      deepStrictEqual(prepareHeaders(hctx(cookiePoint, { session_id: 's1' }, { theme: 'dark', name: 'n' })),
        { cookie: 'SESSIONID=s1; theme=dark' })
    })

    test(lang + ': a cookie argument follows the cookies the caller sends, whatever the header case', () => {
      deepStrictEqual(prepareHeaders(hctx(cookiePoint, { session_id: 's1' }, {},
        { Cookie: 'lang=en', 'user-agent': 'sdk' })),
      { 'user-agent': 'sdk', cookie: 'lang=en; SESSIONID=s1' })
    })

    test(lang + ': an absent or null cookie argument leaves the headers alone', () => {
      deepStrictEqual(prepareHeaders(hctx(cookiePoint, { session_id: null }, {}, { Cookie: 'lang=en' })),
        { Cookie: 'lang=en' })
    })

    // The form style: a value is percent-encoded, so a space, a comma or a
    // semicolon in it cannot split or end the cookie; a list repeats the name
    // and a map sends its own keys.
    test(lang + ': a cookie argument is form serialized and percent-encoded', () => {
      deepStrictEqual(prepareHeaders(hctx(cookiePoint, { session_id: 'a b;c,d' },
        { theme: ['dark', 'x y'], prefs: { size: 2, lang: 'en gb' } })),
      { cookie: 'SESSIONID=a%20b%3Bc%2Cd; theme=dark&theme=x%20y; lang=en%20gb&size=2' })
    })

    test(lang + ': a cookie argument replaces a cookie of the same name the caller sends', () => {
      deepStrictEqual(prepareHeaders(hctx(cookiePoint, { session_id: 's1' }, {},
        { Cookie: 'SESSIONID=old; theme=dark ;lang=en' })),
      { cookie: 'theme=dark; lang=en; SESSIONID=s1' })
    })

    // A map argument sends its own keys, so those are the names it replaces.
    test(lang + ': a map cookie argument replaces the cookies its keys name', () => {
      deepStrictEqual(prepareHeaders(hctx(cookiePoint, { session_id: 's1' },
        { prefs: { lang: 'en', size: 2 } }, { Cookie: 'lang=old; theme=dark' })),
      { cookie: 'theme=dark; SESSIONID=s1; lang=en&size=2' })
    })

    // ...and sends them percent-encoded, so that is the form it replaces.
    test(lang + ': a map cookie argument replaces a default under its encoded key', () => {
      deepStrictEqual(prepareHeaders(hctx(cookiePoint, { session_id: 's1' },
        { prefs: { 'x y': 'new' } }, { Cookie: 'x%20y=old; theme=dark' })),
      { cookie: 'theme=dark; SESSIONID=s1; x%20y=new' })
    })

    // A default written in the same form style, `&`-joined, is replaced pair by pair.
    test(lang + ': a map cookie argument replaces a default inside an &-joined cookie', () => {
      deepStrictEqual(prepareHeaders(hctx(cookiePoint, { session_id: 's1' },
        { prefs: { 'x y': 'new' } }, { Cookie: 'lang=old&x%20y=old; theme=dark' })),
      { cookie: 'lang=old; theme=dark; SESSIONID=s1; x%20y=new' })
    })

    // A value that merely holds & is one cookie: kept as it is, or replaced whole.
    test(lang + ': an opaque default cookie value keeps its ampersands', () => {
      deepStrictEqual(prepareHeaders(hctx(cookiePoint, { session_id: 's1' }, {},
        { Cookie: 'other=a&&b; theme=dark' })),
      { cookie: 'other=a&&b; theme=dark; SESSIONID=s1' })
    })

    test(lang + ': a default cookie whose value has ampersands is replaced whole', () => {
      deepStrictEqual(prepareHeaders(hctx(cookiePoint, { session_id: 's1' }, {},
        { Cookie: 'SESSIONID=a&&b; theme=dark' })),
      { cookie: 'theme=dark; SESSIONID=s1' })
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
  // list and its orig, read here or through the shared argument helper, and a
  // lowercased name.
  test('every target sends a header argument as a header', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      const at = src.indexOf(def)
      ok(-1 !== at, lang + ': no prepareHeaders definition in ' + rel)
      const body = src.slice(at, at + 2500)
      const reads = callsArgs('header').test(body) ||
        (/\bargs\b\W{1,12}header\b/.test(body) && /\borig\b/.test(body))
      if (!reads || !/lower|downcase|\blc\b/i.test(body)) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose prepareHeaders never sends a header argument')
  })

  // Source again: the cookie list is read, each argument goes through the
  // pairing helper, which percent-encodes, and the pairs are joined into the
  // cookie header with the separator the cookie syntax uses.
  test('every target sends a cookie argument in the cookie header', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      const at = src.indexOf(def)
      const body = src.slice(at, at + 6000)
      const reads = callsArgs('cookie').test(body) || /\bargs\b\W{1,12}cookie\b/.test(body)
      const encodes = src.split(/cookie[_-]?pair/i).slice(1)
        .some((after) => /esc_?url/i.test(after.slice(0, 1500)))
      if (!reads || !/cookie[_-]?pair/i.test(body) || !encodes ||
        !/["']cookie["']/.test(body) || !/["']; ["']/.test(body)) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose prepareHeaders never sends a cookie argument')
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

    test(lang + ': the query follows the path, each name and value escaped', () => {
      const c = uctx('/pets/{id}', { path: 'pets/{id}', params: { id: 'p 1' },
        query: { limit: 2, 'a b': 'x&y', skip: null } })
      deepStrictEqual(makeUrl(c), 'https://api.test/pets/p%201?limit=2&a%20b=x%26y')
      deepStrictEqual(c.result, { resmatch: { id: 'p 1', limit: 2, 'a b': 'x&y' } })
    })

    test(lang + ': a declared trailing slash comes before the query', () => {
      deepStrictEqual(makeUrl(uctx('/ability/', { path: 'ability', query: { limit: 5 } })),
        'https://api.test/ability/?limit=5')
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

  // One fleet SDK sent DELETE /permission/{id} for a call that never named an
  // id, and raised nothing.
  test('every target refuses a URL with a placeholder left in it', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      const at = src.indexOf(def)
      ok(-1 !== at, lang + ': no makeUrl definition in ' + rel)
      if (!src.slice(at, at + 3500).includes('url_param_missing')) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose makeUrl sends an unfilled placeholder')
  })

  // A server variable the options leave in the base is not a path parameter,
  // so the scan reads the route after the base, trimmed of trailing slashes.
  test('every target scans only the route after the base', () => {
    const TRIM = /\/\+\$|\/\+\\z|rstrip|rtrim|TrimRight|TrimEnd|trimEnd|trim_end_matches|trim_trailing|pop_back|removeLast|blen--|blen -= 1|ends_slash/
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      const body = src.slice(src.indexOf(def), src.indexOf(def) + 3500)
      const from = body.indexOf('left in the route')
      const guard = -1 === from ? '' : body.slice(from, body.indexOf('url_param_missing', from))
      if (!/base/i.test(guard) || !TRIM.test(guard)) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose guard reads the base as part of the route')
  })

  // Source again: the spec's query, and the separator that starts it.
  test('every target appends the query', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      const at = src.indexOf(def)
      ok(-1 !== at, lang + ': no makeUrl definition in ' + rel)
      const body = src.slice(at, at + 4000)
      if (!/query/i.test(body) || !/["']\?["']/.test(body)) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose makeUrl drops the query')
  })
})


// The rule every target's prepareQuery, prepareHeaders and transformRequest
// share: a query or header argument comes from the call itself.
describe('callArgs', () => {

  const HELPERS: Record<string, [string, string]> = {
    c: ['c/utility/param.c', 'voxgig_value* call_args('],
    clojure: ['clojure/src/sdk/core.clj', '(defn- call-args '],
    cpp: ['cpp/utility/pipeline.hpp', 'inline std::vector<CallArg> callArgs('],
    csharp: ['csharp/utility/Param.cs', 'CallArgs(Context ctx, string kind)'],
    elixir: ['elixir/lib/projectname/utility.ex', 'defp call_args('],
    go: ['go/utility/param.go', 'func callArgs('],
    java: ['java/utility/Param.java', 'static List<CallArg> callArgs('],
    js: ['js/src/utility/ParamUtility.js', 'function callArgs('],
    kotlin: ['kotlin/utility/Prepare.kt', 'internal fun callArgs('],
    lua: ['lua/core/helpers.lua', 'function helpers.call_args('],
    ocaml: ['ocaml/sdk_runtime.ml', 'let call_args '],
    perl: ['perl/utility/param.pm', 'sub call_args'],
    php: ['php/utility/Param.php', 'public static function callArgs('],
    py: ['py/pkg/utility/param.py', 'def call_args('],
    rb: ['rb/utility/param.rb', 'def self.call_args('],
    rust: ['rust/utility/param.rs', 'pub fn call_args('],
    scala: ['scala/utility/Misc.scala', 'def callArgs('],
    swift: ['swift/Sources/ProjectNameSDK/utility/Prepare.swift', 'func callArgs('],
    ts: ['ts/src/utility/ParamUtility.ts', 'function callArgs('],
    zig: ['zig/core/utility.zig', 'fn call_args('],
  }

  // A read of the entity's stored match or data, in each target's spelling.
  const STORED = new RegExp('ctx(?:\\?\\.|\\.|->)\\{?(?:c_)?(?:match|data|Match|Data|mtch|matchData)\\b' +
    '|getprop\\(ctx, "(?:match|data)"\\)|oget ctx :(?:match|data)\\b')

  function helperBody(rel: string, def: string): string {
    const src = readFileSync(Path.join(TM, rel), 'utf8')
    const at = src.indexOf(def)
    ok(-1 !== at, 'no argument helper definition in ' + rel)
    return src.slice(at, at + 1200)
  }

  test('every target reads a declared argument, its orig, and the call', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(HELPERS)) {
      const body = helperBody(rel, def)
      if (!/\bargs\b/.test(body) || !/\borig\b/.test(body) ||
        !/reqmatch/i.test(body) || !/reqdata/i.test(body)) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose argument helper misses part of the rule')
  })

  // An idempotency key or a query flag stored on the entity would be replayed
  // on its next call.
  test('no target takes one from the entity\'s stored match or data', () => {
    const readers: string[] = []
    for (const [lang, [rel, def]] of Object.entries(HELPERS)) {
      if (STORED.test(helperBody(rel, def))) {
        readers.push(lang)
      }
    }
    deepStrictEqual(readers, [], 'targets whose argument helper reads the entity')
  })
})
