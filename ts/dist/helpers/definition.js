"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.definitionPath = definitionPath;
exports.definitionFolder = definitionFolder;
exports.definitionNames = definitionNames;
exports.indexName = indexName;
const node_path_1 = __importDefault(require("node:path"));
const junk_1 = require("./junk");
// The definition file for one item.
function definitionPath(sdkfolder, kind, name) {
    return node_path_1.default.join(sdkfolder, 'model', kind, name + '.aon');
}
// The directory holding a kind's definitions.
function definitionFolder(sdkfolder, kind) {
    return node_path_1.default.join(sdkfolder, 'model', kind);
}
// The include list beside them.
function indexName(kind) {
    return kind + '-index.aon';
}
function definitionNames(fs, sdkfolder, kind) {
    const dir = definitionFolder(sdkfolder, kind);
    const index = indexName(kind);
    let entries;
    try {
        entries = fs.readdirSync(dir);
    }
    catch (err) {
        return [];
    }
    // The `.aon` suffix is not enough on its own: an emacs lock link is named
    // `.#target.aon` and a merge leaves `target.aon.orig`, so an editor open
    // in the wrong window invents an item called `.#target`, which then fails to
    // resolve everywhere it is named. See helpers/junk.
    return entries
        .filter((n) => n.endsWith('.aon') && index !== n && !(0, junk_1.isJunk)(n))
        .map((n) => n.replace(/\.aon$/, ''))
        .sort();
}
//# sourceMappingURL=definition.js.map