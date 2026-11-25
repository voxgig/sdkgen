"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.definitionName = definitionName;
exports.modelText = modelText;
exports.seriesList = seriesList;
const apidef_1 = require("@voxgig/apidef");
// The prose a project writes under `main.kit.text`, over `main.kit.info`,
// where the spec and older projects put it. An empty slot falls through.
function modelText(model) {
    const info = model?.main?.[apidef_1.KIT]?.info || {};
    const text = model?.main?.[apidef_1.KIT]?.text || {};
    const out = { ...info, entity_desc: { ...(info.entity_desc || {}) } };
    for (const [slot, value] of Object.entries(text)) {
        if ('entity_desc' === slot) {
            for (const [entity, desc] of Object.entries(value || {})) {
                if (given(desc))
                    out.entity_desc[entity] = desc;
            }
        }
        else if (given(value)) {
            out[slot] = value;
        }
    }
    return out;
}
function given(value) {
    return null != value && '' !== value;
}
const DEFINITION_NAME = {
    openapi: ['OpenAPI spec', 'OpenAPI specification'],
    graphql: ['GraphQL schema', 'GraphQL schema'],
};
// What a document calls the definition an SDK is generated from, by the
// definition-kind fact: in short, or in full.
function definitionName(kind, full = false) {
    return DEFINITION_NAME[kind]?.[full ? 1 : 0] ?? 'API definition';
}
// "a", "a and b", "a, b, and c".
function seriesList(items) {
    return items.length < 3 ? items.join(' and ') :
        items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
}
//# sourceMappingURL=text.js.map