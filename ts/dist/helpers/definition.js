"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.definitionPath = definitionPath;
exports.definitionPathAny = definitionPathAny;
exports.definitionFolder = definitionFolder;
exports.definitionNames = definitionNames;
exports.indexName = indexName;
const node_path_1 = __importDefault(require("node:path"));
const junk_1 = require("./junk");
// The definition file for one item.
function definitionPath(sdkfolder, kind, name) {
    return node_path_1.default.join(sdkfolder, 'model', kind, name + '.aontu');
}
// The file an item ACTUALLY has: `.aontu`, else the pre-rename `.aon`. Without
// the fallback a remove reports success and leaves the file behind.
function definitionPathAny(fs, sdkfolder, kind, name) {
    const current = definitionPath(sdkfolder, kind, name);
    if (fs.existsSync(current)) {
        return current;
    }
    const legacy = node_path_1.default.join(sdkfolder, 'model', kind, name + '.aon');
    return fs.existsSync(legacy) ? legacy : current;
}
// The directory holding a kind's definitions.
function definitionFolder(sdkfolder, kind) {
    return node_path_1.default.join(sdkfolder, 'model', kind);
}
// The include list beside them.
function indexName(kind) {
    return kind + '-index.aontu';
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
    // The suffix alone is not enough: `.#target.aontu` is an emacs lock link and
    // `target.aontu.orig` a merge leftover, either of which would invent an item
    // that then resolves nowhere. See helpers/junk. Both extensions, deduped.
    const names = new Set(entries
        .filter((n) => /\.(aontu|aon)$/.test(n) && index !== n && !(0, junk_1.isJunk)(n))
        .map((n) => n.replace(/\.(aontu|aon)$/, '')));
    return [...names].sort();
}
//# sourceMappingURL=definition.js.map