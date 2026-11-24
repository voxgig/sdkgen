"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SURFACES = void 0;
exports.surfaceOf = surfaceOf;
const facts_1 = require("./facts");
// What the `surface` slot may hold. The schema leaves it open; package check
// holds it to these, and a document names a target with any other word by its
// title alone.
const SURFACES = ['sdk', 'cli', 'mcp', 'data', 'seneca-provider'];
exports.SURFACES = SURFACES;
function surfaceOf(target) {
    const surface = (0, facts_1.fact)(target, 'surface');
    return SURFACES.includes(surface) ? surface : '';
}
//# sourceMappingURL=surface.js.map