
import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

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


const IMPL: [string, any][] = [
  ['ts', loadTemplate('ts/src/utility/MakePointUtility.ts', {
    '../types': {},
    './ParamUtility': loadTemplate('ts/src/utility/ParamUtility.ts', { '../types': {} }),
    './PrepareMethodUtility': loadTemplate('ts/src/utility/PrepareMethodUtility.ts', { '../types': {} }),
  }).makePoint],
  ['js', loadTemplate('js/src/utility/MakePointUtility.js', {
    './ParamUtility': loadTemplate('js/src/utility/ParamUtility.js'),
    './PrepareMethodUtility': loadTemplate('js/src/utility/PrepareMethodUtility.js'),
  }).makePoint],
]


function makeCtx(points: any[], match: any = { id: 'x' }) {
  return {
    out: {},
    op: { name: 'load', input: 'match', points },
    options: { allow: { op: 'load' } },
    match,
    reqmatch: match,
    utility: { struct: { getprop: (o: any, k: string) => (o ? o[k] : undefined) } },
    error: (code: string, msg: string) => ({ code, message: msg }),
  }
}


describe('makePoint', () => {

  for (const [lang, makePoint] of IMPL) {

    test(lang + ': falls back to the shortest path when no select.exist matches', () => {
      const short = { parts: ['boards', '{id}'], select: { exist: ['not_a_real_key'] } }
      const long = { parts: ['notifications', '{id}', 'board'], select: { exist: ['notification_id'] } }

      const point = makePoint(makeCtx([long, short]))

      strictEqual(point, short, 'did not prefer the shortest, canonical path')
    })


    test(lang + ': the shortest path wins from any position', () => {
      const short = { parts: ['boards', '{id}'], select: { exist: ['not_a_real_key'] } }
      const long = { parts: ['notifications', '{id}', 'board'], select: { exist: ['nope'] } }
      const longer = { parts: ['cards', '{id}', 'board', 'x'], select: { exist: ['nope'] } }

      strictEqual(makePoint(makeCtx([short, long, longer])), short, 'first')
      strictEqual(makePoint(makeCtx([long, short, longer])), short, 'middle')
      strictEqual(makePoint(makeCtx([long, longer, short])), short, 'last')
    })


    test(lang + ': a point whose select.exist matches is still preferred', () => {
      const generic = { parts: ['thing', '{id}'], select: { exist: ['not_a_real_key'] } }
      const specific = { parts: ['other', '{id}', 'thing'], select: { exist: ['id'] } }

      const point = makePoint(makeCtx([generic, specific]))

      strictEqual(point, specific, 'a real select.exist match was not preferred')
    })


    test(lang + ': a single point needs no selection at all', () => {
      const only = { parts: ['thing', '{id}'], select: {} }
      const point = makePoint(makeCtx([only]))
      strictEqual(point, only)
    })


    // The $action edge the fallback introduces: a request naming an action
    // whose own point failed the exist test lands on a non-action point, and
    // is refused rather than silently sent to the wrong endpoint.
    test(lang + ': an unbuildable $action request is refused, not misrouted', () => {
      const plain = { parts: ['planet', '{id}'], select: { exist: ['not_a_real_key'] } }
      const action = {
        parts: ['planet', '{id}', 'terraform'],
        select: { exist: ['not_a_real_key'], $action: 'terraform' },
      }

      const out = makePoint(makeCtx([plain, action], { id: 'x', $action: 'terraform' }))

      strictEqual(out.code, 'point_action_invalid',
        'a $action that cannot be built must error, not fall through to a point')
    })


    // The same refusal when the action point is ALSO the one the fallback
    // would pick — a short action route folded into an entity whose own
    // route is longer. Refusing only after the fallback let this through,
    // because the chosen point's $action then matched the request's.
    test(lang + ': a short $action route is refused too, not selected by the fallback', () => {
      const nested = {
        parts: ['systems', '{system_id}', 'planets', '{id}'],
        select: { exist: ['not_a_real_key'] },
      }
      const action = {
        parts: ['terraform'],
        select: { exist: ['not_a_real_key'], $action: 'terraform' },
      }

      const out = makePoint(makeCtx([nested, action], { id: 'x', $action: 'terraform' }))

      strictEqual(out.code, 'point_action_invalid',
        'the fallback selected the unbuildable action point and waved it through')
    })


    // Depth alone picked the cross-reference whenever the entity's own route
    // was nested more deeply than the route pointing at it. A record route
    // ends in the record's id; a cross-reference ends in a relationship name.
    test(lang + ': a deeply nested own route beats a shallower cross-reference', () => {
      const own = {
        parts: ['accounts', '{account_id}', 'users', '{id}'],
        select: { exist: ['not_a_real_key'] },
      }
      const xref = { parts: ['posts', '{id}', 'author'], select: { exist: ['nope'] } }
      const match = { id: 'x', account_id: 'a' }

      strictEqual(makePoint(makeCtx([own, xref], match)), own, 'own route first')
      strictEqual(makePoint(makeCtx([xref, own], match)), own, 'own route last')
    })


    // A route whose placeholder the call cannot fill went out with a literal
    // `{id}` in it.
    test(lang + ': the fallback takes a route the call can fill', () => {
      const byid = {
        parts: ['public', 'database', '{database_id}', 'permission', '{id}'],
        select: { exist: ['api_key', 'database_id', 'id'] },
      }
      const permanent = {
        parts: ['public', 'database', '{database_id}', 'permission', 'permanent', '{msisdn}'],
        select: { exist: ['api_key', 'database_id', 'msisdn'] },
      }

      strictEqual(makePoint(makeCtx([byid, permanent], { database_id: 1, msisdn: 'm' })),
        permanent, 'chose a route with an unfilled placeholder')
      strictEqual(makePoint(makeCtx([byid, permanent], { database_id: 1, id: 'i' })), byid)
    })


    test(lang + ': a call that can fill no route is refused, naming what is missing', () => {
      const byid = {
        parts: ['public', 'database', '{database_id}', 'permission', '{id}'],
        select: { exist: ['api_key', 'database_id', 'id'] },
      }
      const permanent = {
        parts: ['public', 'database', '{database_id}', 'permission', 'permanent', '{msisdn}'],
        select: { exist: ['api_key', 'database_id', 'msisdn'] },
      }

      const out = makePoint(makeCtx([byid, permanent], { database_id: 1 }))

      strictEqual(out.code, 'point_no_match')
      strictEqual(out.message,
        'Operation "load" has no endpoint whose path parameters are all given (missing: id).')
    })


    // The entity's own data fills a path, as prepareParams fills it.
    test(lang + ': the entity\'s stored data fills a route', () => {
      const own = { parts: ['planet', '{id}'], select: { exist: ['id', 'opt'] } }
      const xref = { parts: ['system', '{system_id}', 'planet'], select: { exist: ['system_id', 'opt'] } }
      const ctx: any = makeCtx([xref, own], {})
      ctx.op.input = 'data'
      ctx.reqdata = { name: 'n' }
      ctx.data = { id: 'p1' }

      strictEqual(makePoint(ctx), own)
    })


    // At generation, an entity's API is read from its points without an
    // action; a call without one is never sent to an action's route.
    test(lang + ': a call without an action never falls back to an action route', () => {
      const own = { parts: ['planet', '{id}', 'info'], select: { exist: ['id', 'opt'] } }
      const action = { parts: ['planet', '{id}'], select: { exist: ['id', 'opt'], $action: 'touch' } }

      strictEqual(makePoint(makeCtx([action, own])), own)
    })


    // With every route an action, which one a call without $action means is
    // a guess.
    test(lang + ': a call without an action is refused when every route needs one', () => {
      const strong = { parts: ['signal', 'strong'], select: { exist: [], $action: 'strong' } }
      const weak = { parts: ['signal', 'weak'], select: { exist: [], $action: 'weak' } }

      const out = makePoint(makeCtx([strong, weak], {}))

      strictEqual(out.code, 'point_action_required')
      strictEqual(out.message,
        'Operation "load" has only action endpoints; pass $action to choose one.')
      strictEqual(makePoint(makeCtx([strong, weak], { $action: 'weak' })), weak)
    })


    test(lang + ': a lone action route is still taken without one', () => {
      const only = { parts: ['signal', 'strong'], select: { exist: [], $action: 'strong' } }
      strictEqual(makePoint(makeCtx([only], {})), only)
    })


    // param() reads a path parameter under the point's alias too, so a route
    // the alias fills is one the call can take.
    test(lang + ': a path parameter given under its alias fills a route', () => {
      const own = {
        parts: ['planet', '{id}'], alias: { id: 'planet_id' },
        select: { exist: ['id', 'opt'] },
      }
      const xref = { parts: ['system', '{system_id}', 'planet'], select: { exist: ['system_id', 'opt'] } }

      strictEqual(makePoint(makeCtx([xref, own], { planet_id: 'p1' })), own)
      strictEqual(makePoint(makeCtx([xref, own], { planet_id: 'p1', system_id: 's1' })), own)

      const data: any = makeCtx([xref, own], {})
      data.op.input = 'data'
      data.reqdata = { planet_id: 'p1' }
      data.data = {}
      strictEqual(makePoint(data), own)
    })


    test(lang + ': with no terminal id anywhere, the shallowest path wins', () => {
      const own = { parts: ['boards'], select: { exist: ['not_a_real_key'] } }
      const xref = { parts: ['members', '{id}', 'boards'], select: { exist: ['nope'] } }

      strictEqual(makePoint(makeCtx([xref, own])), own, 'did not prefer the shallowest path')
    })

  }

})


