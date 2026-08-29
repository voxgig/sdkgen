// Which features a target can actually take.
//
// THE ONE PLACE THIS RULE LIVES. `Feature` (what source is copied), the
// per-language `Config_<lang>` and `Main_<lang>` components (what the
// generated registry, imports and metadata contain) and `configDefinition`
// (the embedded config) must all reach the same answer for one
// (feature, target) pair. They previously each read the raw feature map,
// which is how a feature with no source for a target still reached that
// target's imports.
//
// The shape is `docs/design/feature-tags.md`: a feature declares what it
// NEEDS, a target declares what it PROVIDES, and the feature applies when
// `needs` is a subset of `provides`. Both default to empty, so a feature
// that needs nothing applies everywhere — every feature that existed
// before this gate keeps its behaviour with no model edit, which is what
// makes the change additive.
//
// A named target list was the cheaper design and fails on time: it has to
// be edited for targets the feature's author has never heard of, so a
// published package starves every target added after its release. A tag is
// a claim about the feature that stays true as the target set grows.

import { KIT, getModelPath } from '@voxgig/apidef'


// Model list fields arrive as real arrays (see `feature.fullset` in
// action/target.ts); anything else is treated as "declared nothing".
function tags(val: any): string[] {
  return Array.isArray(val) ? val.filter((t: any) => 'string' === typeof t) : []
}


// Does this feature apply to this target?
function featureApplies(feature: any, target: any): boolean {
  const needs = tags(feature && feature.needs)

  // The common case, and the reason this is additive: no needs, applies
  // anywhere. Checked first so a target with no `provides` is unaffected.
  if (0 === needs.length) {
    return true
  }

  const provides = tags(target && target.provides)

  return needs.every((need: string) => provides.includes(need))
}


// The features that apply to `target`, in the same map shape
// `getModelPath(model, 'main.<kit>.feature')` returns — already
// active-filtered by getModelPath, then gated by the tags.
//
// `target` may be the target object or its name; components hold the
// object, `configDefinition` is only given the name.
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

  // Keyed off the map, not off `f.name`: the key is what every consumer
  // indexes by, and rebuilding from a field would drop an entry whose
  // model never set one. Order is not preserved on purpose — consumers
  // re-sort with `each`, which is what keeps output byte-stable.
  const applies: Record<string, any> = {}
  for (const [name, f] of Object.entries(feature as Record<string, any>)) {
    if (featureApplies(f, t)) {
      applies[name] = f
    }
  }

  return applies
}


export {
  featureApplies,
  targetFeatures,
}
