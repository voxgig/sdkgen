"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isConsumer = isConsumer;
exports.alongsideNote = alongsideNote;
const apidef_1 = require("@voxgig/apidef");
const PHASES = ['entity', 'feature', 'readme', 'agentguide', 'test'];
// A consumer (py-data) switches every phase off and has no ReadmeTop components.
function isConsumer(target) {
    return PHASES.every((name) => false === target?.phase?.[name]?.active);
}
// Names only the active surfaces, so a project with go-mcp off is not promised one.
function alongsideNote(model, self) {
    const target = model?.main?.[apidef_1.KIT]?.target || {};
    const others = Object.entries(target)
        .filter(([name, t]) => name !== self && null != t && false !== t.active);
    const has = (name) => others.some(([other]) => other === name);
    const cli = has('go-cli');
    const mcp = has('go-mcp');
    const langs = others.some(([name, t]) => 'go-cli' !== name && 'go-mcp' !== name && !isConsumer(t));
    const parts = [];
    if (langs)
        parts.push('Other languages');
    if (cli)
        parts.push('the CLI');
    if (mcp)
        parts.push(cli ? 'MCP server' : 'the MCP server');
    if (0 === parts.length)
        return '';
    const list = 1 === parts.length ? parts[0]
        : 2 === parts.length ? parts.join(' and ')
            : parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];
    const verb = 1 === parts.length && !langs ? 'lives' : 'live';
    return `> ${list[0].toUpperCase() + list.slice(1)} ${verb} alongside this one — see
> the [top-level README](../README.md).

`;
}
//# sourceMappingURL=alongside.js.map