// Source, so it proves the refusal is there, not that it runs. Each entry is
// the file and the start of the function's definition.
describe('makePoint in every target', () => {

  const TEMPLATES: Record<string, [string, string]> = {
    c: ['c/utility/make_point.c', 'voxgig_value* make_point_util('],
    clojure: ['clojure/src/sdk/core.clj', '(defn u-make-point '],
    cpp: ['cpp/utility/pipeline.hpp', 'inline Value makePoint('],
    csharp: ['csharp/utility/MakePoint.cs', 'MakePointUtil(Context ctx)'],
    elixir: ['elixir/lib/projectname/utility.ex', 'def make_point_impl('],
    go: ['go/utility/make_point.go', 'func makePointUtil('],
    java: ['java/utility/MakePoint.java', 'static Map<String, Object> makePoint('],
    js: ['js/src/utility/MakePointUtility.js', 'function makePoint('],
    kotlin: ['kotlin/utility/MakePoint.kt', 'fun makePoint('],
    lua: ['lua/utility/make_point.lua', 'local function make_point_util('],
    ocaml: ['ocaml/sdk_runtime.ml', 'let make_point_util '],
    perl: ['perl/utility/make_point.pm', '$REGISTRY{make_point}'],
    php: ['php/utility/MakePoint.php', 'public static function call('],
    py: ['py/pkg/utility/make_point.py', 'def make_point_util('],
    rb: ['rb/utility/make_point.rb', 'MakePoint = ->'],
    rust: ['rust/utility/make_point.rs', 'pub fn make_point_util('],
    scala: ['scala/utility/Make.scala', 'def makePoint('],
    swift: ['swift/Sources/ProjectNameSDK/utility/Make.swift', 'func makePointUtil('],
    ts: ['ts/src/utility/MakePointUtility.ts', 'function makePoint('],
    zig: ['zig/core/utility.zig', 'pub fn make_point_util('],
  }

  test('every target refuses a fallback the call cannot fill', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      const at = src.indexOf(def)
      ok(-1 !== at, lang + ': no makePoint definition in ' + rel)
      const body = src.slice(at, at + 8000)
      if (!body.includes('point_no_match') || !body.includes('missing: ')) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets whose makePoint falls back to a route it cannot fill')
  })

  test('every target refuses a call without an action when every route needs one', () => {
    const missing: string[] = []
    for (const [lang, [rel, def]] of Object.entries(TEMPLATES)) {
      const src = readFileSync(Path.join(TM, rel), 'utf8')
      const body = src.slice(src.indexOf(def), src.indexOf(def) + 8000)
      if (!body.includes('point_action_required') ||
        !/has only action endpoints; pass \\?\$action to choose one\./.test(body)) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [], 'targets that send an action-only call to a guessed route')
  })


  // One rule, one place: the fallback asks for a path parameter exactly as
  // param() does, alias included. Each entry names, per side, the file, the
  // start of the function and the call to the shared lookup; the slice stops
  // where the lookup itself is defined.
  const LOOKUP: Record<string, { unfilled: [string, string, string], param: [string, string, string], def: string }> = {
    c: { unfilled: ['c/utility/make_point.c', 'static voxgig_value* unfilled(', 'param_value(ctx, point, '], param: ['c/utility/param.c', 'voxgig_value* param_util(', 'param_value(ctx, ctx->point, key)'], def: 'voxgig_value* param_value(Context' },
    clojure: { unfilled: ['clojure/src/sdk/core.clj', '(defn- unfilled-params ', '(param-value ctx point pname)'], param: ['clojure/src/sdk/core.clj', '(defn u-param ', '(param-value ctx point key)'], def: '(defn param-value ' },
    cpp: { unfilled: ['cpp/utility/pipeline.hpp', 'inline std::vector<std::string> unfilledParams(', 'paramValue(ctx, point, name)'], param: ['cpp/utility/pipeline.hpp', 'inline Value param(CtxPtr ctx', 'paramValue(ctx, ctx->point, key)'], def: 'inline Value paramValue(' },
    csharp: { unfilled: ['csharp/utility/MakePoint.cs', 'private static List<string> UnfilledParams(', 'ParamValue(ctx, point, '], param: ['csharp/utility/Param.cs', 'internal static object? ParamUtil(', 'ParamValue(ctx, ctx.Point, key)'], def: 'internal static object? ParamValue(' },
    elixir: { unfilled: ['elixir/lib/projectname/utility.ex', 'defp unfilled(', 'param_value(ctx, point, name)'], param: ['elixir/lib/projectname/utility.ex', 'def param_impl(', 'param_value(ctx, point, key)'], def: 'defp param_value(' },
    go: { unfilled: ['go/utility/make_point.go', 'func unfilledParams(', 'paramValue(ctx, point, found[1])'], param: ['go/utility/param.go', 'func paramUtil(', 'paramValue(ctx, ctx.Point, key)'], def: 'func paramValue(' },
    java: { unfilled: ['java/utility/MakePoint.java', 'private static List<String> unfilled(', 'Param.paramValue(ctx, point, '], param: ['java/utility/Param.java', 'static Object param(Context ctx', 'paramValue(ctx, ctx.point, key)'], def: 'static Object paramValue(' },
    js: { unfilled: ['js/src/utility/MakePointUtility.js', 'function unfilled(', 'paramValue(ctx, point, name)'], param: ['js/src/utility/ParamUtility.js', 'function param(', 'paramValue(ctx, point, key)'], def: 'function paramValue(' },
    kotlin: { unfilled: ['kotlin/utility/MakePoint.kt', 'private fun unfilledParams(', 'paramValue(ctx, point, '], param: ['kotlin/utility/Prepare.kt', 'fun param(ctx: Context', 'paramValue(ctx, ctx.point, key)'], def: 'fun paramValue(' },
    lua: { unfilled: ['lua/utility/make_point.lua', 'local function unfilled(', 'helpers.param_value(ctx, point, name)'], param: ['lua/utility/param.lua', 'local function param_util(', 'helpers.param_value(ctx, ctx.point, key)'], def: 'function helpers.param_value(' },
    ocaml: { unfilled: ['ocaml/sdk_runtime.ml', 'let unfilled_params ', 'param_value ctx point name'], param: ['ocaml/sdk_runtime.ml', 'let param_util ', 'param_value ctx ctx.c_point key'], def: 'let param_value ' },
    perl: { unfilled: ['perl/utility/make_point.pm', 'sub _unfilled {', 'param_value($ctx, $point, $name)'], param: ['perl/utility/param.pm', '$REGISTRY{param} = sub {', "param_value($ctx, $ctx->{point}, $key)"], def: 'sub param_value {' },
    php: { unfilled: ['php/utility/MakePoint.php', 'private static function unfilled(', 'ProjectNameParam::value($ctx, $point, '], param: ['php/utility/Param.php', 'public static function call(', 'self::value($ctx, $ctx->point, $key)'], def: 'public static function value(' },
    py: { unfilled: ['py/pkg/utility/make_point.py', 'def _unfilled(', 'param_value(ctx, point, '], param: ['py/pkg/utility/param.py', 'def param_util(', 'param_value(ctx, ctx.point, key)'], def: 'def param_value(' },
    rb: { unfilled: ['rb/utility/make_point.rb', 'def self.unfilled_params(', 'param_value(ctx, point, '], param: ['rb/utility/param.rb', 'Param = ->(ctx, paramdef) {', 'param_value(ctx, ctx.point, key)'], def: 'def self.param_value(' },
    rust: { unfilled: ['rust/utility/make_point.rs', 'fn unfilled(', 'param_value(ctx, point, name)'], param: ['rust/utility/param.rs', 'pub fn param_util(', 'param_value(ctx, &point, &key)'], def: 'pub fn param_value(' },
    scala: { unfilled: ['scala/utility/Make.scala', 'private def unfilled(', 'Param.value(ctx, point, name)'], param: ['scala/utility/Misc.scala', 'def param(ctx: Context', 'value(ctx, ctx.point, key)'], def: 'def value(' },
    swift: { unfilled: ['swift/Sources/ProjectNameSDK/utility/Make.swift', 'private func unfilledParams(', 'paramValue(ctx, point, name)'], param: ['swift/Sources/ProjectNameSDK/utility/Prepare.swift', 'func paramUtil(', 'paramValue(ctx, ctx.point, key)'], def: 'func paramValue(' },
    ts: { unfilled: ['ts/src/utility/MakePointUtility.ts', 'function unfilled(', 'paramValue(ctx, point, name)'], param: ['ts/src/utility/ParamUtility.ts', 'function param(', 'paramValue(ctx, point, key)'], def: 'function paramValue(' },
    zig: { unfilled: ['zig/core/utility.zig', 'fn unfilled_params(', 'param_value(ctx, point, name)'], param: ['zig/core/utility.zig', 'pub fn param_util(', 'param_value(ctx, ctx.point, key)'], def: 'pub fn param_value(' },
  }

  test('every target looks a path parameter up as param does', () => {
    deepStrictEqual(Object.keys(LOOKUP).sort(), Object.keys(TEMPLATES).sort())
    const astray: string[] = []
    for (const [lang, spec] of Object.entries(LOOKUP)) {
      for (const side of ['unfilled', 'param'] as const) {
        const [rel, start, call] = spec[side]
        const src = readFileSync(Path.join(TM, rel), 'utf8')
        const at = src.indexOf(start)
        ok(-1 !== at, lang + ': no ' + side + ' definition in ' + rel)
        let body = src.slice(at, at + 1600)
        const end = body.indexOf(spec.def, start.length)
        if (-1 !== end) body = body.slice(0, end)
        if (!body.includes(call)) astray.push(lang + ' ' + side)
      }
    }
    deepStrictEqual(astray, [], 'a path parameter looked up apart from param')
  })

  // An empty PHP array is falsy, so testing the entity's stored match for
  // truth would skip every point's exist list and take the first route.
  test('php tests each point when the entity has nothing stored', () => {
    const src = readFileSync(Path.join(TM, TEMPLATES.php[0]), 'utf8')
    ok(src.includes('if (null !== $selector && $select_def)'),
      'php decides whether to test a point by the truth of its stored match')
  })
})
