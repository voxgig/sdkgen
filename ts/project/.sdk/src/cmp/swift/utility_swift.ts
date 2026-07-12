
import * as Path from 'node:path'

import {
  camelify,
} from '@voxgig/sdkgen'

import {
  clone,
  walk,
} from '@voxgig/struct'


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


// A lowerCamelCase Swift local-variable identifier for a snake_case model name
// (`planet_ref01` -> `planetRef01`). Swift keywords that are illegal as a plain
// binding get a trailing underscore.
function swiftVarName(name: string): string {
  const pascal = camelify(name)
  const lower = pascal.charAt(0).toLowerCase() + pascal.slice(1)
  return SWIFT_RESERVED.has(lower) ? lower + '_' : lower
}


// A PascalCase Swift identifier for a snake_case model name.
function swiftPascalName(name: string): string {
  return camelify(name)
}


// Swift keywords - illegal as a plain local-variable binding.
const SWIFT_RESERVED = new Set<string>([
  'associatedtype', 'class', 'deinit', 'enum', 'extension', 'fileprivate',
  'func', 'import', 'init', 'inout', 'internal', 'let', 'open', 'operator',
  'private', 'precedencegroup', 'protocol', 'public', 'rethrows', 'static',
  'struct', 'subscript', 'typealias', 'var', 'break', 'case', 'catch',
  'continue', 'default', 'defer', 'do', 'else', 'fallthrough', 'for', 'guard',
  'if', 'in', 'repeat', 'return', 'switch', 'where', 'while', 'as', 'false',
  'is', 'nil', 'self', 'super', 'throw', 'throws', 'true', 'try', 'any',
  'some', 'await', 'actor',
])


// Escape a string for a Swift double-quoted literal.
function swiftString(val: string): string {
  return '"' + val
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t') + '"'
}


// Strip model-internal keys (ending in `$`) from a cloned value graph.
function clean(o: any) {
  return walk(clone(o), (k: any, v: any, p: any) => {
    if (null != k && k.endsWith('$')) {
      delete p[k]
    }
    return v
  })
}


export {
  clean,
  projectPath,
  swiftPascalName,
  swiftVarName,
  swiftString,
}
