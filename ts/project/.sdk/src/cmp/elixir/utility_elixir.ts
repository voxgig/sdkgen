
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


// Emission-time normalisation of a model subtree (L0).
//
// Always drops jostraca's iteration metadata (`$`-suffixed keys: index$,
// key$, val$). With `dropDefaults`, also drops keys whose value IS the
// default the runtime already assumes when the key is absent, which is pure
// payload — see CONFIG_DEFAULT.
//
// Rebuilds the tree rather than mutating during a walk. The previous
// implementation walked a clone calling `delete p[k]`, but walk() assigns its
// callback's result back over the child (`setprop(out, ckey, walk(...))`), so
// the delete was undone on the way out and the helper silently did nothing.
// Returning `undefined` from the callback does not fix it either: setprop
// stores undefined rather than removing the key, which then emits as a null.
//
// `dropDefaults` is opt-in and must be passed ONLY for the entity subtree.
// `active` means something different in feature config, where absent reads as
// INACTIVE (see feature_init) — dropping `active: true` there would silently
// disable the feature.
const CONFIG_DEFAULT: Record<string, any> = {
  active: true,
  req: false,
  reqd: false,
}

function clean(o: any, dropDefaults?: boolean): any {
  const prune = (node: any): any => {
    if (Array.isArray(node)) {
      return node.map(prune)
    }
    if (null != node && 'object' === typeof node) {
      const out: any = {}
      for (const k of Object.keys(node)) {
        if (k.endsWith('$')) {
          continue
        }
        if (true === dropDefaults &&
          k in CONFIG_DEFAULT && CONFIG_DEFAULT[k] === node[k]) {
          continue
        }
        out[k] = prune(node[k])
      }
      return out
    }
    return node
  }
  return prune(o)
}


export {
  clean,
  formatElixir,
  elixirString,
  elixirType,
  elixirLit,
  projectPath,
}
