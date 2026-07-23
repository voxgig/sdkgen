
import {
  clone,
  walk,
} from '@voxgig/struct'


// C reserved keywords illegal as identifiers.
const C_RESERVED = new Set<string>([
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
  'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'inline',
  'int', 'long', 'register', 'restrict', 'return', 'short', 'signed', 'sizeof',
  'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void',
  'volatile', 'while', 'bool', 'true', 'false',
])


// A collision-free snake_case C identifier for a model name.
function cVarName(name: string): string {
  let snake = String(name).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
  if (/^[0-9]/.test(snake)) snake = '_' + snake
  return C_RESERVED.has(snake) ? snake + '_' : snake
}


// The C project identifier used as a function-name prefix, e.g. solar. Must
// match the SQUASHED `projectname` token that the umbrella header/fragment use
// for the constructor (`<ident>_sdk_new`): a hyphenated slug
// (bluefin-decryptx-p2pe) squashes to `bluefindecryptxp2pe`, so drop every
// non-alphanumeric char rather than mapping them to `_` (which produced
// `bluefin_decryptx_p2pe_sdk_new` callers that never linked against the
// squashed definition). No-op for single-word names.
function cIdent(model: any): string {
  return String(model.name).toLowerCase().replace(/[^a-z0-9]/g, '')
}


// Package-ish name (used in comments only), e.g. voxgig-solar-sdk.
function cName(model: any): string {
  const org = (model.origin || 'voxgig-sdk').replace(/-sdk$/, '')
  return `${org}-${model.name}-sdk`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}


// Render a JSON-shaped JS value as C source constructing the equivalent
// voxgig struct Value (the C twin of formatRustValue / formatGoMap). Uses
// the SDK helper builders declared in sdk.h: cmap / clist / v_str / v_num /
// v_bool / v_null.
function formatCValue(val: any, indent: number = 0): string {
  const pad = '  '.repeat(indent)
  const padInner = '  '.repeat(indent + 1)

  if (val === null || val === undefined) {
    return 'v_null()'
  }
  if (typeof val === 'string') {
    return `v_str(${JSON.stringify(val)})`
  }
  if (typeof val === 'number') {
    return `v_num(${Number.isFinite(val) ? val : 0})`
  }
  if (typeof val === 'boolean') {
    return `v_bool(${val})`
  }
  if (Array.isArray(val)) {
    if (val.length === 0) {
      return 'v_list()'
    }
    const items = val
      .map((v) => padInner + formatCValue(v, indent + 1))
      .join(',\n')
    return `clist(${val.length},\n${items})`
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val)
    if (entries.length === 0) {
      return 'v_map()'
    }
    const items = entries
      .map(
        ([k, v]) =>
          `${padInner}${JSON.stringify(k)}, ${formatCValue(v, indent + 1)}`
      )
      .join(',\n')
    return `cmap(${entries.length},\n${items})`
  }
  return `v_str(${JSON.stringify(String(val))})`
}


// Deep-remove meta keys (`foo$`) from a model subtree (twin of go/rust clean).
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
  cIdent,
  cName,
  cVarName,
  formatCValue,
}
