"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SURFACE_SINCE = exports.SURFACES = void 0;
exports.surfaceOf = surfaceOf;
const facts_1 = require("./facts");
// What the `surface` slot may hold, each word with the release that first
// reads it. The schema leaves the slot open; package check holds it to these,
// and a document names a target with any other word by its title alone.
const SURFACE_SINCE = {
    sdk: '4.47.0',
    cli: '4.47.0',
    mcp: '4.47.0',
    data: '4.47.0',
    'seneca-provider': '4.47.0',
};
exports.SURFACE_SINCE = SURFACE_SINCE;
const SURFACES = Object.keys(SURFACE_SINCE);
exports.SURFACES = SURFACES;
function surfaceOf(target) {
    const surface = (0, facts_1.fact)(target, 'surface');
    return SURFACES.includes(surface) ? surface : '';
}
//# sourceMappingURL=surface.js.map