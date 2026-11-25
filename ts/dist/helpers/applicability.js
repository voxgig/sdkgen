"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAGS = void 0;
exports.featureApplies = featureApplies;
exports.providedBy = providedBy;
exports.shippedProvides = shippedProvides;
exports.targetFeatures = targetFeatures;
exports.featureTags = tags;
exports.unknownTags = unknownTags;
const node_fs_1 = __importDefault(require("node:fs"));
const aontu_1 = require("aontu");
const apidef_1 = require("@voxgig/apidef");
const definition_1 = require("./definition");
const shipped_1 = require("./shipped");
const resolve_1 = require("../action/resolve");
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
    const provides = providedBy(target);
    return needs.every((need) => provides.includes(need));
}
// An add keeps an alias's own model file, so one that declares no `provides`
// takes its origin's.
function providedBy(target) {
    const own = target?.provides;
    const origin = target?.origname;
    if ((null != own && 0 < Object.keys(own).length) || 'string' !== typeof origin ||
        '' === origin || origin === target.name || !(0, resolve_1.resolvesBundled)(target, target.name)) {
        return tags(own);
    }
    return shippedProvides(origin);
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
const shipped = new Map();
// The tags this package's own copy of a target provides; a project's older
// copy of the same target may lack them.
function shippedProvides(origin) {
    if (!shipped.has(origin)) {
        const path = (0, definition_1.definitionPathAny)(node_fs_1.default, (0, shipped_1.scaffoldFolder)(), 'target', origin);
        let provides = [];
        if (node_fs_1.default.existsSync(path)) {
            const errs = [];
            const model = new aontu_1.Aontu().generate((0, definition_1.migrateIncludes)(node_fs_1.default.readFileSync(path, 'utf8')), { path, errs });
            if (0 === errs.length) {
                provides = tags(model?.main?.[apidef_1.KIT]?.target?.[origin]?.provides);
            }
        }
        shipped.set(origin, provides);
    }
    return shipped.get(origin);
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