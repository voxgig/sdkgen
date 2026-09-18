
import { KIT, getModelPath } from '@voxgig/apidef'


function tags(val: any): string[] {
  if (Array.isArray(val)) {
    return val.filter((t: any) => 'string' === typeof t)
  }

  if (null == val || 'object' !== typeof val) {
    return []
  }

  return Object.keys(val).filter((name: string) => true === val[name])
}


// Does this feature apply to this target?
function featureApplies(feature: any, target: any): boolean {
  const needs = tags(feature && feature.needs)

  if (0 === needs.length) {
    return true
  }

  const provides = tags(target && target.provides)

  return needs.every((need: string) => provides.includes(need))
}


function targetFeatures(model: any, target: any): Record<string, any> {
  const feature = getModelPath(model, `main.${KIT}.feature`, { required: false }) || {}

  const t = 'string' === typeof target ?
    (getModelPath(model, `main.${KIT}.target`, { required: false }) || {})[target] :
    target

  // A name that names no target gates nothing: a caller that cannot say
  // which target it is generating for must not silently lose features.
  if (null == t) {
    return feature
  }

  const applies: Record<string, any> = {}
  for (const [name, f] of Object.entries(feature as Record<string, any>)) {
    if (featureApplies(f, t)) {
      applies[name] = f
    }
  }

  return applies
}


const TAGS = [
  // A vendored sekreto port lives in this target's feature container.
  'sekreto',

  'schema',
]


// The tags named by `needs`/`provides` that are not in the vocabulary.
function unknownTags(val: any): string[] {
  return tags(val).filter((t: string) => !TAGS.includes(t))
}


export {
  featureApplies,
  targetFeatures,
  tags as featureTags,
  unknownTags,
  TAGS,
}
