
import { each } from 'jostraca'
import { canonScalarKey } from './canonType'
import { opRequestShape, opParams, entityIdField } from './opShape'

import { phpEntityAccessor } from './naming'


type ExampleLang = 'ts' | 'js' | 'py' | 'php' | 'rb' | 'lua' | 'go'

// The languages a literal is written in: the call languages, and JSON.
type LiteralLang = ExampleLang | 'json'

// The call languages, in the order a reader is likeliest to want one.
const EXAMPLE_LANGS: ExampleLang[] = ['ts', 'js', 'py', 'go', 'php', 'rb', 'lua']


// The language of a section shared by every target: its own, else TypeScript.
function helperLang(target: string): ExampleLang {
  return EXAMPLE_LANGS.includes(target as ExampleLang) ? target as ExampleLang : 'ts'
}


function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


const NULL_LIT: Record<LiteralLang, string> = {
  ts: 'null', js: 'null', py: 'None', php: 'null', rb: 'nil', lua: 'nil', go: 'nil', json: 'null',
}


// A type-correct literal for a canonical type sentinel, in the target language.
function litFor(lang: LiteralLang, type: any): string {
  const k = canonScalarKey(type)
  if ('NULL' === k) return NULL_LIT[lang]
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


function idLiteral(ent: any, op: string, idF: string | null): string {
  if (null == idF) return '"example_id"'
  const item = opRequestShape(ent, op).items.find((it: any) => it.name === idF)
  const k = canonScalarKey(item && item.type)
  return ('INTEGER' === k || 'NUMBER' === k) ? '1' : '"example_id"'
}


const JS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const LUA_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

function litPair(lang: LiteralLang, name: string, value: string): string {
  switch (lang) {
    case 'py': return `"${name}": ${value}`
    case 'php': return `"${name}" => ${value}`
    case 'rb': return `"${name}" => ${value}`
    case 'go': return `"${name}": ${value}`
    case 'json': return `${JSON.stringify(name)}: ${value}`
    case 'lua': return LUA_IDENT.test(name) ?
      `${name} = ${value}` : `["${name}"] = ${value}`
    default: return JS_IDENT.test(name) ?
      `${name}: ${value}` : `'${name}': ${value}`
  }
}


function requiredItems(ent: any, op: string): any[] {
  return opRequestShape(ent, op).items.filter((it: any) => !it.optional)
}


function matchArg(
  lang: LiteralLang, ent: any, op: string, idF: string | null, idLit: string
): string {
  const items = requiredItems(ent, op)
  if (0 === items.length) return 'go' === lang ? 'nil' : ('json' === lang ? '{}' : '')
  const pairs = items.map((it: any) =>
    litPair(lang, it.name, it.name === idF ? idLit : litFor(lang, it.type)))
  switch (lang) {
    case 'py': return `{${pairs.join(', ')}}`
    case 'php': return `[${pairs.join(', ')}]`
    case 'go': return `map[string]any{${pairs.join(', ')}}`
    default: return `{ ${pairs.join(', ')} }`
  }
}


// Java's Map.of has an overload per pair count up to ten, and Map.ofEntries takes any.
function javaMap(count: number, pkg = ''): { open: string, pair: (kv: string) => string } {
  const many = 10 < count
  return {
    open: pkg + (many ? 'Map.ofEntries(' : 'Map.of('),
    pair: (kv: string) => many ? pkg + 'Map.entry(' + kv + ')' : kv,
  }
}


function javaMapOf(pairs: string[], pkg = ''): string {
  const map = javaMap(pairs.length, pkg)
  return map.open + pairs.map(map.pair).join(', ') + ')'
}


// A list's required route and query parameters.
function listMatchArg(lang: LiteralLang, ent: any): string {
  const idF = entityIdField(ent)
  return matchArg(lang, ent, 'list', idF, idLiteral(ent, 'list', idF))
}


// An update that only addresses its record, by id and route, also changes a field.
function dataArg(lang: LiteralLang, ent: any, op: string, idF: string | null): string {
  const routed = new Set(opParams(ent?.op?.[op]).map((p: any) => p.n))
  const addresses = (it: any) => it.name === idF || it.name === 'id' || routed.has(it.name)
  const items = opRequestShape(ent, op).items
    .filter((it: any) =>
      (it.name !== idF && it.name !== 'id') || !it.optional)
  const required = items.filter((it: any) => !it.optional)
  const changed = 'update' === op && required.every(addresses) ?
    items.filter((it: any) => it.optional && !addresses(it)).slice(0, 1) : []
  const chosen = required.length ? [...required, ...changed] : items.slice(0, 3)
  const pairs = chosen.map((it: any) => litPair(lang, it.name, litFor(lang, it.type)))
  switch (lang) {
    case 'php': return `[${pairs.join(', ')}]`
    case 'lua': return `{ ${pairs.join(', ')} }`
    case 'go': return `map[string]any{${pairs.join(', ')}}`
    default: return `{ ${pairs.join(', ')} }`
  }
}


type PrimaryCall = {
  expr: string
  resultVar: string
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

  let arg: string
  if (isList || isMatch) {
    arg = matchArg(lang, ent, op, idF, idLit)
  } else if (isData) {
    arg = dataArg(lang, ent, op, idF)
  } else {
    arg = 'go' === lang ? 'nil' : ''
  }
  if ('go' === lang) {
    arg = arg + ', nil'
  }

  const expr = `${factory}${sep}${method}(${arg})`
  const resultVar = isList ? eLower + 's' : eLower
  return { expr, resultVar, isVoid: 'remove' === op }
}


export {
  EXAMPLE_LANGS,
  helperLang,
  primaryOpCall,
  idLiteral,
  requiredItems,
  matchArg,
  listMatchArg,
  dataArg,
  javaMap,
  javaMapOf,
  litFor,
}

export type {
  ExampleLang,
  LiteralLang,
  PrimaryCall,
}
