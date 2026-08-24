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
    // so the require target is exactly the set the manifest carries. each()
    // iterates in sorted-key order, so if a second active dep ever appears
    // beside the station library the pick is at least deterministic; the
    // station feature model declares exactly one per target.
    const names = (0, jostraca_1.each)(deps)
        .filter((dep) => true === dep?.active)
        .map((dep) => dep?.key$)
        .filter((name) => null != name && '' !== name);
    return 0 < names.length ? String(names[0]) : undefined;
}
//# sourceMappingURL=station.js.map