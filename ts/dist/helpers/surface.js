"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SURFACE_WORD = exports.SURFACES = void 0;
exports.documentOrder = documentOrder;
exports.surfaceName = surfaceName;
exports.surfaceOf = surfaceOf;
const types_1 = require("../types");
const facts_1 = require("./facts");
// What the `surface` slot may hold. The schema leaves it open; package check
// holds it to these, and a document names a target with any other word by its
// title alone.
const SURFACES = ['sdk', 'cli', 'mcp', 'data', 'seneca-provider'];
exports.SURFACES = SURFACES;
const SURFACE_WORD = {
    sdk: 'SDK',
    cli: 'CLI',
    mcp: 'MCP',
    data: 'data',
    'seneca-provider': 'Seneca provider',
};
exports.SURFACE_WORD = SURFACE_WORD;
const SURFACE_NOUN = {
    sdk: 'SDK',
    cli: 'CLI',
    mcp: 'MCP server',
    data: 'data package',
    'seneca-provider': 'Seneca provider',
};
function surfaceOf(target) {
    const surface = (0, facts_1.fact)(target, 'surface');
    return SURFACES.includes(surface) ? surface : '';
}
// The title and the noun for what the target is, with the noun's words the
// title already ends with said once: "Go CLI", "Python Data package".
function surfaceName(target) {
    const title = String((0, facts_1.fact)(target, 'title')).split(' ');
    const noun = (SURFACE_NOUN[surfaceOf(target)] ?? 'package').split(' ');
    for (let k = Math.min(title.length, noun.length); 0 < k; k--) {
        if (title.slice(-k).join(' ').toLowerCase() === noun.slice(0, k).join(' ').toLowerCase()) {
            return [...title, ...noun.slice(k)].join(' ');
        }
    }
    return [...title, ...noun].join(' ');
}
// The configured languages by origin, then the rest, then the CLI and MCP server.
function documentOrder(model, targets) {
    const order = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.config.docs_order`, { only_active: false, required: false }) || [];
    const rank = (t) => {
        const i = order.indexOf((0, facts_1.fact)(t, 'origin'));
        if (-1 !== i)
            return i;
        const surface = surfaceOf(t);
        if ('cli' === surface)
            return order.length + 1;
        if ('mcp' === surface)
            return order.length + 2;
        return order.length;
    };
    return targets.slice().sort((a, b) => rank(a) - rank(b));
}
//# sourceMappingURL=surface.js.map