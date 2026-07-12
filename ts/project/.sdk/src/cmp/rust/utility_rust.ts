
import {
  clone,
  walk,
} from '@voxgig/struct'


// Rust keywords (strict + reserved) that are illegal as an identifier.
// sdkgen's shared safeVarName has no rust entry, so the guard lives here.
const RUST_RESERVED = new Set<string>([
  'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn',
  'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in',
  'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return',
  'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type',
  'unsafe', 'use', 'where', 'while',
  'abstract', 'become', 'box', 'do', 'final', 'macro', 'override', 'priv',
  'try', 'typeof', 'unsized', 'virtual', 'yield',
])


// A collision-free snake_case rust identifier for a model name.
function rustVarName(name: string): string {
  const snake = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
  return RUST_RESERVED.has(snake) ? snake + '_' : snake
}


// The Cargo package name, e.g. voxgig-solar-sdk (mirrors the go module
// naming: org prefix from model.origin).
function crateName(model: any): string {
  const org = (model.origin || 'voxgig-sdk').replace(/-sdk$/, '')
  return `${org}-${model.name}-sdk`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}


// The rust library (crate) identifier used in `use <crate>::...` paths,
// e.g. solar_sdk. This is the RUSTCRATE placeholder value.
function crateIdent(model: any): string {
  return `${model.name}_sdk`.toLowerCase().replace(/[^a-z0-9_]/g, '_')
}


// Render a JSON-shaped JS value as rust source constructing the equivalent
// voxgig struct Value (the rust twin of go's formatGoMap).
function formatRustValue(val: any, indent: number = 0): string {
  const pad = '    '.repeat(indent)
  const padInner = '    '.repeat(indent + 1)

  if (val === null || val === undefined) {
    return 'Value::Null'
  }
  if (typeof val === 'string') {
    return `Value::str(${JSON.stringify(val)})`
  }
  if (typeof val === 'number') {
    return `Value::Num(${Number.isInteger(val) ? val + 'f64' : String(val)})`
  }
  if (typeof val === 'boolean') {
    return `Value::Bool(${val})`
  }
  if (Array.isArray(val)) {
    if (val.length === 0) {
      return 'Value::empty_list()'
    }
    const items = val
      .map((v) => padInner + formatRustValue(v, indent + 1))
      .join(',\n')
    return `Value::list(vec![\n${items},\n${pad}])`
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val)
    if (entries.length === 0) {
      return 'Value::empty_map()'
    }
    const items = entries
      .map(
        ([k, v]) =>
          `${padInner}(${JSON.stringify(k)}.to_string(), ${formatRustValue(v, indent + 1)})`
      )
      .join(',\n')
    return `Value::map_of([\n${items},\n${pad}])`
  }
  return `Value::str(${JSON.stringify(String(val))})`
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
  crateIdent,
  crateName,
  formatRustValue,
  rustVarName,
}
