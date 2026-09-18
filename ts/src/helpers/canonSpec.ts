
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


const SPEC_STRING: any[] = [S_ONE, S_STRING, [S_EXACT, '']]


// Flatten a spec into the alternatives of a union, so that widening a value
// that is ALREADY a union does not nest one `$ONE` inside another.
function alternatives(spec: any): any[] {
  if (Array.isArray(spec) && S_ONE === spec[0]) {
    return spec.slice(1)
  }
  return [spec]
}


function optionalSpec(spec: any): any {
  if (S_ANY === spec) {
    return spec
  }

  return [S_ONE, ...alternatives(spec), S_NIL]
}


function canonToSpec(type: unknown, optional?: boolean): any {
  let spec: any

  if (Array.isArray(type)) {
    // The union sentinel. Members are mapped individually and SPLICED IN
    // flat (difference 2 above); a member may itself be a union.
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

      spec = 0 === members.length ? S_ANY : [S_ONE, ...members]
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
    if (null == f || null == f.name || false === f.active) {
      continue
    }
    spec[f.name] = canonToSpec(f.type, false === f.req)
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
  byExampleSpec,
  canonToSpec,
  optionalSpec,
  entityDataSpec,
  entityOpSpec,
  entitySpecs,
  sentinel,
  SPEC_STRING,
}
