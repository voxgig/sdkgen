
import {
  clone,
  walk,
} from '@voxgig/struct'


// C++ reserved words illegal as identifiers.
const CPP_RESERVED = new Set<string>([
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


// A collision-free snake_case C++ identifier for a model name.
function cppVarName(name: string): string {
  const snake = String(name).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
  return CPP_RESERVED.has(snake) ? snake + '_' : snake
}


// Deep-remove meta keys (`foo$`) from a model subtree.
function cleanModel(o: any) {
  return walk(clone(o), (k: any, v: any, p: any) => {
    if (null != k && k.endsWith('$')) {
      delete p[k]
    }
    return v
  })
}


// Escape a string for embedding inside a C++ double-quoted string literal.
function cppEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}


// Render a JSON-able config value as a sequence of adjacent C++ string
// literals (compact JSON, chunked so no single literal is unreasonably
// large), parsed at runtime by the vendored struct JSON parser. Byte-stable.
function cppConfigLiterals(value: any): string {
  const json = JSON.stringify(value)
  const escaped = cppEscape(json)
  const CHUNK = 2000
  const parts: string[] = []
  let i = 0
  while (i < escaped.length) {
    let end = Math.min(i + CHUNK, escaped.length)
    // Never split in the middle of a `\x` escape: back off if the chunk would
    // end on an odd run of trailing backslashes (the last escapes the next char).
    if (end < escaped.length) {
      let bs = 0
      let j = end - 1
      while (j >= i && escaped[j] === '\\') { bs++; j-- }
      if (bs % 2 === 1) end--
    }
    parts.push('    "' + escaped.slice(i, end) + '"')
    i = end
  }
  if (parts.length === 0) {
    return '    ""'
  }
  return parts.join('\n')
}


export {
  cleanModel,
  cppConfigLiterals,
  cppEscape,
  cppVarName,
}
