// canonSpec: apidef's field-type sentinels -> struct.validate specs.
//
// The mapping is checked against the REAL struct, not against an expected
// spec shape: what matters is that the spec a field produces accepts the
// values that field can hold and rejects the ones it cannot. Asserting the
// literal spec would pass just as well for a spec struct cannot run — which
// is exactly how the nested `$ONE` form got as far as it did.

import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual, ok } from 'node:assert'

import * as struct from '@voxgig/struct'

import {
  byExampleSpec,
  canonToSpec,
  entityDataSpec,
  entityOpSpec,
  entitySpecs,
  optionalSpec,
  sentinel,
} from '../dist/helpers/canonSpec'


// Run a spec the way the generated feature does: collecting, not throwing.
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

const S = (n: string) => sentinel(n)
const ONE = (members: any[]) => [S('ONE'), members]


describe('canonSpec: sentinel mapping', () => {

  test('the six shared scalar names map straight through', () => {
    ok(accepts({ a: 'x' }, { a: canonToSpec(S('STRING')) }))
    ok(accepts({ a: 3 }, { a: canonToSpec(S('INTEGER')) }))
    ok(accepts({ a: 3.5 }, { a: canonToSpec(S('NUMBER')) }))
    ok(accepts({ a: true }, { a: canonToSpec(S('BOOLEAN')) }))
    ok(accepts({ a: null }, { a: canonToSpec(S('NULL')) }))
    ok(accepts({ a: { z: 1 } }, { a: canonToSpec(S('ANY')) }))
  })

  test('a wrong type is rejected, so the spec is doing work', () => {
    ok(!accepts({ a: 1 }, { a: canonToSpec(S('STRING')) }))
    ok(!accepts({ a: 'x' }, { a: canonToSpec(S('INTEGER')) }))
    ok(!accepts({ a: 3.5 }, { a: canonToSpec(S('INTEGER')) }))
  })

  test('the containers are RENAMED: $ARRAY -> $LIST, $OBJECT -> $MAP', () => {
    ok(accepts({ a: [1, 2] }, { a: canonToSpec(S('ARRAY')) }))
    ok(accepts({ a: { b: 1 } }, { a: canonToSpec(S('OBJECT')) }))

    // The point of the rename: struct does not know apidef's names, so the
    // untranslated sentinel would be an unknown spec rather than a check.
    ok(!accepts({ a: { b: 1 } }, { a: canonToSpec(S('ARRAY')) }))
  })

  test('an empty string passes a $STRING field', () => {
    // struct's own `$STRING` rejects '' — right for an apikey, wrong for a
    // record whose server sends an empty label.
    ok(accepts({ a: '' }, { a: canonToSpec(S('STRING')) }))
    ok(!accepts({ a: '' }, { a: S('STRING') }), 'the bare sentinel still rejects it')
  })

  test('a union is FLATTENED into struct\'s form', () => {
    const spec = { a: canonToSpec(ONE([S('STRING'), S('INTEGER')])) }
    ok(accepts({ a: 'x' }, spec))
    ok(accepts({ a: 3 }, spec))
    ok(!accepts({ a: true }, spec))

    // apidef's own nested shape, passed to struct untranslated, reads the
    // inner list as ONE alternative and rejects both members.
    ok(!accepts({ a: 'x' }, { a: ONE([S('STRING'), S('INTEGER')]) }))
  })

  test('a nested union flattens too', () => {
    const spec = { a: canonToSpec(ONE([ONE([S('STRING'), S('NULL')]), S('INTEGER')])) }
    ok(accepts({ a: 'x' }, spec))
    ok(accepts({ a: null }, spec))
    ok(accepts({ a: 1 }, spec))
  })

  test('a NULLABLE field accepts null — the shape apidef actually emits', () => {
    // apidef writes `type: [a, b]` as ['`$ONE`', [<type>, '`$NULL`']], so
    // this is the common union, not an exotic one. `$NULL` alone does not
    // match inside a union (struct's per-alternative lookup reads a stored
    // null as "no value"), so the mapping adds `$NIL` beside it.
    const spec = { a: canonToSpec(ONE([S('NUMBER'), S('NULL')])) }
    ok(accepts({ a: null }, spec), 'null is the value a nullable field exists for')
    ok(accepts({ a: 1.5 }, spec))
    ok(!accepts({ a: 'x' }, spec), 'still typed')
  })

  test('an unknown or missing sentinel degrades to $ANY, never a throw', () => {
    for (const bad of [undefined, null, '', 'nonsense', S('WAT'), 42, [1, 2]]) {
      ok(accepts({ a: 'anything' }, { a: canonToSpec(bad) }), 'accepts: ' + String(bad))
      ok(accepts({}, { a: canonToSpec(bad) }), 'absent ok: ' + String(bad))
    }
  })
})


