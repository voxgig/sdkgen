"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCP_WRITE_OPS = exports.MCP_READ_OPS = void 0;
exports.mcpTools = mcpTools;
const jostraca_1 = require("jostraca");
const apidef_1 = require("@voxgig/apidef");
const opShape_1 = require("./opShape");
const MCP_READ_OPS = ['list', 'load'];
exports.MCP_READ_OPS = MCP_READ_OPS;
const MCP_WRITE_OPS = ['create', 'update', 'remove'];
exports.MCP_WRITE_OPS = MCP_WRITE_OPS;
// The tools the go-mcp server registers, each for the entities a plain call of
// its operation runs on, in name order. A tool no entity can serve is left
// out. The write tools need the target's `tool.write`.
function mcpTools(model, target = 'go-mcp') {
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
//# sourceMappingURL=mcpTools.js.map