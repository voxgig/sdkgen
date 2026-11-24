
import { camelify } from 'jostraca'

import { canonScalarKey } from './canonType'
import { entityCollection } from './opShape'
import { exampleArgItems, javaMapOf } from './opExample'
import type { ArgItem } from './opExample'
import { elixirAccessor, exampleVarName } from './naming'


// The bundled languages outside EXAMPLE_LANGS, whose call text the wording
// tables write themselves. Each grammar follows the language's own quick start.
type CallLang = 'c' | 'clojure' | 'cpp' | 'csharp' | 'elixir' | 'java' | 'kotlin' |
  'ocaml' | 'perl' | 'rust' | 'scala' | 'swift' | 'zig'

type ExampleInput = {
  model: any
  ent: any
  op: string
  idF: string | null
}

type ExampleParts = {
  // A local naming the entity, clear of the names the examples declare.
  v: string
  // The expression that makes the entity, from `client` (`sdk` in elixir).
  factory: string
  // The primary op's argument, or the language's empty value.
  arg: string
}

type Grammar = {
  str: (s: string) => string
  int: string
  float: string
  bool: string
  nul: string
  arr: string
  obj: string
  map: (pairs: [string, string][], x: ExampleInput) => string
  none: (op: string, x: ExampleInput) => string
  // Map.of rejects a null value.
  dropNull?: boolean
}


const C_RESERVED = new Set([
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
  'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'inline',
  'int', 'long', 'register', 'restrict', 'return', 'short', 'signed', 'sizeof',
  'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void',
  'volatile', 'while', 'bool', 'true', 'false',
])

const CPP_RESERVED = new Set([
  'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand', 'bitor',
  'bool', 'break', 'case', 'catch', 'char', 'char16_t', 'char32_t', 'class',
  'compl', 'const', 'constexpr', 'const_cast', 'continue', 'decltype',
  'default', 'delete', 'do', 'double', 'dynamic_cast', 'else', 'enum',
  'explicit', 'export', 'extern', 'false', 'float', 'for', 'friend', 'goto',
  'if', 'inline', 'int', 'long', 'mutable', 'namespace', 'new', 'noexcept',
  'not', 'not_eq', 'nullptr', 'operator', 'or', 'or_eq', 'private',
  'protected', 'public', 'register', 'reinterpret_cast', 'return', 'short',
  'signed', 'sizeof', 'static', 'static_assert', 'static_cast', 'struct',
  'switch', 'template', 'this', 'thread_local', 'throw', 'true', 'try',
  'typedef', 'typeid', 'typename', 'union', 'unsigned', 'using', 'virtual',
  'void', 'volatile', 'wchar_t', 'while', 'xor', 'xor_eq',
])

const RUST_RESERVED = new Set([
  'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn',
  'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in',
  'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return',
  'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type',
  'unsafe', 'use', 'where', 'while',
  'abstract', 'become', 'box', 'do', 'final', 'macro', 'override', 'priv',
  'try', 'typeof', 'unsized', 'virtual', 'yield',
])

// Methods every rust entity already has, which an accessor must not shadow.
const RUST_METHOD_RESERVED = new Set([
  'clone', 'new', 'default', 'drop', 'from', 'into', 'to_string',
  'as_ref', 'as_mut', 'borrow', 'borrow_mut', 'deref', 'deref_mut',
  'eq', 'ne', 'cmp', 'partial_cmp', 'hash', 'fmt', 'next', 'iter',
])

const ZIG_RESERVED = new Set([
  'addrspace', 'align', 'allowzero', 'and', 'anyframe', 'anytype', 'asm',
  'async', 'await', 'break', 'callconv', 'catch', 'comptime', 'const',
  'continue', 'defer', 'else', 'enum', 'errdefer', 'error', 'export',
  'extern', 'fn', 'for', 'if', 'inline', 'noalias', 'nosuspend', 'noinline',
  'opaque', 'or', 'orelse', 'packed', 'pub', 'resume', 'return',
  'linksection', 'struct', 'suspend', 'switch', 'test', 'threadlocal', 'try',
  'union', 'unreachable', 'usingnamespace', 'var', 'volatile', 'while',
])

const OCAML_RESERVED = new Set([
  'and', 'as', 'assert', 'asr', 'begin', 'class', 'constraint', 'do', 'done',
  'downto', 'else', 'end', 'exception', 'external', 'false', 'for', 'fun',
  'function', 'functor', 'if', 'in', 'include', 'inherit', 'initializer',
  'land', 'lazy', 'let', 'lor', 'lsl', 'lsr', 'lxor', 'match', 'method', 'mod',
  'module', 'mutable', 'new', 'nonrec', 'object', 'of', 'open', 'or', 'private',
  'rec', 'sig', 'struct', 'then', 'to', 'true', 'try', 'type', 'val', 'virtual',
  'when', 'while', 'with',
])

