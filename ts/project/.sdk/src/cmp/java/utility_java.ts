
import * as Path from 'node:path'


import {
  camelify,
} from '@voxgig/sdkgen'

import {
  clone,
  walk,
} from '@voxgig/struct'


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


// The Java package root for the generated SDK, mirroring how the go target
// derives GOMODULE: org segment from model.origin, name segment from the
// model name (e.g. origin voxgig-sdk + name solardemo -> voxgig.solardemosdk).
// Each runtime piece lives under it: <pkg>.core, <pkg>.utility,
// <pkg>.utility.struct, <pkg>.feature, <pkg>.entity, <pkg>.sdktest.
function javaPackage(model: any): string {
  const org = String(model.origin || 'voxgig-sdk')
    .replace(/-sdk$/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  const name = String(model.name)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  return org + '.' + name + 'sdk'
}


// Maven coordinates for the generated SDK (used by Package_java).
function mavenGroupId(model: any): string {
  const org = String(model.origin || 'voxgig-sdk')
    .replace(/-sdk$/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  return 'com.' + org
}


const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'try', 'void', 'volatile', 'while',
  // contextual/literal words unusable as identifiers
  'true', 'false', 'null', 'var', 'record', 'yield',
])


// A camelCase Java identifier for a snake_case model name
// (`status_embed_config` -> `statusEmbedConfig`), with a reserved-word
// guard (a `new`/`class` entity must not bind a Java keyword).
function javaVarName(name: string): string {
  const pascal = camelify(name)
  const out = pascal.charAt(0).toLowerCase() + pascal.slice(1)
  return JAVA_KEYWORDS.has(out) ? out + '_' : out
}


// Strip model bookkeeping keys (ending in $) from a config subtree.
function cleanModel(o: any) {
  return walk(clone(o), (k: any, v: any, p: any) => {
    if (null != k && k.endsWith('$')) {
      delete p[k]
    }
    return v
  })
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


export {
  cleanModel,
  javaPackage,
  javaVarName,
  jsonAppendLines,
  mavenGroupId,
  projectPath,
}
