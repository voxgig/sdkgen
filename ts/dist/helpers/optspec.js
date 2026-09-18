"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionSpec = optionSpec;
exports.featureOptionSpec = featureOptionSpec;
exports.entitySpecMap = entitySpecMap;
const jostraca_1 = require("jostraca");
const apidef_1 = require("@voxgig/apidef");
const applicability_1 = require("./applicability");
const canonSpec_1 = require("./canonSpec");
const S_CHILD = (0, canonSpec_1.sentinel)('CHILD');
const S_OPEN = (0, canonSpec_1.sentinel)('OPEN');
const S_ONE = (0, canonSpec_1.sentinel)('ONE');
const S_NIL = (0, canonSpec_1.sentinel)('NIL');
function optional(spec) {
    return [S_ONE, spec, S_NIL];
}
function featureOptionSpec(feat) {
    const config = (feat && feat.config) || {};
    const spec = {};
    if (true !== config.strict) {
        spec[S_OPEN] = true;
    }
    spec.active = (0, canonSpec_1.optionalSpec)((0, canonSpec_1.byExampleSpec)(false));
    for (const [name, val] of Object.entries(config.options || {})) {
        spec[name] = (0, canonSpec_1.optionalSpec)((0, canonSpec_1.byExampleSpec)(val));
    }
    // Type-only declarations win: a name in both is one the author gave a
    // default AND a type, and the type is the more specific statement. Written
    // as sentinels already, so they are widened for absence but not for kind.
    for (const [name, val] of Object.entries(config.optspec || {})) {
        spec[name] = (0, canonSpec_1.optionalSpec)(val);
    }
    return spec;
}
// The assembled option spec for a target.
//
// `targetname` gates the feature half exactly as `configDefinition` does: a
// target must not validate against — or document — a feature it has no
// implementation for. Without a name every active feature is included.
function optionSpec(model, targetname) {
    const base = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.optspec`, { required: false, only_active: false }) || {};
    const spec = JSON.parse(JSON.stringify(base));
    const feature = {
        [S_CHILD]: {
            [S_OPEN]: true,
            active: false,
        },
    };
    const feats = (0, applicability_1.targetFeatures)(model, null == targetname ? undefined : targetname);
    (0, jostraca_1.each)(feats).forEach((f) => {
        if (null == f || null == f.name || false === f.active) {
            return;
        }
        feature[f.name] = optional(featureOptionSpec(f));
    });
    spec.feature = feature;
    return spec;
}
function entitySpecMap(model, targetname) {
    const feats = (0, applicability_1.targetFeatures)(model, null == targetname ? undefined : targetname);
    const validate = feats.validate;
    if (null == validate || false === validate.active) {
        return null;
    }
    const entity = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.entity`, { required: false }) || {};
    const specs = {};
    (0, jostraca_1.each)(entity).forEach((ent) => {
        if (null == ent || null == ent.name) {
            return;
        }
        specs[ent.name] = (0, canonSpec_1.entitySpecs)(ent);
    });
    return specs;
}
//# sourceMappingURL=optspec.js.map