const JAVA_RESERVED = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'try', 'void', 'volatile', 'while',
  'true', 'false', 'null', 'var', 'record', 'yield',
])

const KOTLIN_RESERVED = new Set([
  'as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun',
  'if', 'in', 'interface', 'is', 'null', 'object', 'package', 'return',
  'super', 'this', 'throw', 'true', 'try', 'typealias', 'typeof', 'val',
  'var', 'when', 'while',
])

const SCALA_RESERVED = new Set([
  'abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'enum', 'export',
  'extends', 'false', 'final', 'finally', 'for', 'forSome', 'given', 'if',
  'implicit', 'import', 'lazy', 'match', 'new', 'null', 'object', 'override',
  'package', 'private', 'protected', 'return', 'sealed', 'super', 'then',
  'this', 'throw', 'trait', 'true', 'try', 'type', 'val', 'var', 'while',
  'with', 'yield',
])

const CS_RESERVED = new Set([
  'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch',
  'char', 'checked', 'class', 'const', 'continue', 'decimal', 'default',
  'delegate', 'do', 'double', 'else', 'enum', 'event', 'explicit',
  'extern', 'false', 'finally', 'fixed', 'float', 'for', 'foreach',
  'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is',
  'lock', 'long', 'namespace', 'new', 'null', 'object', 'operator',
  'out', 'override', 'params', 'private', 'protected', 'public',
  'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short', 'sizeof',
  'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw',
  'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe',
  'ushort', 'using', 'virtual', 'void', 'volatile', 'while',
])

const SWIFT_RESERVED = new Set([
  'associatedtype', 'class', 'deinit', 'enum', 'extension', 'fileprivate',
  'func', 'import', 'init', 'inout', 'internal', 'let', 'open', 'operator',
  'private', 'precedencegroup', 'protocol', 'public', 'rethrows', 'static',
  'struct', 'subscript', 'typealias', 'var', 'break', 'case', 'catch',
  'continue', 'default', 'defer', 'do', 'else', 'fallthrough', 'for', 'guard',
  'if', 'in', 'repeat', 'return', 'switch', 'where', 'while', 'as', 'false',
  'is', 'nil', 'self', 'super', 'throw', 'throws', 'true', 'try', 'any',
  'some', 'await', 'actor',
])

// The names the wording tables' own examples declare or are given, which an
// entity variable would shadow; zig refuses any shadowing outright.
const EXAMPLE_TAKEN = new Set(['client', 'err', 'result', 'sdk', 'std', 'h', 'e', 'i', 'item'])


function snake(name: string): string {
  return String(name).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
}

