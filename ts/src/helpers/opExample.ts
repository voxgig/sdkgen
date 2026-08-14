// Renders a single, type-correct entity-op CALL for the neutral doc
// components (ReadmeErrors, ReadmeExplanation) that illustrate a convention
// (throw-on-error, stateful entities) with one representative operation.
//
// Two model traps this centralises:
//   1. OP-AWARENESS — the illustrated op must be one the entity actually
//      exposes. A create-only entity has no `load` method, so these components
//      pick the entity's PRIMARY op (entityPrimaryOp) rather than hardcoding
//      `load`, and this module renders whatever op that is.
//   2. TYPE-CORRECT MATCH ID — an entity can carry its id ONLY in the
//      load-match params (no `id` data field). The example id literal is
//      therefore derived from the OP's param type (opRequestShape), not the
//      entity fields, so a numeric match id renders `1` and not `"example_id"`
//      (which would be a TS2322 against a `number` match).
//
// Output is the invocation EXPRESSION and its result binding; the surrounding
// prose / try-catch scaffolding stays in each component's per-language table.

import { each } from 'jostraca'
import { canonKey } from './canonType'
import { opRequestShape, entityIdField } from './opShape'

import { phpEntityAccessor } from './naming'


type ExampleLang = 'ts' | 'js' | 'py' | 'php' | 'rb' | 'lua' | 'go'


function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


// A type-correct literal for a canonical type sentinel, in the target language.
function litFor(lang: ExampleLang, type: any): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'py' === lang ? 'True' : ('rb' === lang ? 'true' : 'true')
  if ('ARRAY' === k) return ('lua' === lang) ? '{}' : ('go' === lang ? '[]any{}' : '[]')
  // PHP has no `{}` literal — `["data" => {}]` is a parse error, which took
  // the whole generated README down for any entity with an object-typed
  // writable field (dymo-api-introduction, html-creator). Arrays serve as both
  // list and map, so `[]` is the empty object too. Ruby and Lua likewise want
  // their own empty-hash/table spelling rather than JS's.
  if ('OBJECT' === k) {
    if ('go' === lang) return 'map[string]any{}'
    if ('php' === lang) return '[]'
    if ('rb' === lang) return '{}'
    if ('lua' === lang) return '{}'
    if ('py' === lang) return '{}'
    return '{}'
  }
  return '"example"'
}


// The example id literal for an op's match key, typed from the op's declared
// param (falling back to the entity field) so a numeric id is never quoted.
function idLiteral(ent: any, op: string, idF: string | null): string {
  if (null == idF) return '"example_id"'
  const item = opRequestShape(ent, op).items.find((it: any) => it.name === idF)
  const k = canonKey(item && item.type)
  return ('INTEGER' === k || 'NUMBER' === k) ? '1' : '"example_id"'
}


// Render a match object `{ idF: idLit }` (or empty when the entity has no id
// key) in the target language's object syntax.
// Spec-derived field names are NOT constrained to be identifiers — e.g.
// Evervault's `/payments/3ds-sessions/{3ds_session_id}` yields the match key
// `3ds_session_id`. py/php/rb/go quote every literal key already, but ts/js
// (`{ key: v }`) and lua (`{ key = v }`) write them bare, and a leading digit
// or a `-` makes that a syntax error (TS1351 / Lua "'}' expected"). Quote
// exactly those, leaving ordinary keys in the idiomatic bare form.
const JS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const LUA_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

// A `key<sep>value` literal pair in the target language's object syntax.
function litPair(lang: ExampleLang, name: string, value: string): string {
  switch (lang) {
    case 'py': return `"${name}": ${value}`
    case 'php': return `"${name}" => ${value}`
    case 'rb': return `"${name}" => ${value}`
    case 'go': return `"${name}": ${value}`
    case 'lua': return LUA_IDENT.test(name) ?
      `${name} = ${value}` : `["${name}"] = ${value}`
    default: return JS_IDENT.test(name) ?
      `${name}: ${value}` : `'${name}': ${value}`
  }
}


// The match argument for a load/remove — ALL required match params, not just
// the primary id. A composite-match entity (e.g. Umbrella's FlatPermission,
// `/public/database/{id}/permission/{msisdn}`) has two required path params
// (database_id + id); emitting only `{ id }` fails the typed <Name>LoadMatch.
// The idF field takes the specific id literal; other required fields take a
// type-correct example value (mirrors dataArg).
function matchArg(
  lang: ExampleLang, ent: any, op: string, idF: string | null, idLit: string
): string {
  const items = opRequestShape(ent, op).items.filter((it: any) => !it.optional)
  if (0 === items.length) return 'go' === lang ? 'nil' : ''
  const pairs = items.map((it: any) =>
    litPair(lang, it.name, it.name === idF ? idLit : litFor(lang, it.type)))
  switch (lang) {
    case 'py': return `{${pairs.join(', ')}}`
    case 'php': return `[${pairs.join(', ')}]`
    case 'go': return `map[string]any{${pairs.join(', ')}}`
    default: return `{ ${pairs.join(', ')} }`
  }
}


