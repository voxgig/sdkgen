
import { each } from 'jostraca'

import { canonKey } from './canonType'
import { opRequestShape } from './opShape'


// Backtick-wrapped, the way the model and struct both write an injection.
// Built rather than written literally so the backticks cannot be lost to an
// editor, a copy-paste, or a template literal.
const BT = String.fromCharCode(96)

function sentinel(name: string): string {
  return BT + '$' + name + BT
}


const S_NOF = sentinel('NOF')
const S_ONE = sentinel('ONE')
const S_EXACT = sentinel('EXACT')
const S_NIL = sentinel('NIL')
const S_ANY = sentinel('ANY')
const S_STRING = sentinel('STRING')
const S_NULL = sentinel('NULL')
const S_OPEN = sentinel('OPEN')


const CANON_STRUCT: Record<string, string> = {
  INTEGER: sentinel('INTEGER'),
  NUMBER: sentinel('NUMBER'),
  BOOLEAN: sentinel('BOOLEAN'),
  NULL: sentinel('NULL'),

  ARRAY: sentinel('LIST'),
  OBJECT: sentinel('MAP'),

  ANY: S_ANY,
}


// A union: with this count, `$NOF` admits a value when at least one of the
// alternatives does.
function anyOf(alts: any[]): any[] {
  return [S_NOF, { min: 1 }, ...alts]
}


function isAnyOf(spec: any): boolean {
  if (!Array.isArray(spec) || S_NOF !== spec[0]) {
    return false
  }
  const count = spec[1]
  return null != count && 'object' === typeof count && !Array.isArray(count) &&
    1 === Object.keys(count).length && 1 === count.min
}


const SPEC_STRING: any[] = anyOf([S_STRING, [S_EXACT, '']])


// Flatten a spec into the alternatives of a union, so that widening a value
// that is ALREADY a union does not nest one union inside another. Any other
// count is a constraint of its own, and stays one alternative.
function alternatives(spec: any): any[] {
  return isAnyOf(spec) ? spec.slice(2) : [spec]
}


function optionalSpec(spec: any): any {
  if (S_ANY === spec) {
    return spec
  }

  return anyOf([...alternatives(spec), S_NIL])
}


function specPath(path: string, step: string | number): string {
  return '' === path ? String(step) : path + '.' + step
}


// The same spec for a struct copy that predates `$NOF`, where the union is
// `$ONE`. Only a union has that form, so any other count is refused.
function oneUnionSpec(spec: any, path: string = ''): any {
  if (Array.isArray(spec)) {
    if (S_EXACT === spec[0]) {
      return spec
    }

    if (S_NOF === spec[0]) {
      if (!isAnyOf(spec)) {
        throw new Error('struct spec at ' + (path || '(top)') + ': ' +
          JSON.stringify(spec.slice(0, 2)) + ' has no ' + S_ONE + ' form, so a ' +
          'target whose struct predates ' + S_NOF + ' cannot validate it.')
      }
      return [S_ONE, ...spec.slice(2).map((alt: any, i: number) =>
        oneUnionSpec(alt, specPath(path, i + 2)))]
    }

    return spec.map((item: any, i: number) => oneUnionSpec(item, specPath(path, i)))
  }

  if (null != spec && 'object' === typeof spec) {
    const out: Record<string, any> = {}
    for (const [key, val] of Object.entries(spec)) {
      out[key] = oneUnionSpec(val, specPath(path, key))
    }
    return out
  }

  return spec
}


// Where a spec names `$ONE`, which struct's `validate` does not define and so
// refuses the whole spec over, at every client construction.
function oneUnionPaths(spec: any, path: string = ''): string[] {
  if (S_ONE === spec) {
    return [path || '(top)']
  }

  if (Array.isArray(spec)) {
    return S_EXACT === spec[0] ? [] :
      spec.flatMap((item: any, i: number) => oneUnionPaths(item, specPath(path, i)))
  }

  if (null != spec && 'object' === typeof spec) {
    return Object.entries(spec).flatMap(([key, val]) =>
      oneUnionPaths(val, specPath(path, key)))
  }

  return []
}


function canonToSpec(type: unknown, optional?: boolean): any {
  let spec: any

  if (Array.isArray(type)) {
    // The model's union, apidef's `['`$ONE`', [members]]` rather than struct's.
    // Members are mapped individually and spliced in flat; a member may itself
    // be a union.
    if ('ONE' === canonKey(type[0]) && Array.isArray(type[1])) {
      const members: any[] = []
      for (const member of type[1]) {
        for (const alt of alternatives(canonToSpec(member))) {
          if (members.indexOf(alt) < 0 || 'string' !== typeof alt) {
            members.push(alt)
          }
        }
      }

      if (0 <= members.indexOf(S_NULL) && members.indexOf(S_NIL) < 0) {
        members.push(S_NIL)
      }

      spec = 0 === members.length ? S_ANY : anyOf(members)
    }
    else {
      // An array-shaped sentinel that is not a union is a shape this mapper
      // has not met. `$ANY` over a guess.
      spec = S_ANY
    }
  }
  else {
    const key = canonKey(type)
    spec = 'STRING' === key ? SPEC_STRING : (CANON_STRUCT[key] ?? S_ANY)
  }

  return optional ? optionalSpec(spec) : spec
}


