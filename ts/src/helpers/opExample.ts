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
  if ('OBJECT' === k) return ('go' === lang) ? 'map[string]any{}' : '{}'
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
function matchArg(lang: ExampleLang, idF: string | null, idLit: string): string {
  if (null == idF) return 'go' === lang ? 'nil' : ''
  switch (lang) {
    case 'py': return `{"${idF}": ${idLit}}`
    case 'php': return `["${idF}" => ${idLit}]`
    case 'rb': return `{ "${idF}" => ${idLit} }`
    case 'lua': return `{ ${idF} = ${idLit} }`
    case 'go': return `map[string]any{"${idF}": ${idLit}}`
    default: return `{ ${idF}: ${idLit} }`
  }
}


// The entity's required writable fields for a create/update body, rendered as
// `key: value` pairs (capped) in the target language's object syntax. Ensures
// the body satisfies a typed CreateData/UpdateData (required fields present).
function dataArg(lang: ExampleLang, ent: any, op: string, idF: string | null): string {
  const items = opRequestShape(ent, op).items
    .filter((it: any) => it.name !== idF && it.name !== 'id')
  const required = items.filter((it: any) => !it.optional)
  // ALL required fields must appear (a typed CreateData rejects a partial); cap
  // only the optional fallback used when the op declares no required field.
  const chosen = required.length ? required : items.slice(0, 3)
  const pairs = chosen.map((it: any) => {
    const v = litFor(lang, it.type)
    switch (lang) {
      case 'py': return `"${it.name}": ${v}`
      case 'php': return `"${it.name}" => ${v}`
      case 'rb': return `"${it.name}" => ${v}`
      case 'lua': return `${it.name} = ${v}`
      case 'go': return `"${it.name}": ${v}`
      default: return `${it.name}: ${v}`
    }
  })
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
  else if ('php' === lang) { factory = `$client->${eName}()`; sep = '->' }
  else { factory = `client.${eName}()`; sep = '.' }

  // Argument string per op + language.
  let arg: string
  if (isList) {
    arg = 'go' === lang ? 'nil' : ''
  } else if (isMatch) {
    arg = matchArg(lang, idF, idLit)
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
