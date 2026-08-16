"use strict";
// WHAT `voxgig-sdkgen <action> …` CAN BE.
//
// Built FROM THE KIND REGISTRY rather than hand-listed, so registering a kind
// is the only edit a new kind needs — `docs add …` costs no dispatch code
// (docs/design/sdkgen-packages.md §9). The `package` and `doctor` verbs are
// not kinds and are added beside it.
//
// It lives in its own module because `package.ts` needs the per-kind add
// functions and `target.ts` imports `feature.ts` which imports `kind.ts`;
// wiring them together anywhere in that chain is a require cycle. Here,
// nothing imports back.
//
// NULL-PROTOTYPE, and this is not decoration. A plain object literal inherits
// Object.prototype, so `voxgig-sdkgen toString` (or `constructor`, `valueOf`,
// …) resolved to an inherited function, passed the `null == actionFunc`
// guard, and got CALLED with the action arguments instead of reporting an
// unknown action.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTION_MAP = void 0;
exports.actionMap = actionMap;
exports.actionNames = actionNames;
exports.needsModel = needsModel;
const kind_1 = require("./kind");
const target_1 = require("./target");
const feature_1 = require("./feature");
const docs_1 = require("./docs");
const doctor_1 = require("./doctor");
const package_1 = require("./package");
// The per-kind entry points, by kind name. A kind in the registry with no
// entry here is one nothing can install yet — reported when something asks
// for it, never silently ignored.
const KIND_ACTIONS = Object.assign(Object.create(null), {
    target: target_1.action_target,
    feature: feature_1.action_feature,
    docs: docs_1.action_docs,
});
// The same functions, as the direct `(refs, actx)` calls `package add` loops
// over. Registered rather than imported by `package.ts`, for the cycle above.
(0, package_1.registerAdder)('target', target_1.target_add);
(0, package_1.registerAdder)('feature', feature_1.feature_add);
(0, package_1.registerAdder)('docs', docs_1.docs_add);
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
// Does this invocation need the PROJECT's model?
//
// Every verb but one operates on a project, and compiling `model/sdk.aontu`
// before dispatch is what makes them fail early and clearly when run from the
// wrong directory. `package check` is the exception on purpose: it operates
// on a PACKAGE, and an author runs it in their package root, where there is
// no project model to compile and nothing is wrong with that.
//
// Stated here, with the verb table, rather than in the CLI or in `sdkgen.ts`:
// it is a fact about the verb.
function needsModel(args) {
    return !('package' === args[0] && 'check' === args[1]);
}
//# sourceMappingURL=dispatch.js.map