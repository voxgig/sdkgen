
import * as Path from 'node:path'

import {
  clone,
  walk,
} from '@voxgig/struct'

import {
  canonKey,
  canonToType,
} from '@voxgig/sdkgen'


// Map a canonical type sentinel ($STRING, $INTEGER, ...) to an idiomatic
// Elixir typespec. Unknown/missing sentinels fall back to `any()` (never
// throws). Thin delegate to the SHARED canonToType 'elixir' column (the
// single source of truth per language — do not keep a local table here);
// kept as an exported function so existing importers keep working.
function elixirType(sentinel: unknown): string {
  return canonToType(sentinel, 'elixir')
}


// A type-correct, executable Elixir literal for a field/param of the given
// canonical type. Strings render the quoted placeholder; numeric/boolean/
// collection types render a real literal so example blocks parse and run.
function elixirLit(sentinel: unknown, placeholder: string = 'example'): string {
  switch (canonKey(sentinel)) {
    case 'INTEGER':
    case 'NUMBER': return '1'
    case 'BOOLEAN': return 'true'
    case 'ARRAY': return '[]'
    case 'OBJECT': return '%{}'
    default: return `"${placeholder}"`
  }
}


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


// Render a JS value as an Elixir literal term (maps -> %{"k" => v}, lists ->
// [..], strings -> "..", booleans -> true/false, null -> nil). The result is
// fed to ProjectName.Helpers.deep/1 at runtime, which lifts native terms
// into the vendored struct's node representation.
function formatElixir(obj: any, indent: number = 0): string {
  const pad = '  '.repeat(indent)
  const padInner = '  '.repeat(indent + 1)

  if (obj === null || obj === undefined) {
    return 'nil'
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]'
    }
    const items = obj.map(v => padInner + formatElixir(v, indent + 1)).join(',\n')
    return `[\n${items}\n${pad}]`
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj)
    if (entries.length === 0) {
      return '%{}'
    }
    const items = entries
      .map(([k, v]) => `${padInner}${elixirString(k)} => ${formatElixir(v, indent + 1)}`)
      .join(',\n')
    return `%{\n${items}\n${pad}}`
  }

  if (typeof obj === 'string') {
    return elixirString(obj)
  }
  if (typeof obj === 'number') {
    return String(obj)
  }
  if (typeof obj === 'boolean') {
    return obj ? 'true' : 'false'
  }

  return elixirString(String(obj))
}


function elixirString(s: string): string {
  return '"' + String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    + '"'
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
  formatElixir,
  elixirString,
  elixirType,
  elixirLit,
  projectPath,
}
