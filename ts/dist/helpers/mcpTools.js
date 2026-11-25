"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCP_WRITE_OPS = exports.MCP_READ_OPS = void 0;
exports.mcpTools = mcpTools;
exports.mcpTarget = mcpTarget;
const jostraca_1 = require("jostraca");
const apidef_1 = require("@voxgig/apidef");
const opShape_1 = require("./opShape");
const surface_1 = require("./surface");
const MCP_READ_OPS = ['list', 'load'];
exports.MCP_READ_OPS = MCP_READ_OPS;
const MCP_WRITE_OPS = ['create', 'update', 'patch', 'remove'];
exports.MCP_WRITE_OPS = MCP_WRITE_OPS;
// The tools the go-mcp server registers, each for the entities a plain call of
// its operation runs on, in name order. A tool no entity can serve is left
// out. The write tools need the target's `tool.write`.
function mcpTools(model, target = mcpTarget(model)) {
    const write = true === model.main?.[apidef_1.KIT]?.target?.[target]?.tool?.write;
    const slug = String(model.name ?? '').toLowerCase();
    const entities = (0, jostraca_1.each)((0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.entity`) || {})
        .filter((ent) => null != ent && false !== ent.active);
    return [...MCP_READ_OPS, ...(write ? MCP_WRITE_OPS : [])]
        .map((op) => ({
        op,
        name: slug + '_' + op,
        entities: entities.filter((ent) => (0, opShape_1.entityOps)(ent).includes(op)),
    }))
        .filter((tool) => 0 < tool.entities.length);
}
// The installed name of the MCP server, which an alias or a package can change.
function mcpTarget(model) {
    const targets = model.main?.[apidef_1.KIT]?.target || {};
    return Object.keys(targets).sort().find((name) => false !== targets[name]?.active && 'mcp' === (0, surface_1.surfaceOf)(targets[name])) ?? 'go-mcp';
}
//# sourceMappingURL=mcpTools.js.map