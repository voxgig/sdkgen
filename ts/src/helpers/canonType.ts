// Canonical type-sentinel -> language primitive type mapper.
//
// SOURCE OF TRUTH for the sentinel set: @voxgig/apidef
//   ~/Projects/voxgig/apidef ts/src/utility.ts  ->  `const VALID_CANON`
// (around line 908). VALID_CANON maps an OpenAPI type NAME -> a `$SENTINEL`
// string (e.g. 'string' -> `$STRING`). The model stores those sentinels on
// every `fields[].type` and op `points[].args.params[].type`.
//
// This table maps the SENTINEL the other way -> a concrete primitive type in
// each target language, so the typed-model generators (EntityTypes_<lang>.ts)
// can turn the model's field/param sentinels into real language types.
//
// Kept as a small duplicate here (rather than importing VALID_CANON) because
// VALID_CANON is name->sentinel, is not exported from @voxgig/apidef, and would
// need inverting; a sentinel->type table is what every language generator
// actually needs. If VALID_CANON gains a new sentinel, add a row below (all
// languages) and keep the two in sync.
//
// KNOWN GAPS (papered over sanely, documented for the port):
//  - Unknown / missing sentinel  -> the language's "any" (never throws).
//  - Array element typing is not in the model: $ARRAY maps to an untyped
//    list/array. `list` ops return T[] via op-kind inference in the op
//    fragment, NOT via a field sentinel.
//  - Object/nested field schemas are not in the corpus: $OBJECT maps to the
//    language's open record/map type.
//  - No enum/format/nullability beyond the `req` flag.

// Target languages sdkgen supports (go-cli / go-mcp reuse 'go').
type CanonLang = 'ts' | 'js' | 'py' | 'php' | 'rb' | 'lua' | 'go'

// Bare sentinel key (backticks + leading `$` stripped, upper-cased)
// -> per-language primitive type name.
//
// ONLY the `ts` column is exercised + tested today (the reference target).
// The other columns are a starting scaffold for the per-language port; verify
// each against that language's idioms before wiring its EntityTypes_<lang>.ts.
const CANON_TYPE: Record<string, Record<CanonLang, string>> = {
  STRING: { ts: 'string', js: 'string', py: 'str', php: 'string', rb: 'String', lua: 'string', go: 'string' },
  INTEGER: { ts: 'number', js: 'number', py: 'int', php: 'int', rb: 'Integer', lua: 'number', go: 'int64' },
  NUMBER: { ts: 'number', js: 'number', py: 'float', php: 'float', rb: 'Float', lua: 'number', go: 'float64' },
  BOOLEAN: { ts: 'boolean', js: 'boolean', py: 'bool', php: 'bool', rb: 'Boolean', lua: 'boolean', go: 'bool' },
  NULL: { ts: 'null', js: 'null', py: 'None', php: 'null', rb: 'NilClass', lua: 'nil', go: 'any' },
  ARRAY: { ts: 'any[]', js: 'any[]', py: 'list', php: 'array', rb: 'Array', lua: 'table', go: '[]any' },
  OBJECT: { ts: 'Record<string, any>', js: 'object', py: 'dict', php: 'array', rb: 'Hash', lua: 'table', go: 'map[string]any' },
  ANY: { ts: 'any', js: 'any', py: 'Any', php: 'mixed', rb: 'Object', lua: 'any', go: 'any' },
}

// Per-language fallback for unknown / missing sentinels.
const CANON_ANY: Record<CanonLang, string> = {
  ts: 'any', js: 'any', py: 'Any', php: 'mixed', rb: 'Object', lua: 'any', go: 'any',
}


// Normalize a raw sentinel value to its bare upper-case key:
// '`$STRING`' / '$STRING' / 'string' -> 'STRING'.
function canonKey(sentinel: unknown): string {
  if (null == sentinel) {
    return ''
  }
  return String(sentinel).replace(/[`$]/g, '').trim().toUpperCase()
}


// Map a field/param type sentinel to a target-language primitive type.
// Unknown or missing sentinel -> that language's "any" (never throws).
function canonToType(sentinel: unknown, lang: string): string {
  const l = lang as CanonLang
  const fallback = CANON_ANY[l] ?? 'any'

  const row = CANON_TYPE[canonKey(sentinel)]
  if (null == row) {
    return fallback
  }

  return row[l] ?? fallback
}


export {
  canonToType,
  canonKey,
  CANON_TYPE,
  CANON_ANY,
}

export type {
  CanonLang,
}
