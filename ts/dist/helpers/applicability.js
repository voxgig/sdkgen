"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAGS = void 0;
exports.featureApplies = featureApplies;
exports.targetFeatures = targetFeatures;
exports.featureTags = tags;
exports.unknownTags = unknownTags;
const apidef_1 = require("@voxgig/apidef");
// Tags are a MAP keyed by tag name, `{ sekreto: true }` — see the schema
// note on `needs`. A map because aontu unifies maps by key, so a package
// can add one tag without restating the others; and because a defaulted
// list disjunction in this position hangs the unifier on a real project's
// model. A tag counts only when its value is true, so a tag can be turned
// off by overriding it rather than by deleting the key.
//
// A list is still accepted, for a hand-written model that used the shape
// docs/design/feature-tags.md first proposed.
function tags(val) {
    if (Array.isArray(val)) {
        return val.filter((t) => 'string' === typeof t);
    }
    if (null == val || 'object' !== typeof val) {
        return [];
    }
    return Object.keys(val).filter((name) => true === val[name]);
}
// Does this feature apply to this target?
function featureApplies(feature, target) {
    const needs = tags(feature && feature.needs);
    // The common case, and the reason this is additive: no needs, applies
    // anywhere. Checked first so a target with no `provides` is unaffected.
    if (0 === needs.length) {
        return true;
    }
    const provides = tags(target && target.provides);
    return needs.every((need) => provides.includes(need));
}
// The features that apply to `target`, in the same map shape
// `getModelPath(model, 'main.<kit>.feature')` returns — already
// active-filtered by getModelPath, then gated by the tags.
//
// `target` may be the target object or its name; components hold the
// object, `configDefinition` is only given the name.
function targetFeatures(model, target) {
    const feature = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.feature`, { required: false }) || {};
    const t = 'string' === typeof target ?
        ((0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.target`, { required: false }) || {})[target] :
        target;
    // A name that names no target gates nothing: a caller that cannot say
    // which target it is generating for must not silently lose features.
    if (null == t) {
        return feature;
    }
    // Keyed off the map, not off `f.name`: the key is what every consumer
    // indexes by, and rebuilding from a field would drop an entry whose
    // model never set one. Order is not preserved on purpose — consumers
    // re-sort with `each`, which is what keeps output byte-stable.
    const applies = {};
    for (const [name, f] of Object.entries(feature)) {
        if (featureApplies(f, t)) {
            applies[name] = f;
        }
    }
    return applies;
}
// THE CLOSED VOCABULARY. The schema comment says applicability tags are a
// closed set; without this, `provides: &: boolean` accepts any key, so a
// typo (`sekrreto`) compiles cleanly and silently makes the feature apply
// NOWHERE — the worst failure shape, because the feature simply vanishes
// with no diagnostic.
//
// Extended by adding a tag here AND documenting it in model/sdkgen.aon.
const TAGS = [
    // A vendored sekreto port lives in this target's feature container.
    'sekreto',
];
exports.TAGS = TAGS;
// The tags named by `needs`/`provides` that are not in the vocabulary.
function unknownTags(val) {
    return tags(val).filter((t) => !TAGS.includes(t));
}
//# sourceMappingURL=applicability.js.map