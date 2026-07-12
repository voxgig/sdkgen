
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
  formatCljValue,
  cljString,
  projectPath,
}
