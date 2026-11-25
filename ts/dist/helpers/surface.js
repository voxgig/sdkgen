"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SURFACE_WORD = exports.SURFACE_SINCE = exports.SURFACES = void 0;
exports.documentOrder = documentOrder;
exports.externalName = externalName;
exports.surfaceName = surfaceName;
exports.surfaceOf = surfaceOf;
const types_1 = require("../types");
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
function knownSurface(surface) {
    return SURFACES.includes(surface) ? surface : '';
}
function surfaceOf(target) {
    return knownSurface((0, facts_1.fact)(target, 'surface'));
}
function surfaceName(target) {
    return titledSurface(String((0, facts_1.fact)(target, 'title')), surfaceOf(target));
}
// The title and the noun for what the target is, with the noun's words the
// title already ends with said once: "Go CLI", "Python Data package".
function titledSurface(titleText, surface) {
    const title = titleText.split(' ');
    const noun = (SURFACE_NOUN[knownSurface(surface)] ?? 'package').split(' ');
    for (let k = Math.min(title.length, noun.length); 0 < k; k--) {
        if (title.slice(-k).join(' ').toLowerCase() === noun.slice(0, k).join(' ').toLowerCase()) {
            return [...title, ...noun.slice(k)].join(' ');
        }
    }
    return [...title, ...noun].join(' ');
}
// A target the `external` fact lists, as this repository's documents name it:
// linked to its own repository when the model names one.
function externalName(target) {
    const name = titledSurface(target.title, target.surface);
    return '' === target.url ? name : `[${name}](${target.url})`;
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