function entityDataSpec(ent: any): Record<string, any> {
  const spec: Record<string, any> = { [S_OPEN]: true }

  const fields = (ent && ent.fields) ? each(ent.fields) : []
  for (const f of fields) {
    if (null == f || null == f.n || false === f.a) {
      continue
    }
    spec[f.n] = canonToSpec(f.t, false === f.r)
  }

  return spec
}


function entityOpSpec(ent: any, opname: string): Record<string, any> | null {
  const { items } = opRequestShape(ent, opname)
  if (0 === items.length) {
    return null
  }

  const spec: Record<string, any> = { [S_OPEN]: true }
  for (const it of items) {
    spec[it.name] = canonToSpec(it.type, it.optional)
  }

  return spec
}


// Every spec one entity needs at runtime: its record shape, and one per op it
// declares. An entity with no fields and no ops yields `{ data: {$OPEN} }`,
// which validates everything — the honest answer for a model that says
// nothing, and cheaper for the runtime than a missing-key branch.
function entitySpecs(ent: any): { data: Record<string, any>, op: Record<string, any> } {
  const op: Record<string, any> = {}

  const ops = (ent && ent.op) || {}
  for (const opname of Object.keys(ops).sort()) {
    const opspec = entityOpSpec(ent, opname)
    if (null != opspec) {
      op[opname] = opspec
    }
  }

  return { data: entityDataSpec(ent), op }
}


type ValidateSeeds = {
  valid: Record<string, string | number>,
  invalid: Record<string, string | number> | null,
}


// Records a test can seed for the validate feature to check on a list
// response: one the entity's record spec admits, and one with a declared
// field mistyped. Only strings and numbers, which every target writes the
// same way. The test mock gives a seeded record its key as `id`.
function validateSeeds(ent: any): ValidateSeeds | null {
  const S_NUMBERS = [sentinel('NUMBER'), sentinel('INTEGER')]
  const stringy = (alt: any) =>
    S_STRING === alt || (Array.isArray(alt) && S_EXACT === alt[0] && 'string' === typeof alt[1])

  const valid: Record<string, string | number> = {}
  let mistyped: [string, string | number] | null = null

  for (const [name, node] of Object.entries(entityDataSpec(ent))) {
    if (S_OPEN === name) {
      continue
    }

    const alts = alternatives(node)
    const str = alts.some((a) => S_ANY === a || S_STRING === a)
    const num = alts.some((a) => S_ANY === a || S_NUMBERS.includes(a))

    if ('id' === name) {
      if (!str) {
        return null
      }
      continue
    }

    if (!alts.includes(S_NIL)) {
      if (str) {
        valid[name] = 'x'
      }
      else if (num) {
        valid[name] = 1
      }
      else {
        return null
      }
    }

    const scalar = alts.every((a) => S_NIL === a || stringy(a) || S_NUMBERS.includes(a))
    if (null == mistyped && scalar && str !== num) {
      mistyped = [name, str ? 1 : 'x']
    }
  }

  return {
    valid,
    invalid: null == mistyped ? null : { ...valid, [mistyped[0]]: mistyped[1] },
  }
}


function byExampleSpec(val: any): any {
  if (null == val) {
    return S_ANY
  }

  if (Array.isArray(val)) {
    return sentinel('LIST')
  }

  const t = typeof val

  if ('string' === t) {
    return SPEC_STRING
  }
  if ('number' === t) {
    // `$NUMBER` admits integer and decimal alike; `$INTEGER` would re-impose
    // exactly the trap this function exists to remove.
    return sentinel('NUMBER')
  }
  if ('boolean' === t) {
    return sentinel('BOOLEAN')
  }
  if ('function' === t) {
    return S_ANY
  }

  return sentinel('MAP')
}


export {
  alternatives,
  anyOf,
  byExampleSpec,
  canonToSpec,
  isAnyOf,
  oneUnionPaths,
  oneUnionSpec,
  optionalSpec,
  entityDataSpec,
  entityOpSpec,
  entitySpecs,
  sentinel,
  validateSeeds,
  SPEC_STRING,
}

export type {
  ValidateSeeds,
}
