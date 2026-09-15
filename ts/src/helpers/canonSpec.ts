// Canonical type-sentinel -> struct.validate SPEC mapper.
//
// The sibling of canonType: that table turns a field's canon sentinel into a
// language TYPE NAME (what the generated source declares); this one turns the
// same sentinel into a struct.validate SPEC VALUE (what the generated runtime
// checks a payload against). One vocabulary, two renderings, and — as with
// canonType — a SINGLE mapping that components must not copy locally.
//
// WHY THIS IS ALMOST NOTHING. apidef stores `$STRING`, `$INTEGER`, `$NUMBER`,
// `$BOOLEAN`, `$NULL`, `$ARRAY`, `$OBJECT`, `$ANY` on `fields[].type`, and
// struct.validate's own vocabulary is `$STRING $NUMBER $INTEGER $DECIMAL
// $BOOLEAN $NULL $NIL $MAP $LIST $FUNCTION $INSTANCE $ANY $CHILD $ONE $EXACT`.
// Six of the eight scalar names are the IDENTICAL string. Only three things
// have to be adapted, and each is a real difference rather than a translation:
//
//   1. CONTAINERS ARE NAMED DIFFERENTLY. apidef speaks OpenAPI ($ARRAY,
//      $OBJECT), struct speaks its own value model ($LIST, $MAP).
//
//   2. UNIONS ARE SHAPED DIFFERENTLY. apidef nests the members —
//      ['`$ONE`', [a, b]] — and struct wants them flat: ['`$ONE`', a, b].
//      The nested form does not fail loudly, which is the trap: struct reads
//      the inner LIST as a single alternative, so `['`$ONE`', ['`$STRING`',
//      '`$INTEGER`']]` rejects the string 'x' with "expected [string,integer]".
//
//   3. STRUCT'S `$STRING` REJECTS THE EMPTY STRING. That is right for an
//      option (an empty apikey is a missing apikey) and wrong for API data,
//      where '' is an ordinary value a server returns. A field spec therefore
//      widens to ['`$ONE`', '`$STRING`', ['`$EXACT`', '']].
//
// OPTIONALITY. struct requires every key its spec names, so an optional field
// is the union of its type with `$NIL` (which matches an ABSENT value; `$NULL`
// matches a stored JSON null). `req: false` on a field, and `optional: true`
// on an opRequestShape item, both land here.
//
// WHAT THIS CANNOT EXPRESS, because the model does not carry it (the same
// KNOWN GAPS canonType records): array ELEMENT types, nested object schemas,
// enums, string formats, and any numeric or length bound. A spec built here
// checks the shape the model knows about and nothing more — which is why
// record specs are `$OPEN` (below) rather than closed.

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


// Canon sentinel key -> the struct.validate sentinel that checks it.
// STRING is deliberately absent: it needs the empty-string widening above and
// is handled in canonToSpec, so a caller cannot get the bare form by accident.
const CANON_STRUCT: Record<string, string> = {
  INTEGER: sentinel('INTEGER'),
  NUMBER: sentinel('NUMBER'),
  BOOLEAN: sentinel('BOOLEAN'),
  NULL: sentinel('NULL'),

  // The container renaming (difference 1 above).
  ARRAY: sentinel('LIST'),
  OBJECT: sentinel('MAP'),

  ANY: S_ANY,
}


// A string that may be empty (difference 3 above).
const SPEC_STRING: any[] = [S_ONE, S_STRING, [S_EXACT, '']]


// Flatten a spec into the alternatives of a union, so that widening a value
// that is ALREADY a union does not nest one `$ONE` inside another.
function alternatives(spec: any): any[] {
  if (Array.isArray(spec) && S_ONE === spec[0]) {
    return spec.slice(1)
  }
  return [spec]
}


// A spec that also admits an ABSENT value.
//
// struct requires every key its spec names, so this is how "optional" is
// spelled. Flattened through `alternatives`, so widening something that is
// already a union (an empty-string-tolerant `$STRING`, an apidef `$ONE`)
// adds one member rather than nesting a union inside a union — which struct
// reads as a single alternative and rejects.
function optionalSpec(spec: any): any {
  // `$ANY` already admits an absent value, so widening it would only make
  // the spec longer and its error messages worse.
  if (S_ANY === spec) {
    return spec
  }

  return [S_ONE, ...alternatives(spec), S_NIL]
}


// Map one field/param type sentinel to a struct.validate spec value.
//
// Unknown or missing sentinel -> `$ANY`, never a throw: this mirrors
// canonToType's contract, and for the same reason. A sentinel this table has
// not met is a model the generator should still emit for, and an over-strict
// spec would reject live traffic at runtime rather than fail a build.
//
// `optional` widens the result with `$NIL` so an absent key passes.
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

      // A NULLABLE FIELD NEEDS `$NIL`, NOT JUST `$NULL`.
      //
      // apidef writes a nullable field as ['`$ONE`', [<type>, '`$NULL`']],
      // and `$NULL` on its own does match a stored null. Inside a union it
      // does not: struct resolves each alternative through a lookup that
      // reads a stored null as "no value", so the value that reaches the
      // `$NULL` validator is undefined and every nullable field rejected the
      // one value it exists to allow. `$NIL` matches that no-value, so the
      // pair covers both readings.
      //
      // THE COST, stated because it is real and not an oversight: `$NIL` is
      // also how an OPTIONAL field is spelled, and struct cannot tell a
      // stored null from an absent key inside a union — the lookup collapses
      // them before any alternative sees the value. So a REQUIRED nullable
      // field (`string | null`, `req: true`) also passes when the key is
      // missing. The alternative is worse: drop `$NIL` and a nullable field
      // rejects null, which is the one value it is declared to hold, for
      // EVERY such field rather than weakening presence on a subset. Closing
      // the gap needs a presence check outside struct, i.e. a second
      // validation mechanism beside the one this whole module exists to
      // reuse. Revisit if struct gains a spelling that separates them.
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


// The spec for one entity RECORD: every active field, keyed by name.
//
// OPEN, ALWAYS. apidef records the properties a spec declared, which is not a
// promise that a response carries nothing else — a server that adds a field is
// not breaking its clients, and a closed spec would turn that into a client
// error for every caller at once. The declared fields are type-checked; the
// rest pass. A caller who wants the closed reading drops `$OPEN` at runtime
// (the validate feature's `strict` option does exactly that).
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


// The spec for one operation's REQUEST payload.
//
// The members and their optionality are opRequestShape's answer, not a second
// reading of the model: the partiality policy that decides what a generated
// `<Name>CreateData` requires is the same policy that decides what a create
// call must carry, and two copies of it would drift the moment one is edited.
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


// A DEFAULT VALUE, read as a type.
//
// A feature declares its options as defaults (`ttl: 5000`, `currency: 'USD'`,
// `methods: ['GET']`) — a map written to document what happens when you say
// nothing, not to state a type. struct.validate reads it by example, and by
// example is SHARPER than the author meant: `unit: 0` says "an integer", so
// cost's own `unit: 0.002` failed its own feature's spec; `header: ''` says
// "a non-empty string", which the default itself is not.
//
// So the default is kept for its KIND and widened to that kind's sentinel.
// Nothing is lost by dropping the value: a feature's defaults are applied by
// the feature's own code (`this._options.currency || 'USD'`), never by this
// spec — each feature entry is optional, and struct fills in nothing through
// an optional union.
//
// This applies to a DEFAULTS map only. `main.kit.optspec` is written as a
// spec, so its concrete values are the author's own choice of constraint and
// are passed through untouched.
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
