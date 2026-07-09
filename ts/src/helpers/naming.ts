// Reserved-word sanitiser for generated doc-example variable names.
//
// A doc example binds a variable named after the lowercased entity name
// (e.g. `const delete = await client.Delete().load()`). When that name is a
// reserved word in the target language the snippet does not compile
// (TS1109/TS1389 for `delete`). `safeVarName` appends `_` to any reserved
// name so the example still reads clearly and compiles.
//
// Only languages whose build/vet actually rejects the name are listed. JS and
// TS share the ECMAScript reserved set (plus the strict-mode / contextual
// words a `const` binding trips on). Go lists its 25 keywords — a var named
// `type`/`func`/`range` fails `go build`; Go builtins like `delete`/`len` are
// NOT keywords and are legal identifiers, so they are intentionally omitted.
// rb/py/lua list the keywords that are illegal as a local-variable binding
// (e.g. a `Self` entity -> `self = client.Self` is a Ruby SyntaxError, an
// `End` entity -> `end = ...` a Lua one). PHP variables are `$`-prefixed so a
// lowercased entity name never collides (only `$this` is special, and no
// entity is named `this`), so PHP is not treated.

const JS_RESERVED = new Set<string>([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
  'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try',
  'typeof', 'var', 'void', 'while', 'with', 'yield',
  // strict-mode / contextual words that are invalid as a `const`/`let` binding
  'await', 'implements', 'interface', 'let', 'package', 'private',
  'protected', 'public', 'static',
])

const GO_RESERVED = new Set<string>([
  'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
  'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface',
  'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type',
  'var',
])

// Ruby keywords — illegal as a local-variable name (e.g. `self`, `end`).
const RB_RESERVED = new Set<string>([
  'alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined?',
  'do', 'else', 'elsif', 'end', 'ensure', 'false', 'for', 'if', 'in',
  'module', 'next', 'nil', 'not', 'or', 'redo', 'rescue', 'retry', 'return',
  'self', 'super', 'then', 'true', 'undef', 'unless', 'until', 'when',
  'while', 'yield', '__FILE__', '__LINE__', '__ENCODING__', 'BEGIN', 'END',
])

// Python keywords — illegal as a variable name.
const PY_RESERVED = new Set<string>([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
])

// Lua keywords — illegal as a variable name. (`self` is NOT reserved in Lua.)
const LUA_RESERVED = new Set<string>([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while',
])

const RESERVED: Record<string, Set<string>> = {
  ts: JS_RESERVED,
  js: JS_RESERVED,
  go: GO_RESERVED,
  rb: RB_RESERVED,
  py: PY_RESERVED,
  lua: LUA_RESERVED,
}


// Is `name` a reserved word (an illegal identifier) in the target language?
function isReservedName(name: string, lang: string): boolean {
  const set = RESERVED[lang]
  return !!set && set.has(name)
}


// A collision-free variable name for the target language: the name unchanged
// unless it is reserved, in which case a trailing `_` is appended.
function safeVarName(name: string, lang: string): string {
  return isReservedName(name, lang) ? name + '_' : name
}


export {
  isReservedName,
  safeVarName,
}
