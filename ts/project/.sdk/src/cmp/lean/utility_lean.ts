import * as Path from 'node:path'

import {
  clone,
  walk,
} from '@voxgig/struct'


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


// A Lean 4 string literal. Lean strings are UTF-8, so non-ASCII passes through;
// only the structural characters need escaping. (Backticks are ordinary in Lean
// strings, so the config's `body`-style transform exprs embed verbatim.)
function leanString(s: string): string {
  let out = '"'
  for (const ch of String(s)) {
    if (ch === '"') out += '\\"'
    else if (ch === '\\') out += '\\\\'
    else if (ch === '\n') out += '\\n'
    else if (ch === '\t') out += '\\t'
    else if (ch === '\r') out += '\\r'
    else out += ch
  }
  return out + '"'
}


// Lean reserved words that cannot be bare identifiers.
const LEAN_RESERVED = new Set<string>([
  'do', 'let', 'fun', 'match', 'with', 'if', 'then', 'else', 'by', 'end',
  'namespace', 'section', 'open', 'import', 'def', 'partial', 'mutual',
  'structure', 'inductive', 'class', 'instance', 'where', 'deriving', 'return',
  'try', 'catch', 'for', 'in', 'while', 'have', 'show', 'from', 'set_option',
])


// A collision-free lower-camel Lean identifier for a model name.
function leanVarName(name: string): string {
  let s = String(name).replace(/[^a-zA-Z0-9_]/g, '_')
  if (s.length === 0) {
    s = 'x'
  }
  s = s.charAt(0).toLowerCase() + s.slice(1)
  if (!/^[a-z_]/.test(s)) {
    s = 'e_' + s
  }
  return LEAN_RESERVED.has(s) ? s + '_' : s
}


// The lowercase-hyphenated package name (used for the lake package + repo).
function pkgName(model: any): string {
  const org = (model.origin || 'voxgig-sdk').replace(/-sdk$/, '')
  return `${org}-${model.name}-sdk`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}


// Remove `$`-suffixed model annotation keys (so the embedded config is clean).
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
  leanString,
  leanVarName,
  pkgName,
  projectPath,
}
