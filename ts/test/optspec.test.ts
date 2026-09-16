// The client option spec, assembled from the model.
//
// Checked by RUNNING it: a spec is only worth having if it accepts the
// options a caller legitimately passes and rejects the ones it should. The
// shipped model is the subject wherever possible, so a schema edit that
// breaks a documented option fails here rather than in a generated SDK.

import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual, ok } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { Aontu } from 'aontu'
import * as struct from '@voxgig/struct'

import { optionSpec, featureOptionSpec, entitySpecMap } from '../dist/helpers/optspec'
import { sentinel } from '../dist/helpers/canonSpec'


const MODEL = Path.resolve(__dirname, '..', 'model', 'sdkgen.aon')


// The shipped schema, unified the way a project's model unifies it.
let _base: any = null
function baseModel(): any {
  if (null == _base) {
    const src = readFileSync(MODEL, 'utf8')
    const errs: any[] = []
    _base = new Aontu().generate(src, { path: MODEL, errs })
    strictEqual(errs.length, 0, 'model errors: ' + errs.map((e: any) => e.msg).join(' | '))
  }
  return _base
}


function check(data: any, spec: any): string[] {
  const errs: string[] = []
  try {
    struct.validate(data, spec, { errs })
  }
  catch (e: any) {
    errs.push(e && e.message ? e.message : String(e))
  }
  return errs
}

function accepts(data: any, spec: any): boolean {
  return 0 === check(data, spec).length
}


// A model shaped like a project's: the shipped schema plus a feature map.
function modelWith(feature: Record<string, any>): any {
  const base = baseModel()
  return {
    main: {
      kit: {
        optspec: base.main.kit.optspec,
        feature,
      },
    },
  }
}


describe('optionSpec: the standard options', () => {

  test('the shipped schema round-trips the options it documents', () => {
    const spec = optionSpec(modelWith({}))

    ok(accepts({ apikey: 'k', base: 'https://api.example.com' }, spec))
    ok(accepts({ headers: { 'X-Trace': 'abc' } }, spec))
    ok(accepts({ allow: { method: 'GET' } }, spec))
    ok(accepts({ server: { tenant_id: 'acme' } }, spec))
    ok(accepts({ clean: { keys: 'token' } }, spec))
  })

  test('`test` survives the model read', () => {
    // getModelPath filters `active: false` children by default, and a SPEC is
    // full of them — `test: { active: false }` is a default, not a switch.
    // Filtered out, validate rejected `{ test: { active: true } }` outright.
    const spec = optionSpec(modelWith({}))
    ok(accepts({ test: { active: true } }, spec))
    ok(accepts({ test: { active: true, entity: { widget: { x: 1 } } } }, spec))
  })

  test('a wrong type is rejected', () => {
    const spec = optionSpec(modelWith({}))
    ok(!accepts({ base: 42 }, spec))
    ok(!accepts({ allow: { method: [] } }, spec))
  })

  test('`extend` passes class instances through', () => {
    // The station adopt seam: feature INSTANCES, not data. Without an entry
    // validate dropped the key and the constructor silently adopted nothing.
    class AFeature { name = 'a' }
    const spec = optionSpec(modelWith({}))
    const out: any = struct.validate({ extend: [new AFeature()] }, spec, { errs: [] })
    ok(Array.isArray(out.extend) && out.extend[0] instanceof AFeature)
  })

  test('a caller-supplied fetch survives validation', () => {
    const fetch = async () => ({ status: 200 })
    const spec = optionSpec(modelWith({}))
    const out: any = struct.validate({ system: { fetch } }, spec, { errs: [] })
    strictEqual(out.system.fetch, fetch)
  })
})


const FEATURES = {
  cache: {
    name: 'cache',
    active: true,
    config: { options: { active: false, ttl: 5000, max: 256, methods: ['GET'] } },
  },
  cost: {
    name: 'cost',
    active: true,
    config: {
      options: { active: false, unit: 0, currency: 'USD', header: '', rates: {} },
      optspec: { sink: sentinel('FUNCTION') },
    },
  },
  gone: {
    name: 'gone',
    active: false,
    config: { options: { active: false } },
  },
}


