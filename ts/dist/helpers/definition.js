"use strict";
// WHERE A KIND'S DEFINITION FILES LIVE.
//
// `model/<kind>/<name>.aontu`, with `model/<kind>/<kind>-index.aontu` as the
// include list beside them. One line of path-building — and it was written out
// longhand in three places (the resolver, the feature catalogue, doctor), each
// with its own idea of which files in that directory count.
//
// That is the same shape of defect this workstream has now fixed four times:
// the same rule expressed twice, drifting. The manifest makes it four callers,
// so it becomes one function first.
//
// The EXCLUSIONS matter as much as the path. A `model/<kind>/` directory holds
// the index file (a list of includes, not a definition) and, in the shipped
// scaffold, a `README.md`. Neither is an item, and a caller that forgets one
// invents a `feature-index` feature.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.definitionPath = definitionPath;
exports.definitionFolder = definitionFolder;
exports.definitionNames = definitionNames;
exports.indexName = indexName;
const node_path_1 = __importDefault(require("node:path"));
// The definition file for one item.
function definitionPath(sdkfolder, kind, name) {
    return node_path_1.default.join(sdkfolder, 'model', kind, name + '.aontu');
}
// The directory holding a kind's definitions.
function definitionFolder(sdkfolder, kind) {
    return node_path_1.default.join(sdkfolder, 'model', kind);
}
// The include list beside them.
function indexName(kind) {
    return kind + '-index.aontu';
}
// Every item of `kind` a `.sdk` folder DEFINES, sorted. Sorted because it
// feeds an exact-set comparison against a manifest and, through
// `availableFeatures`, the feature-trim catalogue — both of which are compared
// as text, so a readdir order that varies by filesystem would vary the result.
//
// An absent directory is not an error: a package providing only features has
// no `model/target/`, and that is the normal shape of a feature package.
function definitionNames(fs, sdkfolder, kind) {
    const dir = definitionFolder(sdkfolder, kind);
    const index = indexName(kind);
    // `existsSync` is true for a REGULAR FILE and for a directory this process
    // cannot read, so guarding on it and then calling `readdirSync` let a bare
    // `ENOTDIR`/`EACCES` escape to callers that have no catch — including
    // `featureCatalogue`, which runs on every ordinary `target add`, so the
    // whole add aborted with an errno instead of a diagnostic. Not-a-readable-
    // directory is the same answer as not-there: this kind defines nothing
    // here.
    let entries;
    try {
        entries = fs.readdirSync(dir);
    }
    catch (err) {
        return [];
    }
    return entries
        .filter((n) => n.endsWith('.aontu') && index !== n)
        .map((n) => n.replace(/\.aontu$/, ''))
        .sort();
}
//# sourceMappingURL=definition.js.map