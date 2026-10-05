"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelText = modelText;
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
//# sourceMappingURL=text.js.map