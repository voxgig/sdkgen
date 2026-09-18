
import { each } from 'jostraca'
import { KIT, getModelPath } from '@voxgig/apidef'

import { targetFeatures } from './applicability'
import { byExampleSpec, entitySpecs, optionalSpec, sentinel } from './canonSpec'


const S_CHILD = sentinel('CHILD')
const S_OPEN = sentinel('OPEN')
const S_ONE = sentinel('ONE')
const S_NIL = sentinel('NIL')


function optional(spec: any): any[] {
  return [S_ONE, spec, S_NIL]
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

  return spec
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

  return specs
}


export {
  optionSpec,
  featureOptionSpec,
  entitySpecMap,
}
