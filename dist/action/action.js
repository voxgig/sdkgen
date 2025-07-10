"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateIndex = void 0;
exports.loadContent = loadContent;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const UpdateIndex = (0, jostraca_1.cmp)(function UpdateIndex(props) {
    const names = props.names;
    let oldcontent = props.content;
    let newcontent = oldcontent;
    names.map((n) => {
        if (!oldcontent.includes(`@"${n}.jsonic"`)) {
            newcontent += `\n@"${n}.jsonic"`;
        }
    });
    (0, jostraca_1.Content)(newcontent);
});
exports.UpdateIndex = UpdateIndex;
function loadContent(actx, which) {
    which = Array.isArray(which) ? which : [which];
    const content = {};
    const fs = actx.fs();
    const tree = actx.tree;
    const modelfolder = node_path_1.default.dirname(tree.url);
    which.map((w) => {
        const indexfile = node_path_1.default.join(modelfolder, w, w + '-index.jsonic');
        const indexcontent = fs.readFileSync(indexfile, 'utf8');
        content[`${w}_index`] = indexcontent;
    });
    return content;
}
//# sourceMappingURL=action.js.map