import { canonKey, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Scope, SdkDescription, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'e_list', load: 'e_load', create: 'e_create', update: 'e_update', patch: 'e_patch', remove: 'e_remove' },
  named: 'bare',
  async: false,
  result: 'raise',
  collection: '`list`',
  record: '{var}.e_data_get ()',
  recordType: 'value',
  prints: 'record',
}

// The fixed API the reference page documents: the client module Main_ocaml
// and MainEntity_ocaml write (sdk_client.ml), and the entity_obj record of
// tm/ocaml/sdk_types.ml whose fields Entity_ocaml fills.
const refFacts: RefFacts = {
  entityBy: 'Name',
  noun: 'functions',
  entityNoun: 'Fields',
  heading: '{module}',
  none: 'Noval',
  keys: 'bare',
  maps: 'maps',
  container: 'value',
  valueType: { STRING: 'string', OBJECT: 'map', ANY: 'value' },
  ctor: ['open Voxgig_struct', 'open Sdk_helpers', 'open Sdk_types', '', 'let client = {ctor} options'],
  ctorAlts: [{ call: '{module}.make0 ()', kind: 'defaults' }],
  test: [
    { sig: 'test () : {client}', call: 'let client = {module}.test ()', args: false },
    { sig: 'test_with (testopts : value) (sdkopts : value) : {client}', call: 'let client = {module}.test_with Noval Noval', args: true },
  ],
  accessor: { sig: '{accessor} (client : {client}) (entopts : value) : entity_obj', arg: 'entopts', param: 'entopts' },
  op: {
    list: 'e_list (value) (value) : entity_obj list',
    load: 'e_load (value) (value) : entity_obj',
    create: 'e_create (value) (value) : entity_obj',
    update: 'e_update (value) (value) : entity_obj',
    patch: 'e_patch (value) (value) : entity_obj',
    remove: 'e_remove (value) (value) : entity_obj',
  },
  client: [
    { kind: 'direct', sig: 'direct (client : {client}) (fetchargs : value) : value' },
    { kind: 'prepare', sig: 'prepare (client : {client}) (fetchargs : value) : value' },
  ],
  entity: [
    { kind: 'dataGet', sig: 'e_data_get () : value', copy: true },
    { kind: 'dataSet', sig: 'e_data_set (value) : unit' },
    { kind: 'matchGet', sig: 'e_match_get () : value' },
    { kind: 'matchSet', sig: 'e_match_set (value) : unit' },
    { kind: 'make', sig: 'e_make () : entity_obj' },
    { kind: 'streamSync', sig: 'e_stream (string) (value) (value) : value Seq.t', runs: 'call' },
    { kind: 'name', sig: 'e_name : string' },
  ],
  direct: { returns: 'value', okFalse: 'false' },
  prepare: { returns: 'value', fails: 'style' },
  body: { values: 'a `Str` holding the bytes' },
  cancel: false,
}

// Field types as the old reference named them: every field is carried in the
// dynamic `value` union, so these are the logical types it holds.
const TYPES: Record<string, string> = {
  STRING: 'string', INTEGER: 'int', NUMBER: 'float', BOOLEAN: 'bool', ARRAY: 'value list', OBJECT: 'value map',
}
const typeOf = (t: any): string => TYPES[canonKey(t)] ?? 'value'

// An OCaml string literal: `\\`, `\"`, `\n`, `\r`, `\t` and decimal `\ddd`.
const str = (s: string): string => '"' + [...String(s)].map((c) => {
  const n = c.charCodeAt(0)
  if ('\\' === c) return '\\\\'
  if ('"' === c) return '\\"'
  if ('\n' === c) return '\\n'
  if ('\r' === c) return '\\r'
  if ('\t' === c) return '\\t'
  return n < 0x20 ? '\\' + String(n).padStart(3, '0') : c
}).join('') + '"'

const name = (r: Ref): string => r.name

// A typed literal as a `value`; in an argument's own members it is
// parenthesised, as the old pages wrote it.
const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: 'Num 1.', NUMBER: 'Num 1.', BOOLEAN: 'Bool true', ARRAY: 'empty_list ()', OBJECT: 'empty_map ()', NULL: 'Null',
} as Record<string, string>)[e.type] ?? 'Str ' + str(e.text)

const record = (r: Ref): string => `${name(r)}.e_data_get ()`

// `top`: a member of a call's argument, which the old pages parenthesised.
const value = (e: Expr, top: boolean): string => {
  switch (e.k) {
    case 'lit': return 'NULL' === e.type ? lit(e) : (top ? '(' + lit(e) + ')' : lit(e))
    case 'str': return 'Str ' + str(e.text)
    case 'env': return `Str (Sys.getenv ${str(e.name)})`
    case 'field': return top ? '(' + field(e.of, e.field) + ')' : field(e.of, e.field)
    case 'map': return 'jo [' + e.entries.map((en) => pair(en, false)).join('; ') + ']'
    default: return expr(e)
  }
}

const field = (r: Ref, f: string): string => `getp (${record(r)}) ${str(f)}`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return 'Str ' + str(e.text)
    case 'env': return `Str (Sys.getenv ${str(e.name)})`
    case 'record': return record(e.of)
    case 'field': return field(e.of, e.field)
    case 'fields': return 'String.concat " " [' + e.fields.map((f) => `stringify (${field(e.of, f)})`).join('; ') + ']'
    case 'map': return 'jo [' + e.entries.map((en) => pair(en, true)).join('; ') + ']'
  }
}

