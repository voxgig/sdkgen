"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alongsideNote = alongsideNote;
const apidef_1 = require("@voxgig/apidef");
const facts_1 = require("./facts");
const surface_1 = require("./surface");
// Names only the active surfaces, so a project with go-mcp off is not promised
// one. `link` is the root README from this target's folder, and without one
// there is no note.
function alongsideNote(model, self, link) {
    const target = model?.main?.[apidef_1.KIT]?.target || {};
    const readme = link ?? (null == target[self] ? '' : (0, facts_1.fact)(target[self], 'link').readme);
    if ('' === readme)
        return '';
    const others = Object.entries(target)
        .filter(([name, t]) => name !== self && null != t && false !== t.active)
        .map(([, t]) => (0, surface_1.surfaceOf)(t));
    const cli = others.includes('cli');
    const mcp = others.includes('mcp');
    const langs = others.includes('sdk');
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
> the [top-level README](${readme}).

`;
}
//# sourceMappingURL=alongside.js.map