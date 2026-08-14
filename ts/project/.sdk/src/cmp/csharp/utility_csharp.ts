
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


// A number as a C# literal whose BOXED TYPE is predictable.
//
// C# gives an unsuffixed integer literal the first type of int/uint/long/ulong
// that fits it, so `3000000000` boxes as uint while `5` boxes as int and
// `5000000000` as long. Boxed numerics compare by exact type - (object)5L does
// not Equals (object)5 - so the type a config number lands with is observable
// to every consumer, and the L1 data branch has to be able to reproduce it.
// Reproducing a uint band nothing else in the SDK ever produces is not worth
// it, so the suffix is made explicit instead and the ladder is just int -> long
// -> double, which SdkConfig.ConfigValue mirrors exactly.
//
// int.MinValue and long.MinValue are written by name: `-2147483648` parses as
// unary minus applied to a literal that does not itself fit in an int, and
// relying on the special case for that is needless subtlety.
//
// The upper bound is EXCLUSIVE and expressed as 2^63, not as long.MaxValue,
// because long.MaxValue is not representable as a JS number - it rounds up to
// 2^63, so `val <= 9223372036854775807` is true for a value the C# compiler
// rejects as too large for a long and that TryGetInt64 also refuses. Both
// branches have to fall to double at the same place.
//
// A non-finite value emits `null`, because that is what JSON.stringify does
// with it - so the two representations still agree.
const CS_INT_MIN = -2147483648
const CS_INT_MAX = 2147483647
const CS_LONG_MIN = -9223372036854775808
const CS_LONG_LIMIT = 9223372036854775808

function formatCsNumber(val: number): string {
  if (!Number.isFinite(val)) {
    return 'null'
  }
  if (Number.isInteger(val)) {
    if (CS_INT_MIN === val) {
      return 'int.MinValue'
    }
    if (CS_INT_MIN < val && val <= CS_INT_MAX) {
      return String(val)
    }
    if (CS_LONG_MIN === val) {
      return 'long.MinValue'
    }
    if (CS_LONG_MIN < val && val < CS_LONG_LIMIT) {
      return String(val) + 'L'
    }
  }
  // Fractional, or too large for a long: a double literal. The `D` suffix is
  // required for the whole-valued case, where the digits alone would be read
  // as an integer literal (and rejected as too large).
  return String(val) + 'D'
}


function formatCsValue(val: any, indent: number = 0): string {
  if (val === null || val === undefined) {
    return 'null'
  }
  if (typeof val === 'string') {
    return formatCsString(val)
  }
  if (typeof val === 'number') {
    return formatCsNumber(val)
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
// jostraca's iteration metadata, injected by each()/names() while it walks the
// model. Listed explicitly rather than matched by trailing-dollar suffix: a
// trailing dollar is not exclusive to jostraca -- Seneca uses entity$ as real
// data -- so a blanket suffix match can silently drop a legitimate API field.
const MODEL_META = ['index$', 'key$', 'val$']

// Keys whose value IS the default the runtime already assumes when the key is
// absent, so emitting them is pure payload.
const CONFIG_DEFAULT: Record<string, any> = {
  active: true,
  req: false,
  reqd: false,
}

// Subtrees carrying user payload rather than schema. An active:true inside an
// OpenAPI example is DATA, not a default, so default-pruning stops at these
// keys and everything below them is passed through untouched.
const PAYLOAD_KEYS = ['default', 'example', 'examples']

function clean(o: any, dropDefaults?: boolean): any {
  const prune = (node: any, defaults: boolean): any => {
    if (Array.isArray(node)) {
      return node.map((n: any) => prune(n, defaults))
    }
    if (null != node && 'object' === typeof node) {
      const out: any = {}
      for (const k of Object.keys(node)) {
        if (MODEL_META.includes(k)) {
          continue
        }
        if (defaults && k in CONFIG_DEFAULT && CONFIG_DEFAULT[k] === node[k]) {
          continue
        }
        out[k] = prune(node[k], defaults && !PAYLOAD_KEYS.includes(k))
      }
      return out
    }
    return node
  }
  return prune(o, true === dropDefaults)
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