describe('optionSpec: the feature half', () => {

  test('a declared feature option is type-checked', () => {
    const spec = optionSpec(modelWith(FEATURES))
    ok(accepts({ feature: { cache: { active: true, ttl: 100 } } }, spec))
    ok(!accepts({ feature: { cache: { active: true, ttl: 'soon' } } }, spec),
      'the whole point: a mistyped feature option used to be silently ignored')
  })

  test('a caller names only the options they want to change', () => {
    // Feature defaults are applied by the feature's own code, so every
    // option is optional here — naming two of nine must not require the
    // other seven.
    const spec = optionSpec(modelWith(FEATURES))
    ok(accepts({ feature: { cost: { active: true, unit: 0.002 } } }, spec))
    ok(accepts({ feature: { cache: {} } }, spec))
  })

  test('a numeric default does not forbid a fractional value', () => {
    // cost declares `unit: 0` and documents 0.002.
    const spec = optionSpec(modelWith(FEATURES))
    ok(accepts({ feature: { cost: { unit: 0.002 } } }, spec))
  })

  test('an option with no default is typed through config.optspec', () => {
    const spec = optionSpec(modelWith(FEATURES))
    ok(accepts({ feature: { cost: { sink: () => undefined } } }, spec))
    ok(!accepts({ feature: { cost: { sink: 'not a function' } } }, spec))
  })

  test('a feature is optional, and an absent one stays absent', () => {
    const spec = optionSpec(modelWith(FEATURES))
    const out: any = struct.validate({}, spec, { errs: [] })
    deepStrictEqual(out.feature, {}, 'no sentinel key leaks into the options')
  })

  test('an inactive feature contributes no entry', () => {
    const spec: any = optionSpec(modelWith(FEATURES))
    strictEqual(spec.feature.gone, undefined)
  })

  test('a feature the model never declared still passes', () => {
    // The `extend` path adopts feature instances the model does not know.
    const spec = optionSpec(modelWith(FEATURES))
    ok(accepts({ feature: { adopted: { active: true, whatever: 1 } } }, spec))
    ok(!accepts({ feature: { adopted: { active: 'yes' } } }, spec),
      'the generic entry still types `active`')
  })
})


describe('featureOptionSpec', () => {

  test('every feature gets `active`, declared or not', () => {
    const spec: any = featureOptionSpec({ name: 'bare' })
    ok(null != spec.active)
    ok(accepts({ active: true }, spec))
  })

  test('open by default, closed by config.strict', () => {
    const open = featureOptionSpec(FEATURES.cache)
    ok(accepts({ active: true, undeclared: 1 }, open))

    const strict = featureOptionSpec({
      name: 'cache',
      config: { strict: true, options: { active: false, ttl: 5000 } },
    })
    ok(!accepts({ active: true, undeclared: 1 }, strict))
    ok(accepts({ active: true, ttl: 1 }, strict))
  })

  test('a type-only declaration wins over a default of the same name', () => {
    const spec: any = featureOptionSpec({
      name: 'x',
      config: { options: { limit: 5 }, optspec: { limit: sentinel('STRING') } },
    })
    ok(accepts({ limit: 'many' }, spec))
    ok(!accepts({ limit: 5 }, spec))
  })
})


describe('entitySpecMap: gated on the feature', () => {

  const ENTITY = {
    widget: {
      name: 'widget',
      fields: { id: { name: 'id', type: sentinel('STRING'), req: true } },
      op: { load: { name: 'load' } },
    },
  }

  function modelWithEntity(validateActive: boolean | null): any {
    const feature: any = {}
    if (null != validateActive) {
      feature.validate = {
        name: 'validate',
        active: validateActive,
        config: { options: { active: false } },
      }
    }
    return {
      main: { kit: { optspec: baseModel().main.kit.optspec, feature, entity: ENTITY } },
    }
  }

  test('no validate feature, no specs — and null, not an empty map', () => {
    // The distinction matters: the component emits `{}` either way, but a
    // null says "this target asked for none" rather than "this model has no
    // entities", which is what keeps unrelated projects byte-identical.
    strictEqual(entitySpecMap(modelWithEntity(null)), null)
  })

  test('an inactive validate feature still yields no specs', () => {
    strictEqual(entitySpecMap(modelWithEntity(false)), null)
  })

  test('with the feature active, every entity gets a record and op spec', () => {
    const specs: any = entitySpecMap(modelWithEntity(true))
    ok(null != specs)
    deepStrictEqual(Object.keys(specs), ['widget'])
    deepStrictEqual(Object.keys(specs.widget).sort(), ['data', 'op'])
    deepStrictEqual(Object.keys(specs.widget.op), ['load'])

    ok(accepts({ id: 'w1' }, specs.widget.data))
    ok(!accepts({ id: 7 }, specs.widget.data))
  })
})


