"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ONE_UNION_TARGETS = void 0;
exports.optionSpec = optionSpec;
exports.featureOptionSpec = featureOptionSpec;
exports.entitySpecMap = entitySpecMap;
exports.targetSpec = targetSpec;
const jostraca_1 = require("jostraca");
const apidef_1 = require("@voxgig/apidef");
const resolve_1 = require("../action/resolve");
const utility_1 = require("../utility");
const applicability_1 = require("./applicability");
const canonSpec_1 = require("./canonSpec");
const kindCollection_1 = require("./kindCollection");
const packageMeta_1 = require("./packageMeta");
const S_CHILD = (0, canonSpec_1.sentinel)('CHILD');
const S_OPEN = (0, canonSpec_1.sentinel)('OPEN');
const S_NIL = (0, canonSpec_1.sentinel)('NIL');
// Bundled targets whose struct copy no vendoring route produces, and which
// therefore still reads a union as `$ONE`.
const ONE_UNION_TARGETS = [];
exports.ONE_UNION_TARGETS = ONE_UNION_TARGETS;
function optional(spec) {
    return (0, canonSpec_1.anyOf)([spec, S_NIL]);
}
function readsOneUnion(model, targetname) {
    const declared = (0, kindCollection_1.kindCollection)(model, 'target')[targetname];
    return (null == declared || (0, resolve_1.resolvesBundled)(declared, targetname)) &&
        ONE_UNION_TARGETS.includes((0, packageMeta_1.originName)(model, targetname));
}
// A spec in the form the target's own struct copy reads.
function targetSpec(model, targetname, spec) {
    if (null != targetname && readsOneUnion(model, targetname)) {
        return (0, canonSpec_1.oneUnionSpec)(spec);
    }
    const at = (0, canonSpec_1.oneUnionPaths)(spec);
    if (0 < at.length) {
        throw new utility_1.SdkGenError((null == targetname ? '' : targetname + ': ') +
            'the struct spec names ' + (0, canonSpec_1.sentinel)('ONE') + ' at ' + at.join(', ') +
            ', which validate refuses, so every client would fail at construction. ' +
            'Write [' + (0, canonSpec_1.sentinel)('ONE') + ', a, b] as [' + (0, canonSpec_1.sentinel)('NOF') +
            ', {min: 1}, a, b].');
    }
    return spec;
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
    return targetSpec(model, targetname, spec);
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
    return targetSpec(model, targetname, specs);
}
//# sourceMappingURL=optspec.js.map