const pair = (en: Entry, top: boolean): string => `(${str(en.key)}, ${value(en.value, top)})`

// What a print shows: a record is stringified, chosen fields are joined.
const shown = (e: Expr): string => 'fields' === e.k ? `(${expr(e)})` : `(stringify (${expr(e)}))`

// A call's argument: none, a map on one line, or a map laid out a member per
// line where it carries types or a closing note.
const argOf = (s: Extract<Stmt, { k: 'call' }>, none: string): string => {
  if (null == s.arg) return `(${none})`
  const laid = s.wide && (null != s.note || s.arg.some((en) => null != en.type))
  if (!laid) return `(${expr({ k: 'map', entries: s.arg })})`
  return '(jo [\n' + [
    ...s.arg.map((en) => `    ${pair(en, true)};` + (null == en.type ? '' : `  (* ${typeOf(en.type)} *)`)),
    ...(null == s.note ? [] : [`    (* ${s.note} *)`]),
  ].join('\n') + '\n])'
}

const callExpr = (s: Extract<Stmt, { k: 'call' }>, desc: SdkDescription): string =>
  `(${desc.layout.module}.${s.entity.sym.accessor} client ${refFacts.none}).${(facts.method as any)[s.op]} ` +
  `${argOf(s, refFacts.none)} ${refFacts.none}`

// Where a statement stands: at the top of its block (a definition of its
// own), or inside error handling or a loop (a step of a sequence), and then
// whether another step follows it. A statement in no block at all is an
// expression on its own (an action's Call cell).
type Place = 'top' | 'last' | 'inner' | 'alone'

const place = (s: Stmt, sc: Scope): Place => {
  if (sc.stmts.includes(s)) return 'top'
  let found: Place = 'alone'
  const walk = (list: Stmt[]): void => list.forEach((x, i) => {
    if (x === s) found = i === list.length - 1 ? 'last' : 'inner'
    if ('attempt' === x.k || 'each' === x.k) walk(x.body)
  })
  walk(sc.stmts)
  return found
}

// A step of a sequence ends with `;` where another follows it.
const step = (line: string, p: Place): string => 'inner' === p ? line + ';' : line

const defaults = (desc: SdkDescription): string =>
  (refFacts.ctorAlts || [])[0].call.replace('{module}', desc.layout.module)


const Syntax: SyntaxType = {
  fence: 'ocaml',
  facts,

  imports: () => ['open Voxgig_struct', 'open Sdk_helpers', 'open Sdk_types'],

  // One option whose value is a map of maps (the features) is laid out a
  // member per line, as the old pages wrote it; otherwise on one line.
  client: (s, desc) => {
    if (0 === s.options.length) return [`let client = ${defaults(desc)}`]
    const only = 1 === s.options.length ? s.options[0] : null
    if (null != only && 'map' === only.value.k && only.value.entries.some((en) => 'map' === en.value.k)) {
      return [
        `let client = ${desc.layout.ctor} (jo [`,
        `    (${str(only.key)}, jo [`,
        ...only.value.entries.map((en) => `        ${pair(en, false)};`),
        '    ]);',
        '])',
      ]
    }
    return [`let client = ${desc.layout.ctor} (${expr({ k: 'map', entries: s.options })})`]
  },

  call: (s, desc, sc) => {
    const p = place(s, sc)
    const call = callExpr(s, desc)
    if ('alone' === p) return [call]
    if ('top' === p) return [null == s.bind ? `let _ = ${call}` : `let ${name(s.bind)} = ${call}`]
    return [null == s.bind ? step(`ignore (${call})`, p) : `let ${name(s.bind)} = ${call} in`]
  },

  each: (s, inner, sc) => {
    const p = place(s, sc)
    const body = inner(s.body)
    const lines = 1 === body.length
      ? [`List.iter (fun ${name(s.item)} -> ${body[0]}) ${name(s.of)}`]
      : [`List.iter (fun ${name(s.item)} ->`, ...indentLines(body, '    '), `  ) ${name(s.of)}`]
    if ('top' === p) return [`let () = ${lines[0]}`, ...lines.slice(1)]
    return [...lines.slice(0, -1), step(lines[lines.length - 1], p)]
  },

  print: (s, sc) => {
    const p = place(s, sc)
    const line = `print_endline ${shown(s.what)}`
    return ['top' === p ? `let () = ${line}` : step(line, p)]
  },

  attempt: (s, inner, _sc, desc) => [
    '(try',
    ...indentLines(inner(s.body), '   '),
    ` with ${(desc.layout.names || {}).error}.E err -> Printf.eprintf "${s.what} failed: %s\\n" (${(desc.layout.names || {}).error}.message err))`,
  ],

  comment: (text) => '(* ' + text + ' *)',

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: typeOf,
    key: (_container, path) => path.join('.'),
    instance: (e, desc) => [`let ${e.sym.var} = ${desc.layout.module}.${e.sym.accessor} client ${refFacts.none}`],
    read: (v, key) => `getp ${v} ${str(key)}`,
  },

  notes: {
    operations: 'Each operation takes its match or data, then a control map, `ctrl`,\nboth by position: pass `Noval` for either to give none.',
    'member:name': '`e_name` is a field of the entity, read without a call.',
    'member:streamSync': 'Its arguments are the name of the operation, its match, and `callopts`.',
  },
}


export {
  Syntax
}
