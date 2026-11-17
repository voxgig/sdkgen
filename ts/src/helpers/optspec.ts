
import { each } from 'jostraca'
import { KIT, getModelPath } from '@voxgig/apidef'

import { resolvesBundled } from '../action/resolve'
import { SdkGenError } from '../utility'
import { targetFeatures } from './applicability'
import {
  anyOf, byExampleSpec, entitySpecs, oneUnionPaths, oneUnionSpec, optionalSpec, sentinel,
} from './canonSpec'
import { kindCollection } from './kindCollection'
import { originName } from './packageMeta'


const S_CHILD = sentinel('CHILD')
const S_OPEN = sentinel('OPEN')
const S_NIL = sentinel('NIL')


// Bundled targets whose struct copy no vendoring route produces, and which
// therefore still reads a union as `$ONE`.
const ONE_UNION_TARGETS = [
  'c', 'clojure', 'cpp', 'elixir', 'ocaml', 'rb', 'rust', 'scala', 'swift',
]


function optional(spec: any): any[] {
  return anyOf([spec, S_NIL])
}


function readsOneUnion(model: any, targetname: string): boolean {
  const declared = kindCollection(model, 'target')[targetname]
  return (null == declared || resolvesBundled(declared, targetname)) &&
    ONE_UNION_TARGETS.includes(originName(model, targetname))
}


// A spec in the form the target's own struct copy reads.
function targetSpec<T>(model: any, targetname: string | undefined, spec: T): T {
  if (null != targetname && readsOneUnion(model, targetname)) {
    return oneUnionSpec(spec)
  }

  const at = oneUnionPaths(spec)
  if (0 < at.length) {
    throw new SdkGenError((null == targetname ? '' : targetname + ': ') +
      'the struct spec names ' + sentinel('ONE') + ' at ' + at.join(', ') +
      ', which validate refuses, so every client would fail at construction. ' +
      'Write [' + sentinel('ONE') + ', a, b] as [' + sentinel('NOF') +
      ', {min: 1}, a, b].')
  }

  return spec
}


function featureOptionSpec(feat: any): Record<string, any> {
  const config = (feat && feat.config) || {}
  const spec: Record<string, any> = {}

  if (true !== config.strict) {
    spec[S_OPEN] = true
  }

  spec.active = optionalSpec(byExampleSpec(false))

  for (const [name, val] of Object.entries(config.options || {})) {
    spec[name] = optionalSpec(byExampleSpec(val))
  }

  // Type-only declarations win: a name in both is one the author gave a
  // default AND a type, and the type is the more specific statement. Written
  // as sentinels already, so they are widened for absence but not for kind.
  for (const [name, val] of Object.entries(config.optspec || {})) {
    spec[name] = optionalSpec(val)
  }

  return spec
}


// The assembled option spec for a target.
//
// `targetname` gates the feature half exactly as `configDefinition` does: a
// target must not validate against — or document — a feature it has no
// implementation for. Without a name every active feature is included.
function optionSpec(model: any, targetname?: string): Record<string, any> {
  const base = getModelPath(model, `main.${KIT}.optspec`,
    { required: false, only_active: false }) || {}

  const spec: Record<string, any> = JSON.parse(JSON.stringify(base))

  const feature: Record<string, any> = {
    [S_CHILD]: {
      [S_OPEN]: true,
      active: false,
    },
  }

  const feats = targetFeatures(model, null == targetname ? undefined : targetname)
  each(feats).forEach((f: any) => {
    if (null == f || null == f.name || false === f.active) {
      return
    }
    feature[f.name] = optional(featureOptionSpec(f))
  })

  spec.feature = feature

  return targetSpec(model, targetname, spec)
}


function entitySpecMap(model: any, targetname?: string): Record<string, any> | null {
  const feats = targetFeatures(model, null == targetname ? undefined : targetname)
  const validate = (feats as any).validate

  if (null == validate || false === validate.active) {
    return null
  }

  const entity = getModelPath(model, `main.${KIT}.entity`, { required: false }) || {}

  const specs: Record<string, any> = {}
  each(entity).forEach((ent: any) => {
    if (null == ent || null == ent.name) {
      return
    }
    specs[ent.name] = entitySpecs(ent)
  })

  return targetSpec(model, targetname, specs)
}


export {
  optionSpec,
  featureOptionSpec,
  entitySpecMap,
  targetSpec,
  ONE_UNION_TARGETS,
}
