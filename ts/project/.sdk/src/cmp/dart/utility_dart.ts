
import * as Path from 'node:path'


import {
  clone,
  walk,
} from '@voxgig/struct'


// Escape a string for a single-quoted Dart string literal. `$` must be
// escaped or Dart interpolates it (model values like '`$COPY`' would break).
function dartString(s: string): string {
  return "'" + String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\$/g, '\\$')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t') + "'"
}


// Render a JSON-like value as a deep-dynamic Dart literal. Every map is
// emitted as `<String, dynamic>{...}` and every list as `<dynamic>[...]` so
// the runtime struct utilities can freely mutate/extend the structures
// (inferred literal types would be too narrow and throw at runtime).
function dartValue(obj: any, indent: number = 0): string {
  const pad = '  '.repeat(indent)
  const cpad = '  '.repeat(indent + 1)

  if (null == obj) {
    return 'null'
  }
  if ('string' === typeof obj) {
    return dartString(obj)
  }
  if ('number' === typeof obj) {
    return isFinite(obj) ? String(obj) : 'null'
  }
  if ('boolean' === typeof obj) {
    return obj ? 'true' : 'false'
  }
  if (Array.isArray(obj)) {
    if (0 === obj.length) {
      return '<dynamic>[]'
    }
    return '<dynamic>[\n' +
      obj.map(v => cpad + dartValue(v, indent + 1) + ',').join('\n') +
      '\n' + pad + ']'
  }
  if ('object' === typeof obj) {
    const keys = Object.keys(obj)
    if (0 === keys.length) {
      return '<String, dynamic>{}'
    }
    return '<String, dynamic>{\n' +
      keys.map(k => cpad + dartString(k) + ': ' + dartValue(obj[k], indent + 1) + ',')
        .join('\n') +
      '\n' + pad + '}'
  }
  return 'null'
}


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


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
  dartString,
  dartValue,
  projectPath,
}
