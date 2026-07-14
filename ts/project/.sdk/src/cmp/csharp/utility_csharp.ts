
import * as Path from 'node:path'


import {
  camelify,
  each,
  safeVarName,
} from '@voxgig/sdkgen'

import {
  clone,
  walk,
} from '@voxgig/struct'


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


// A camelCase C# local-variable identifier for a snake_case model name
// (`status_embed_config` -> `statusEmbedConfig`). C# contextual keywords
// that are illegal as locals get the shared reserved-word guard (js set is
// the closest match for C#'s expression keywords like `new`/`this`).
function csVarName(name: string): string {
  const pascal = camelify(name)
  const lower = pascal.charAt(0).toLowerCase() + pascal.slice(1)
  return CS_RESERVED.has(lower) ? lower + '_' : lower
}


// A PascalCase C# identifier for a snake_case model name.
function csPascalName(name: string): string {
  return camelify(name)
}


// C# keywords - illegal as a plain local-variable binding.
const CS_RESERVED = new Set<string>([
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


// Render a plain JSON-like value as a C# collection-literal expression in
// the SDK's loose object model: maps -> new Dictionary<string, object?>,
// lists -> new List<object?>, scalars -> literals.
function formatCsMap(obj: any, indent: number = 0): string {
  if (obj == null) {
    return 'null'
  }

  const pad = '    '.repeat(indent)
  const padInner = '    '.repeat(indent + 1)

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return 'new List<object?>()'
    }
    const items = obj.map(v => padInner + formatCsValue(v, indent + 1)).join(',\n')
    return `new List<object?>\n${pad}{\n${items},\n${pad}}`
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj)
    if (entries.length === 0) {
      return 'new Dictionary<string, object?>()'
    }
    const items = entries
      .map(([k, v]) => `${padInner}[${formatCsString(k)}] = ${formatCsValue(v, indent + 1)}`)
      .join(',\n')
    return `new Dictionary<string, object?>\n${pad}{\n${items},\n${pad}}`
  }

  return formatCsValue(obj, indent)
}


function formatCsString(val: string): string {
  return '"' + val
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t') + '"'
}


function formatCsValue(val: any, indent: number = 0): string {
  if (val === null || val === undefined) {
    return 'null'
  }
  if (typeof val === 'string') {
    return formatCsString(val)
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return String(val)
    }
    return String(val)
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false'
  }
  if (Array.isArray(val)) {
    return formatCsMap(val, indent)
  }
  if (typeof val === 'object') {
    return formatCsMap(val, indent)
  }
  return String(val)
}


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
  csPascalName,
  csVarName,
  formatCsMap,
  formatCsValue,
  formatCsString,
  projectPath,
}
