"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stationLibrary = stationLibrary;
const jostraca_1 = require("jostraca");
const apidef_1 = require("@voxgig/apidef");
const utility_1 = require("../utility");
function stationLibrary(model, targetName) {
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