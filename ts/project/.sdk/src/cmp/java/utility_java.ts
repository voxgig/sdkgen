
import * as Path from 'node:path'


import {
  camelify,
  canonScalarKey,
  requiredItems,
  javaMapOf,
  javaMapItems,
  fact,
} from '@voxgig/sdkgen'

import { KIT } from '@voxgig/apidef'

import {
  clone,
  walk,
} from '@voxgig/struct'


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


// The Java package root, the project's JVM package fact. Each runtime piece
// lives under it: <pkg>.core, <pkg>.utility, <pkg>.utility.struct,
// <pkg>.feature, <pkg>.entity, <pkg>.sdktest.
function javaPackage(model: any): string {
  return fact(model.main[KIT], 'package').jvm
}


const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'try', 'void', 'volatile', 'while',
  'true', 'false', 'null', 'var', 'record', 'yield',
])


function javaVarName(name: string): string {
  const pascal = camelify(name)
  const out = pascal.charAt(0).toLowerCase() + pascal.slice(1)
  return JAVA_KEYWORDS.has(out) ? out + '_' : out
}


const MODEL_META = ['index$', 'key$', 'val$']

const CONFIG_DEFAULT: Record<string, any> = {
  active: true,
  req: false,
  reqd: false,
}

const PAYLOAD_KEYS = ['default', 'example', 'examples']

function cleanModel(o: any, dropDefaults?: boolean): any {
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


// Render a JSON-able value as Java source that rebuilds it via a
// StringBuilder of JSON chunks (parsed at runtime by utility/Json.java).
// Each line becomes its own append so no single string constant can
// approach the 64KB class-file limit however large the API model gets.
function jsonAppendLines(value: any, bufname: string): string {
  const json = JSON.stringify(value, null, 1)
  return json
    .split('\n')
    .map((line) =>
      `    ${bufname}.append(${JSON.stringify(line)});\n`)
    .join('')
}

// javaMapItems leaves a null-only member out of Map.of, which rejects a null.
function javaLit(type: any, placeholder: string = 'example'): string {
  const k = canonScalarKey(type)
  if ('NULL' === k) return 'null'
  if ('INTEGER' === k) return '1L'
  if ('NUMBER' === k) return '1.0'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k) return 'List.of()'
  if ('OBJECT' === k) return 'Map.of()'
  return JSON.stringify(placeholder)
}


// A list's required parameters as its match.
function javaListMatch(entity: any): string {
  const items = javaMapItems(requiredItems(entity, 'list'))
  return 0 < items.length
    ? javaMapOf(items.map((it: any) => `${JSON.stringify(it.name)}, ${javaLit(it.type)}`))
    : 'null'
}


export {
  javaLit,
  javaListMatch,
  cleanModel,
  javaPackage,
  javaVarName,
  jsonAppendLines,
  projectPath,
}
