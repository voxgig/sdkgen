
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

function cleanModel(o: any, dropDefaults?: boolean): any {
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
