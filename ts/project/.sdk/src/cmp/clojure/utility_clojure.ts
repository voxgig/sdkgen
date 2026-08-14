
import * as Path from 'node:path'

import {
  clone,
  walk,
} from '@voxgig/struct'


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


// Render a JSON-shaped value as Clojure source that builds the equivalent
// vendored-struct value node: maps -> (vs/jm "k" v ...), arrays -> (vs/jt v
// ...), scalars -> literals. Keys are emitted in sorted order for byte-stable
// output. Empty map/array render as (vs/jm) / (vs/jt), so the result is valid
// for 0, 1 or N entries (N-feature-safe).
function formatCljValue(val: any, indent: number = 0): string {
  if (val === null || val === undefined) {
    return 'nil'
  }
  if (typeof val === 'string') {
    return cljString(val)
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : '0'
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false'
  }
  if (Array.isArray(val)) {
    if (val.length === 0) {
      return '(vs/jt)'
    }
    const pad = '  '.repeat(indent + 1)
    const items = val.map(v => pad + formatCljValue(v, indent + 1)).join('\n')
    return `(vs/jt\n${items})`
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val).sort()
    if (keys.length === 0) {
      return '(vs/jm)'
    }
    const pad = '  '.repeat(indent + 1)
    const items = keys
      .map(k => `${pad}${cljString(k)} ${formatCljValue(val[k], indent + 1)}`)
      .join('\n')
    return `(vs/jm\n${items})`
  }
  return 'nil'
}


function cljString(s: string): string {
  return '"' + String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r') + '"'
}


// Remove `$`-suffixed model annotation keys (mirrors utility_rb.clean).
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
  formatCljValue,
  cljString,
  projectPath,
}
