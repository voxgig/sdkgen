import * as Path from 'node:path'

import {
  clone,
  walk,
} from '@voxgig/struct'


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


// Haskell reserved words that cannot be used as identifiers.
const HS_RESERVED = new Set<string>([
  'case', 'class', 'data', 'default', 'deriving', 'do', 'else', 'foreign',
  'if', 'import', 'in', 'infix', 'infixl', 'infixr', 'instance', 'let',
  'module', 'newtype', 'of', 'then', 'type', 'where', 'as', 'hiding',
  'qualified',
])


// A collision-free lower-camel Haskell identifier for a model name.
function hsVarName(name: string): string {
  let s = String(name).replace(/[^a-zA-Z0-9_]/g, '_')
  if (s.length === 0) {
    s = 'x'
  }
  // Identifiers must start with a lowercase letter.
  s = s.charAt(0).toLowerCase() + s.slice(1)
  if (!/^[a-z_]/.test(s)) {
    s = 'e_' + s
  }
  return HS_RESERVED.has(s) ? s + '_' : s
}


// A Haskell string literal (7-bit safe: non-printable / non-ASCII use the
// decimal numeric escape with a `\&` separator so digits never merge).
function hsString(s: string): string {
  let out = '"'
  for (const ch of String(s)) {
    const code = ch.codePointAt(0) as number
    if (ch === '"') out += '\\"'
    else if (ch === '\\') out += '\\\\'
    else if (ch === '\n') out += '\\n'
    else if (ch === '\t') out += '\\t'
    else if (ch === '\r') out += '\\r'
    else if (code >= 32 && code < 127) out += ch
    else out += '\\' + code + '\\&'
  }
  return out + '"'
}


// Render a JSON-shaped value as a Haskell `CV` literal (the generated
// SdkConfig realises it with buildCV). Keys sorted for byte-stable output;
// empty map/list render as (CVMap []) / (CVList []) — valid for 0, 1 or N
// entries (N-feature-safe).
function formatHsValue(val: any): string {
  if (val === null || val === undefined) {
    return 'CVNull'
  }
  if (typeof val === 'string') {
    return '(CVStr ' + hsString(val) + ')'
  }
  if (typeof val === 'number') {
    return '(CVNum (' + (Number.isFinite(val) ? String(val) : '0') + '))'
  }
  if (typeof val === 'boolean') {
    return '(CVBool ' + (val ? 'True' : 'False') + ')'
  }
  if (Array.isArray(val)) {
    const items = val.map((v) => formatHsValue(v)).join(', ')
    return '(CVList [' + items + '])'
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val).sort()
    const items = keys
      .map((k) => '(' + hsString(k) + ', ' + formatHsValue(val[k]) + ')')
      .join(', ')
    return '(CVMap [' + items + '])'
  }
  return 'CVNull'
}


// Remove `$`-suffixed model annotation keys.
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
  formatHsValue,
  hsString,
  hsVarName,
  projectPath,
}
