
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


// The Kotlin package root for the generated SDK, mirroring how the go target
// derives GOMODULE: org segment from model.origin, name segment from the
// model name (e.g. origin voxgig-sdk + name solardemo -> voxgig.solardemosdk).
// Each runtime piece lives under it: <pkg>.core, <pkg>.utility,
// <pkg>.utility.struct, <pkg>.feature, <pkg>.entity, <pkg>.sdktest.
function kotlinPackage(model: any): string {
  const org = String(model.origin || 'voxgig-sdk')
    .replace(/-sdk$/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  const name = String(model.name)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  return org + '.' + name + 'sdk'
}


// Maven/Gradle group coordinates for the generated SDK (used by Package_kotlin).
function gradleGroup(model: any): string {
  const org = String(model.origin || 'voxgig-sdk')
    .replace(/-sdk$/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  return 'com.' + org
}


const KOTLIN_KEYWORDS = new Set([
  // hard keywords
  'as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun',
  'if', 'in', 'interface', 'is', 'null', 'object', 'package', 'return',
  'super', 'this', 'throw', 'true', 'try', 'typealias', 'typeof', 'val',
  'var', 'when', 'while',
])


// A camelCase Kotlin identifier for a snake_case model name
// (`status_embed_config` -> `statusEmbedConfig`), with a reserved-word
// guard (a `fun`/`class` entity must not bind a Kotlin keyword).
function kotlinVarName(name: string): string {
  const pascal = camelify(name)
  const out = pascal.charAt(0).toLowerCase() + pascal.slice(1)
  return KOTLIN_KEYWORDS.has(out) ? out + '_' : out
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


// Render a JSON-able value as Kotlin source that rebuilds it via a
// StringBuilder of JSON chunks (parsed at runtime by utility/Json.kt). Each
// line becomes its own append so no single string constant can approach the
// 64KB class-file limit. `$` is escaped as `\$` because Kotlin string
// literals treat `$` as a template-expression introducer.
function jsonAppendLines(value: any, bufname: string): string {
  const json = JSON.stringify(value, null, 1)
  return json
    .split('\n')
    .map((line) => {
      const lit = JSON.stringify(line).replace(/\$/g, '\\$')
      return `    ${bufname}.append(${lit})\n`
    })
    .join('')
}


export {
  cleanModel,
  gradleGroup,
  kotlinPackage,
  kotlinVarName,
  jsonAppendLines,
  projectPath,
}
