
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


// The Scala package root for the generated SDK, mirroring how the go target
// derives GOMODULE and the java target derives its package: org segment from
// model.origin, name segment from the model name (e.g. origin voxgig-sdk +
// name solardemo -> voxgig.solardemosdk). Each runtime piece lives under it:
// <pkg>.core, <pkg>.utility, <pkg>.utility.struct, <pkg>.feature,
// <pkg>.entity, <pkg>.sdktest.
function scalaPackage(model: any): string {
  const org = String(model.origin || 'voxgig-sdk')
    .replace(/-sdk$/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  const name = String(model.name)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  return org + '.' + name + 'sdk'
}


// Maven-style coordinates (used by Package_scala for the publish metadata).
function mavenGroupId(model: any): string {
  const org = String(model.origin || 'voxgig-sdk')
    .replace(/-sdk$/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  return 'com.' + org
}


const SCALA_KEYWORDS = new Set([
  'abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'enum', 'export',
  'extends', 'false', 'final', 'finally', 'for', 'forSome', 'given', 'if',
  'implicit', 'import', 'lazy', 'match', 'new', 'null', 'object', 'override',
  'package', 'private', 'protected', 'return', 'sealed', 'super', 'then',
  'this', 'throw', 'trait', 'true', 'try', 'type', 'val', 'var', 'while',
  'with', 'yield',
])


// A camelCase Scala identifier for a snake_case model name
// (`status_embed_config` -> `statusEmbedConfig`), with a reserved-word guard.
function scalaVarName(name: string): string {
  const pascal = camelify(name)
  const out = pascal.charAt(0).toLowerCase() + pascal.slice(1)
  return SCALA_KEYWORDS.has(out) ? out + '_' : out
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


// Render a JSON-able value as Scala source that rebuilds it via a
// StringBuilder of JSON chunks (parsed at runtime by utility/Json.java).
// Each line becomes its own append so no single string constant can approach
// the JVM 64KB class-file limit however large the API model gets.
function jsonAppendLines(value: any, bufname: string): string {
  const json = JSON.stringify(value, null, 1)
  return json
    .split('\n')
    .map((line) =>
      `    ${bufname}.append(${JSON.stringify(line)})\n`)
    .join('')
}


export {
  cleanModel,
  mavenGroupId,
  jsonAppendLines,
  projectPath,
  scalaPackage,
  scalaVarName,
}
