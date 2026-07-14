
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
  formatZigValue,
  zigModuleName,
  zigVarName,
}