function lowerCamel(name: string): string {
  const pascal = camelify(name)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

function suffixed(name: string, reserved: Set<string>): string {
  return reserved.has(name) ? name + '_' : name
}

function cVarName(name: string): string {
  const s = snake(name)
  return suffixed(/^[0-9]/.test(s) ? '_' + s : s, C_RESERVED)
}

function rustVarName(name: string): string {
  const s = snake(name)
  return suffixed(/^[0-9]/.test(s) ? '_' + s : s, RUST_RESERVED)
}

function ocamlVarName(name: string): string {
  const s = snake(name)
  return suffixed('' === s || !/^[a-z_]/.test(s) ? '_' + s : s, OCAML_RESERVED)
}

function swiftVarName(name: string): string {
  const lower = lowerCamel(String(name).replace(/[^\p{L}\p{N}_]/gu, '_'))
  if (SWIFT_RESERVED.has(lower)) {
    return lower + '_'
  }
  return /^[0-9]/.test(lower) ? '_' + lower : lower
}


// Each language's own name for an entity variable and for its accessor.
const VAR_NAME: Record<CallLang, (name: string) => string> = {
  c: cVarName,
  clojure: (name) => name,
  cpp: (name) => suffixed(snake(name), CPP_RESERVED),
  csharp: (name) => suffixed(lowerCamel(name), CS_RESERVED),
  elixir: (name) => exampleVarName(name, 'elixir'),
  java: (name) => suffixed(lowerCamel(name), JAVA_RESERVED),
  kotlin: (name) => suffixed(lowerCamel(name), KOTLIN_RESERVED),
  ocaml: ocamlVarName,
  perl: (name) => camelify(name).toLowerCase(),
  rust: rustVarName,
  scala: (name) => suffixed(lowerCamel(name), SCALA_RESERVED),
  swift: swiftVarName,
  zig: (name) => suffixed(snake(name), ZIG_RESERVED),
}

function entityName(ent: any): string {
  return ent.Name || (ent.name[0].toUpperCase() + ent.name.slice(1))
}

const FACTORY: Record<CallLang, (x: ExampleInput) => string> = {
  c: (x) => String(x.model.name).toLowerCase().replace(/[^a-z0-9]/g, '') + '_' +
    cVarName(x.ent.name) + '(client, NULL)',
  clojure: (x) => `(api/${x.ent.name} client nil)`,
  cpp: (x) => `client->${VAR_NAME.cpp(x.ent.name)}()`,
  csharp: (x) => `client.${entityName(x.ent)}()`,
  elixir: (x) => `${x.model.const.Name}.${elixirAccessor(x.ent, entityCollection(x.model))}(sdk)`,
  java: (x) => `client.${VAR_NAME.java(x.ent.name)}(null)`,
  kotlin: (x) => `client.${VAR_NAME.kotlin(x.ent.name)}(null)`,
  ocaml: (x) => `(Sdk_client.${ocamlVarName(x.ent.name)} client Noval)`,
  perl: (x) => `$client->${entityName(x.ent)}`,
  rust: (x) => {
    const ident = rustVarName(x.ent.name)
    return `client.${suffixed(ident, RUST_METHOD_RESERVED)}(Value::Noval)`
  },
  scala: (x) => `client.${VAR_NAME.scala(x.ent.name)}(null)`,
  swift: (x) => `client.${entityName(x.ent)}()`,
  zig: (x) => `client.${VAR_NAME.zig(x.ent.name)}(h.vnull())`,
}


function cString(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

function ocamlString(s: string): string {
  let out = ''
  for (const c of s) {
    const code = c.charCodeAt(0)
    if ('\\' === c) out += '\\\\'
    else if ('"' === c) out += '\\"'
    else if ('\n' === c) out += '\\n'
    else if ('\r' === c) out += '\\r'
    else if ('\t' === c) out += '\\t'
    else if (code < 0x20) out += '\\' + String(code).padStart(3, '0')
    else out += c
  }
  return '"' + out + '"'
}

function swiftString(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"'
}

// `#` too: a double-quoted elixir string interpolates `#{...}`.
function elixirString(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/#/g, '\\#')
    .replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"'
}

function cljString(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r') + '"'
}

// A single-quoted perl string, so a `$` or `@` in it is never interpolated.
function perlString(s: string): string {
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}

// U+0085, U+2028 and U+2029 end a C# string literal.
function csString(s: string): string {
  return JSON.stringify(s).replace(/[\u0085\u2028\u2029]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
}

const jsonString = (s: string) => JSON.stringify(s)


const GRAMMAR: Record<CallLang, Grammar> = {
  c: {
    str: (s) => `v_str(${cString(s)})`, int: 'v_num(1)', float: 'v_num(1)',
    bool: 'v_bool(true)', nul: 'v_null()', arr: 'v_list()', obj: 'v_map()',
    map: (pairs) => `cmap(${pairs.length}, ${pairs.map(([k, v]) => `${cString(k)}, ${v}`).join(', ')})`,
    none: () => 'NULL',
  },
  clojure: {
    str: cljString, int: '1', float: '1', bool: 'true', nul: 'nil', arr: '(vs/jt)', obj: '(vs/jm)',
    map: (pairs) => `(vs/jm ${pairs.map(([k, v]) => `${cljString(k)} ${v}`).join(' ')})`,
    none: () => 'nil',
  },
  cpp: {
    str: (s) => `Value(${cString(s)})`, int: 'Value(1)', float: 'Value(1)',
    bool: 'Value(true)', nul: 'Value(nullptr)', arr: 'vlist()', obj: 'vmap()',
    map: (pairs) => `vmap({${pairs.map(([k, v]) => `{${cString(k)}, ${v}}`).join(', ')}})`,
    none: () => 'Value::undef()',
  },
  csharp: {
    str: csString, int: '1L', float: '1.0', bool: 'true', nul: 'null',
    arr: 'new List<object?>()', obj: 'new Dictionary<string, object?>()',
    map: (pairs) => `new Dictionary<string, object?> {${pairs.map(([k, v]) => ` [${csString(k)}] = ${v}`).join(',')} }`,
    none: () => 'null',
  },
  elixir: {
    str: elixirString, int: '1', float: '1', bool: 'true', nul: 'nil', arr: '[]', obj: '%{}',
    map: (pairs, x) => `${x.model.const.Name}.Helpers.deep(%{${pairs.map(([k, v]) => `${elixirString(k)} => ${v}`).join(', ')}})`,
    // list takes no match at all; the other ops take an empty one.
    none: (op, x) => 'list' === op ? '' : `${x.model.const.Name}.Helpers.deep(%{})`,
  },
  java: {
    str: jsonString, int: '1L', float: '1.0', bool: 'true', nul: 'null', arr: 'List.of()', obj: 'Map.of()',
    map: (pairs) => javaMapOf(pairs.map(([k, v]) => `${jsonString(k)}, ${v}`)),
    none: () => 'null',
    dropNull: true,
  },
  kotlin: {
    str: (s) => JSON.stringify(s).replace(/\$/g, '\\$'), int: '1L', float: '1.0', bool: 'true',
    nul: 'null', arr: 'listOf<Any?>()', obj: 'mapOf<String, Any?>()',
    map: (pairs) => `mutableMapOf<String, Any?>(${pairs.map(([k, v]) =>
      `${JSON.stringify(k).replace(/\$/g, '\\$')} to ${v}`).join(', ')})`,
    none: () => 'null',
  },
  ocaml: {
    str: (s) => `(Str ${ocamlString(s)})`, int: '(Num 1.)', float: '(Num 1.)', bool: '(Bool true)',
    nul: 'Null', arr: '(empty_list ())', obj: '(empty_map ())',
    map: (pairs) => `(jo [${pairs.map(([k, v]) => `(${ocamlString(k)}, ${v})`).join('; ')}])`,
    none: (op) => 'list' === op ? '(empty_map ())' : 'Noval',
  },
  perl: {
    str: perlString, int: '1', float: '1', bool: '1', nul: 'undef', arr: '[]', obj: '{}',
    map: (pairs) => `{ ${pairs.map(([k, v]) => `${perlString(k)} => ${v}`).join(', ')} }`,
    none: () => '',
  },
  rust: {
    str: (s) => `Value::str(${jsonString(s)})`, int: 'Value::Num(1.0)', float: 'Value::Num(1.0)',
    bool: 'Value::Bool(true)', nul: 'Value::Null', arr: 'Value::empty_list()', obj: 'Value::empty_map()',
    map: (pairs) => `jo(vec![${pairs.map(([k, v]) => `(${jsonString(k)}, ${v})`).join(', ')}])`,
    none: () => 'Value::Noval',
  },
  scala: {
    str: jsonString, int: '1L', float: '1.0', bool: 'true', nul: 'null',
    arr: 'java.util.List.of()', obj: 'java.util.Map.of()',
    map: (pairs) => javaMapOf(pairs.map(([k, v]) => `${jsonString(k)}, ${v}`), 'java.util.'),
    none: () => 'null',
    dropNull: true,
  },
  swift: {
    str: (s) => `.string(${swiftString(s)})`, int: '.int(1)', float: '.double(1.0)', bool: '.bool(true)',
    nul: '.null', arr: '.list([])', obj: '.map(VMap())',
    map: (pairs) => `VMap([${pairs.map(([k, v]) => `(${swiftString(k)}, ${v})`).join(', ')}])`,
    none: () => 'nil',
  },
  zig: {
    str: (s) => `h.vstr(${jsonString(s)})`, int: 'h.vnum(1)', float: 'h.vnum(1)', bool: 'h.vbool(true)',
    nul: 'h.vnull()', arr: 'h.olist()', obj: 'h.omap()',
    map: (pairs) => `h.jo(&.{${pairs.map(([k, v]) => `.{ ${jsonString(k)}, ${v} }`).join(', ')}})`,
    none: () => 'h.vnull()',
  },
}


// An id is numeric when its type is, and otherwise the string the ts row sends.
function valueFor(g: Grammar, it: ArgItem): string {
  const k = canonScalarKey(it.type)
  if (it.id) {
    return 'INTEGER' === k ? g.int : ('NUMBER' === k ? g.float : g.str('example_id'))
  }
  switch (k) {
    case 'NULL': return g.nul
    case 'INTEGER': return g.int
    case 'NUMBER': return g.float
    case 'BOOLEAN': return g.bool
    case 'ARRAY': return g.arr
    case 'OBJECT': return g.obj
    default: return g.str('example')
  }
}


function exampleParts(lang: CallLang, x: ExampleInput): ExampleParts {
  const g = GRAMMAR[lang]
  const items = exampleArgItems(x.ent, x.op, x.idF)
    .filter((it: ArgItem) => !g.dropNull || 'NULL' !== canonScalarKey(it.type))
  const v = VAR_NAME[lang](x.ent.name)
  return {
    v: EXAMPLE_TAKEN.has(v) ? v + '_' : v,
    factory: FACTORY[lang](x),
    arg: 0 === items.length ? g.none(x.op, x) :
      g.map(items.map((it: ArgItem) => [it.name, valueFor(g, it)]), x),
  }
}


export {
  exampleParts,
  entityName,
}

export type {
  CallLang,
  ExampleInput,
  ExampleParts,
}
