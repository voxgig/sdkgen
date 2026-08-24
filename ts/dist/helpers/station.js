"use strict";
// The station SELF-REGISTRATION seam (station design station.md §9 /
// station-declarative-config.md §6.2 path 1, §11 item 2): when the station
// feature is installed and active, the generated MAIN module registers the
// SDK's `{construct, config}` factory pair with the station library at
// module init, so `station.sdk('<name>')` needs no imports in application
// code. The registration key is the descriptor slug — `config.main.slug`,
// the same field station's `normalizeDescriptor` reads — so the generated
// code passes the embedded config's own value rather than re-deriving it.
//
// This helper answers the ONE question every Main_<lang> asks before
// emitting that registration: is the station feature ACTIVE in this model,
// and what is the station library package for this target? Both come from
// the model — the active-filtered feature map (exactly the view the Main
// components already emit from) and the station feature's own
// `deps.<target>` block, which is the same entry `collectDeps` flows into
// the generated manifest. ONE RULE, ONE PLACE: reading the package name
// here, never hardcoding it per language, means the manifest dependency
// and the emitted require can not disagree.
//
// Returns undefined when the station feature is absent, inactive, or
// declares no active station library dep for this target (the vendored
// targets carry the library inside their tm overlay instead of as a dep —
// station.md §9.2): no dep, no package to require, no registration to emit.
Object.defineProperty(exports, "__esModule", { value: true });
exports.stationLibrary = stationLibrary;
const jostraca_1 = require("jostraca");
const apidef_1 = require("@voxgig/apidef");
const utility_1 = require("../utility");
function stationLibrary(model, targetName) {
    // Active-filtered on purpose: an inactive feature ships no source, no
    // embedded config entry and no manifest dep, so it must emit no
    // registration either.
    const feature = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.feature`, { required: false }) || {};
    const station = feature.station;
    if (null == station) {
        return undefined;
    }
    const deps = station.deps?.[targetName];
    if (null == deps) {
        return undefined;
    }
    // Feature deps count only when explicitly active — collectDeps semantics,
    // so the require target is exactly the set the manifest carries.
    const names = (0, jostraca_1.each)(deps)
        .filter((dep) => true === dep?.active)
        .map((dep) => dep?.key$)
        .filter((name) => null != name && '' !== name);
    if (0 === names.length) {
        return undefined;
    }
    // EXACTLY ONE, or say so. Picking the first of several — each() sorts,
    // so it would be the alphabetically first — means the generated main
    // can `require` an unrelated helper package, find no `provide`, and
    // leave the factory table silently empty. The station feature model
    // declares one library per target; a second active dep is a model
    // question only its author can answer.
    if (1 < names.length) {
        throw new utility_1.SdkGenError('station: feature `station` declares ' + names.length + ' active ' +
            'dependencies for target `' + targetName + '` (' +
            names.map(String).sort().join(', ') + '), so the station library to ' +
            'register with is ambiguous. Declare exactly one active dep per ' +
            'target in the feature model, or mark which one is the library.');
    }
    return String(names[0]);
}
//# sourceMappingURL=station.js.map