// The entity's required writable fields for a create/update body, rendered as
// `key: value` pairs (capped) in the target language's object syntax. Ensures
// the body satisfies a typed CreateData/UpdateData (required fields present).
function dataArg(lang: ExampleLang, ent: any, op: string, idF: string | null): string {
  // The id is normally server-assigned on create, so it is dropped from the
  // example body. But it is only safe to drop when the request shape says it is
  // OPTIONAL: an op whose id comes from a PATH PARAMETER requires it, and a
  // typed CreateData then rejects a body without it.
  //
  // Conecto's `/integrations/{slug}/actions/{action}/run/` is the case — the
  // guide renames the `action` param to `id`, so ActionCreateData is
  // `{id, slug, ok}` and the generated snippet emitted only `{slug, ok}`,
  // failing to compile with "Property 'id' is missing".
  const items = opRequestShape(ent, op).items
    .filter((it: any) =>
      (it.name !== idF && it.name !== 'id') || !it.optional)
  const required = items.filter((it: any) => !it.optional)
  // ALL required fields must appear (a typed CreateData rejects a partial); cap
  // only the optional fallback used when the op declares no required field.
  const chosen = required.length ? required : items.slice(0, 3)
  const pairs = chosen.map((it: any) => litPair(lang, it.name, litFor(lang, it.type)))
  switch (lang) {
    case 'php': return `[${pairs.join(', ')}]`
    case 'lua': return `{ ${pairs.join(', ')} }`
    case 'go': return `map[string]any{${pairs.join(', ')}}`
    default: return `{ ${pairs.join(', ')} }`
  }
}


type PrimaryCall = {
  // The full invocation expression, e.g. `client.Advice().load({ id: 1 })`
  // (ts) or `client.Generate(nil).Create(map[string]any{...}, nil)` (go).
  expr: string
  // The natural result-variable name (`advice`, `advices`, `generate`).
  resultVar: string
  // True when the op returns no value (remove) — callers that print the
  // result should skip it.
  isVoid: boolean
}


// Render the entity's PRIMARY-op invocation in `lang`. `eName` is the
// Capitalised entity name, `eLower` the variable-safe lowercase name, `op` the
// primary op name. Method spelling / factory syntax follow each language's
// idiom (Go PascalCase + ctrl arg, Lua `:` calls, Ruby paren-less factory).
function primaryOpCall(
  lang: ExampleLang,
  eName: string,
  eLower: string,
  op: string,
  idF: string | null,
  ent: any,
): PrimaryCall {
  const isMatch = 'load' === op || 'remove' === op
  const isList = 'list' === op
  const isData = 'create' === op || 'update' === op
  const idLit = idLiteral(ent, op, idF)

  // Factory + method spelling per language.
  const method = 'go' === lang ? cap(op) : op
  let factory: string
  let sep: string
  if ('go' === lang) { factory = `client.${eName}(nil)`; sep = '.' }
  else if ('lua' === lang) { factory = `client:${eName}()`; sep = ':' }
  else if ('rb' === lang) { factory = `client.${eName}`; sep = '.' }
  // php mangles an accessor that would collide with an SDK class member
  // (see phpEntityAccessor); the example has to call the name that is
  // actually declared, or it invokes the SDK's own method instead.
  else if ('php' === lang) { factory = `$client->${phpEntityAccessor(eName)}()`; sep = '->' }
  else { factory = `client.${eName}()`; sep = '.' }

  // Argument string per op + language.
  let arg: string
  if (isList) {
    arg = 'go' === lang ? 'nil' : ''
  } else if (isMatch) {
    arg = matchArg(lang, ent, op, idF, idLit)
  } else if (isData) {
    arg = dataArg(lang, ent, op, idF)
  } else {
    arg = 'go' === lang ? 'nil' : ''
  }
  // Go passes a trailing ctrl arg on every entity method.
  if ('go' === lang) {
    arg = arg + ', nil'
  }

  const expr = `${factory}${sep}${method}(${arg})`
  const resultVar = isList ? eLower + 's' : eLower
  return { expr, resultVar, isVoid: 'remove' === op }
}


export {
  primaryOpCall,
  idLiteral,
  matchArg,
  dataArg,
  litFor,
}

export type {
  ExampleLang,
  PrimaryCall,
}
