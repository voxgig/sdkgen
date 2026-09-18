"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTION_MAP = void 0;
exports.actionMap = actionMap;
exports.actionNames = actionNames;
exports.needsModel = needsModel;
const kind_1 = require("./kind");
const target_1 = require("./target");
const feature_1 = require("./feature");
const edition_1 = require("./edition");
const doctor_1 = require("./doctor");
const package_1 = require("./package");
// The per-kind entry points, by kind name. A kind in the registry with no
// entry here is one nothing can install yet — reported when something asks
// for it, never silently ignored.
const KIND_ACTIONS = Object.assign(Object.create(null), {
    target: target_1.action_target,
    feature: feature_1.action_feature,
    edition: edition_1.action_edition,
});
// The same functions, as the direct `(refs, actx)` calls `package add` loops
// over. Registered rather than imported by `package.ts`, for the cycle above.
(0, package_1.registerAdder)('target', target_1.target_add);
(0, package_1.registerAdder)('feature', feature_1.feature_add);
(0, package_1.registerAdder)('edition', edition_1.edition_add);
function actionMap() {
    const map = Object.create(null);
    for (const kind of Object.keys(kind_1.KINDS)) {
        if (null != KIND_ACTIONS[kind]) {
            map[kind] = KIND_ACTIONS[kind];
        }
    }
    map.package = package_1.action_package;
    map.doctor = doctor_1.action_doctor;
    return map;
}
const ACTION_MAP = actionMap();
exports.ACTION_MAP = ACTION_MAP;
// The verbs, for help text and for an unknown-action message that says what
// IS available rather than only what is not.
function actionNames() {
    return Object.keys(ACTION_MAP).sort();
}
function needsModel(args) {
    return !('package' === args[0] && 'check' === args[1]);
}
//# sourceMappingURL=dispatch.js.map