// THE JSON ROUND-TRIP CONTRACT.
//
// Every target except ts and js carries the spec into the SDK as an embedded
// JSON STRING that its own runtime parses — the same mechanism each
// Config_<lang> already uses — because JSON is not a subset of most of these
// languages' literal syntax. That is only lossless while the spec holds
// nothing JSON cannot carry exactly.
//
// NUMBERS ARE THE HAZARD, and the reason this is pinned rather than assumed.
// JSON has one number type: go's json.Unmarshal hands back float64 for every
// one, java's parser a Double, and struct reads a spec by EXAMPLE — so a
// `5000` that survives as an integer in the ts literal and arrives as
// 5000.0 elsewhere is the same spec meaning two different things in two
// targets. The assembled spec has no numbers today (feature defaults are
// widened to sentinels by byExampleSpec, and main.kit.optspec declares
// none), and this keeps it that way.
//
// If this test fails, a number reached the spec. Either widen it to a
// sentinel, or teach every target's Schema emitter to normalise numbers the
// way Config_go's configNormalise already has to.
describe('optionSpec: what the spec may contain', () => {

  function scalars(node: any, path: string, out: Array<{ path: string, value: any }>) {
    if (Array.isArray(node)) {
      node.forEach((n, i) => scalars(n, path + '[' + i + ']', out))
      return
    }
    if (null != node && 'object' === typeof node) {
      for (const [k, v] of Object.entries(node)) {
        scalars(v, path + '.' + k, out)
      }
      return
    }
    out.push({ path, value: node })
  }

  test('strings and booleans only, so the JSON round-trip is lossless', () => {
    const spec = optionSpec(modelWith(shippedFeatures()))

    const found: Array<{ path: string, value: any }> = []
    scalars(spec, '', found)

    const bad = found.filter((f) =>
      'string' !== typeof f.value && 'boolean' !== typeof f.value)

    deepStrictEqual(bad, [],
      'the option spec must hold only strings and booleans — a number here ' +
      'is a spec that means one thing in ts and another wherever it is ' +
      'parsed from JSON (see the note above this test)')

    ok(0 < found.length, 'the walk found nothing, so it proved nothing')
  })

  test('and it survives a JSON round-trip unchanged', () => {
    // The property the targets actually depend on, asserted directly rather
    // than inferred from the types above.
    const spec = optionSpec(modelWith(shippedFeatures()))
    deepStrictEqual(JSON.parse(JSON.stringify(spec)), spec)
  })


  function shippedFeatures(): Record<string, any> {
    const dir = Path.resolve(__dirname, '..', 'project', '.sdk', 'model', 'feature')
    const index = Path.join(dir, 'feature-index.aon')
    const errs: any[] = []
    const fmodel: any = new Aontu().generate(readFileSync(index, 'utf8'),
      { path: index, errs })
    strictEqual(errs.length, 0)
    return fmodel.main.kit.feature
  }
})


describe('optionSpec: the shipped feature set', () => {

  // A feature's own declared default must pass its own spec. The kind of
  // failure this catches is embarrassing rather than subtle: cost declares
  // `unit: 0` and prices in fractions, so reading the default as its exact
  // type made the feature reject its own documented usage.
  function shippedFeatures(): Record<string, any> {
    const dir = Path.resolve(__dirname, '..', 'project', '.sdk', 'model', 'feature')
    const index = Path.join(dir, 'feature-index.aon')
    const errs: any[] = []
    const fmodel: any = new Aontu().generate(readFileSync(index, 'utf8'),
      { path: index, errs })
    strictEqual(errs.length, 0)
    return fmodel.main.kit.feature
  }


  test('every shipped feature accepts its own declared defaults', () => {
    const fmodel = shippedFeatures()
    const spec = optionSpec(modelWith(fmodel))

    for (const [name, f] of Object.entries<any>(fmodel)) {
      const opts = { ...((f.config && f.config.options) || {}), active: true }
      const data = { feature: { [name]: opts } }
      ok(accepts(data, spec), name + ': ' + check(data, spec).join('; '))
    }
  })

  test("validate's mode is closed to the two values it implements", () => {
    // Read by example, `mode: 'throw'` is only "a string", and the runtime
    // treats anything that is not 'report' as throw — so `mode: 'repot'`
    // would keep enforcement on while its author believed otherwise.
    const spec = optionSpec(modelWith(shippedFeatures()))
    ok(accepts({ feature: { validate: { active: true, mode: 'throw' } } }, spec))
    ok(accepts({ feature: { validate: { active: true, mode: 'report' } } }, spec))
    ok(!accepts({ feature: { validate: { active: true, mode: 'repot' } } }, spec))
  })

  test('every shipped feature accepts a bare activation', () => {
    // The smallest thing a caller ever writes. A spec that rejects it is a
    // spec that breaks every project the moment it lands.
    const fmodel = shippedFeatures()
    const spec = optionSpec(modelWith(fmodel))

    for (const name of Object.keys(fmodel)) {
      ok(accepts({ feature: { [name]: { active: true } } }, spec),
        name + ': ' + check({ feature: { [name]: { active: true } } }, spec).join('; '))
    }
  })
})
