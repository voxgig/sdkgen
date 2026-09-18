"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAGS = void 0;
exports.featureApplies = featureApplies;
exports.targetFeatures = targetFeatures;
exports.featureTags = tags;
exports.unknownTags = unknownTags;
const apidef_1 = require("@voxgig/apidef");
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
    if (0 === needs.length) {
        return true;
    }
    const provides = tags(target && target.provides);
    return needs.every((need) => provides.includes(need));
}
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
    const applies = {};
    for (const [name, f] of Object.entries(feature)) {
        if (featureApplies(f, t)) {
            applies[name] = f;
        }
    }
    return applies;
}
const TAGS = [
    // A vendored sekreto port lives in this target's feature container.
    'sekreto',
    'schema',
];
exports.TAGS = TAGS;
// The tags named by `needs`/`provides` that are not in the vocabulary.
function unknownTags(val) {
    return tags(val).filter((t) => !TAGS.includes(t));
}
//# sourceMappingURL=applicability.js.map