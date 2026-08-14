
import {
  clone,
  walk,
} from '@voxgig/struct'


// Zig keywords that are illegal as a plain identifier.
const ZIG_RESERVED = new Set<string>([
  'addrspace', 'align', 'allowzero', 'and', 'anyframe', 'anytype', 'asm',
  'async', 'await', 'break', 'callconv', 'catch', 'comptime', 'const',
  'continue', 'defer', 'else', 'enum', 'errdefer', 'error', 'export',
  'extern', 'fn', 'for', 'if', 'inline', 'noalias', 'nosuspend', 'noinline',
  'opaque', 'or', 'orelse', 'packed', 'pub', 'resume', 'return',
  'linksection', 'struct', 'suspend', 'switch', 'test', 'threadlocal', 'try',
  'union', 'unreachable', 'usingnamespace', 'var', 'volatile', 'while',
])


// A collision-free snake_case zig identifier for a model name.
function zigVarName(name: string): string {
  const snake = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
  return ZIG_RESERVED.has(snake) ? snake + '_' : snake
}


// The zig module identifier, e.g. solar_sdk (informational; the build module
// is named "sdk").
function zigModuleName(model: any): string {
  return `${model.name}_sdk`.toLowerCase().replace(/[^a-z0-9_]/g, '_')
}


// Render a JSON-shaped JS value as zig source constructing the equivalent
// voxgig struct Value via the `h` (helpers) namespace. Byte-stable (each()
// sorted-key iteration upstream).
function formatZigValue(val: any, indent: number = 0): string {
  const pad = '    '.repeat(indent)
  const padInner = '    '.repeat(indent + 1)

  if (val === null || val === undefined) {
    return 'h.vnull()'
  }
  if (typeof val === 'string') {
    return `h.vstr(${JSON.stringify(val)})`
  }
  if (typeof val === 'number') {
    return Number.isInteger(val) ? `h.vnum(${val})` : `h.vfloat(${val})`
  }
  if (typeof val === 'boolean') {
    return `h.vbool(${val})`
  }
  if (Array.isArray(val)) {
    if (val.length === 0) {
      return 'h.olist()'
    }
    const items = val
      .map((v) => padInner + formatZigValue(v, indent + 1))
      .join(',\n')
    return `h.ja(&.{\n${items},\n${pad}})`
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val)
    if (entries.length === 0) {
      return 'h.omap()'
    }
    const items = entries
      .map(
        ([k, v]) =>
          `${padInner}.{ ${JSON.stringify(k)}, ${formatZigValue(v, indent + 1)} }`
      )
      .join(',\n')
    return `h.jo(&.{\n${items},\n${pad}})`
  }
  return `h.vstr(${JSON.stringify(String(val))})`
}


// Deep-remove meta keys (`foo$`) from a model subtree (twin of go's clean).
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
  formatZigValue,
  zigModuleName,
  zigVarName,
}
