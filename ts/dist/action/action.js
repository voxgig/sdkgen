"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateIndex = void 0;
exports.appendIndexEntries = appendIndexEntries;
exports.loadContent = loadContent;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
// Append `@"<name>.jsonic"` import lines for each name not already present in
// the index content. Checking against the accumulating result (not the
// original) means duplicate names in the same call are added at most once.
function appendIndexEntries(content, names) {
    let out = content;
    for (const n of names) {
        const entry = `@"${n}.jsonic"`;
        if (!out.includes(entry)) {
            out += '\n' + entry;
        }
    }
    return out;
}
const UpdateIndex = (0, jostraca_1.cmp)(function UpdateIndex(props) {
    (0, jostraca_1.Content)(appendIndexEntries(props.content, props.names));
});
exports.UpdateIndex = UpdateIndex;
function loadContent(actx, which) {
    which = Array.isArray(which) ? which : [which];
    const content = {};
    const fs = actx.fs();
    const modelfolder = node_path_1.default.dirname(actx.url);
    which.map((w) => {
        const indexfile = node_path_1.default.join(modelfolder, w, w + '-index.jsonic');
        const indexcontent = fs.readFileSync(indexfile, 'utf8');
        content[`${w}_index`] = indexcontent;
    });
    return content;
}
//# sourceMappingURL=action.js.map