describe('canonSpec: optionality', () => {

  test('a required field must be present', () => {
    ok(!accepts({}, { a: canonToSpec(S('STRING')) }))
  })

  test('an optional field may be absent, present, or null', () => {
    const spec = { a: canonToSpec(S('STRING'), true) }
    ok(accepts({}, spec))
    ok(accepts({ a: 'x' }, spec))
    ok(accepts({ a: null }, spec))
    ok(!accepts({ a: 7 }, spec), 'still typed when supplied')
  })

  test('optionalSpec does not nest a union inside a union', () => {
    // A union nested in a union is read as one alternative, so the members
    // stop matching. The flattening is what keeps this true.
    const spec = { a: optionalSpec(canonToSpec(ONE([S('STRING'), S('INTEGER')]))) }
    ok(accepts({}, spec))
    ok(accepts({ a: 'x' }, spec))
    ok(accepts({ a: 2 }, spec))
  })

  test('$ANY is not widened — it already admits an absent value', () => {
    strictEqual(optionalSpec(S('ANY')), S('ANY'))
  })
})


describe('canonSpec: by-example defaults', () => {

  test('a default is read for its KIND, not its exact type', () => {
    // The defect this exists for: cost declares `unit: 0` and documents
    // 0.002, so reading the default as "integer" made the feature reject
    // its own documented value.
    ok(accepts({ a: 0.002 }, { a: byExampleSpec(0) }))
    ok(accepts({ a: 5 }, { a: byExampleSpec(0) }))
    ok(!accepts({ a: 'x' }, { a: byExampleSpec(0) }))
  })

  test('an empty-string default does not forbid the empty string', () => {
    ok(accepts({ a: '' }, { a: byExampleSpec('') }))
    ok(accepts({ a: 'set' }, { a: byExampleSpec('') }))
  })

  test('lists, maps and booleans keep their kind', () => {
    ok(accepts({ a: ['POST'] }, { a: byExampleSpec(['GET']) }))
    ok(accepts({ a: { x: 1 } }, { a: byExampleSpec({}) }))
    ok(accepts({ a: true }, { a: byExampleSpec(false) }))
    ok(!accepts({ a: 'GET' }, { a: byExampleSpec(['GET']) }))
  })

  test('null and a function default admit anything', () => {
    ok(accepts({ a: 'x' }, { a: byExampleSpec(null) }))
    ok(accepts({ a: 1 }, { a: byExampleSpec(() => 1) }))
  })
})


// A small entity in the shape apidef produces: canon sentinels on `type`,
// a `req` flag, `op` with points carrying params.
const ENT = {
  name: 'widget',
  fields: {
    id: { name: 'id', type: S('STRING'), req: true },
    size: { name: 'size', type: S('INTEGER'), req: false },
    label: { name: 'label', type: S('STRING'), req: false },
    retired: { name: 'retired', type: S('BOOLEAN'), req: false, active: false },
  },
  op: {
    create: { name: 'create' },
    load: { name: 'load' },
  },
}


describe('canonSpec: entity specs', () => {

  test('a record spec types the declared fields', () => {
    const spec = entityDataSpec(ENT)
    ok(accepts({ id: 'w1', size: 2, label: 'a' }, spec))
    ok(!accepts({ id: 'w1', size: 'two' }, spec), 'size is an integer')
    ok(!accepts({ size: 2 }, spec), 'id is required')
  })

  test('an optional field may be omitted', () => {
    ok(accepts({ id: 'w1' }, entityDataSpec(ENT)))
  })

  test('a record spec is OPEN: an undeclared key passes', () => {
    // A server that adds a field is not breaking its clients, and the model
    // is a snapshot of what the spec declared, not a closed-world promise.
    ok(accepts({ id: 'w1', brandNew: 'from the server' }, entityDataSpec(ENT)))
  })

  test('an inactive field is left out of the spec', () => {
    const spec: any = entityDataSpec(ENT)
    strictEqual(spec.retired, undefined)
  })

  test('an op spec follows opRequestShape, not the raw field list', () => {
    // create: required iff `req`, so `id` is required and the rest are not.
    const create = entityOpSpec(ENT, 'create')
    ok(null != create)
    ok(accepts({ id: 'w1' }, create))
    ok(!accepts({ label: 'a' }, create), 'a required field is still required')
  })

  test('an op the entity does not declare yields no spec', () => {
    strictEqual(entityOpSpec(ENT, 'remove'), null)
  })

  test('entitySpecs bundles the record and one spec per declared op', () => {
    const specs = entitySpecs(ENT)
    deepStrictEqual(Object.keys(specs).sort(), ['data', 'op'])
    deepStrictEqual(Object.keys(specs.op).sort(), ['create', 'load'])
  })

  test('an entity with nothing declared validates everything', () => {
    const specs = entitySpecs({ name: 'empty' })
    ok(accepts({ anything: 1 }, specs.data))
    deepStrictEqual(specs.op, {})
  })
})
