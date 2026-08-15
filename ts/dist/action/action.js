"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateIndex = void 0;
exports.appendIndexEntries = appendIndexEntries;
exports.removeIndexEntries = removeIndexEntries;
exports.hasIndexEntry = hasIndexEntry;
exports.parseAddNames = parseAddNames;
exports.loadContent = loadContent;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const indexEntry = (name) => `@"${name}.aontu"`;
// Is this name already included by the index?
//
// LINE-EXACT, not substring. A substring test reads a COMMENTED-OUT entry as
// present — `# @"go.aontu"` contains `@"go.aontu"` — so `target add go` on a
// project that had commented the include out silently appended nothing, and
// the target stayed absent from the model with no error anywhere. Aontu's
// comment marker is `#`, and commenting an include out is the obvious way to
// switch a target off by hand, so this is a state projects really reach.
//
// The line is trimmed first: the indexes are written with no indentation, but
// a hand-edited one may carry some, and indentation does not change what
// aontu includes.
function hasIndexEntry(content, name) {
    const entry = indexEntry(name);
    return content.split('\n').some((line) => line.trim() === entry);
}
// Append `@"<name>.aontu"` import lines for each name not already present in
// the index content. Checking against the accumulating result (not the
// original) means duplicate names in the same call are added at most once.
function appendIndexEntries(content, names) {
    let out = content;
    for (const n of names) {
        if (!hasIndexEntry(out, n)) {
            out += '\n' + indexEntry(n);
        }
    }
    return out;
}
// Drop the `@"<name>.aontu"` line for each name — the inverse of
// appendIndexEntries, matching line-exact for the same reasons.
//
// Nothing calls this yet: a `remove` action is the fast-follow this exists
// for (see docs/design/sdkgen-packages.md), and it is written here beside its
// inverse so the two cannot drift on how an entry is recognised.
function removeIndexEntries(content, names) {
    const drop = new Set(names.map(indexEntry));
    return content
        .split('\n')
        .filter((line) => !drop.has(line.trim()))
        .join('\n');
}
const UpdateIndex = (0, jostraca_1.cmp)(function UpdateIndex(props) {
    (0, jostraca_1.Content)(appendIndexEntries(props.content, props.names));
});
exports.UpdateIndex = UpdateIndex;
// Names given to an `add` action: every positional after the subcommand is
// a name, each possibly comma-separated — `target add ts,py,go` and
// `target add ts py go` are equivalent (space-separated extras used to be
// silently dropped).
function parseAddNames(args) {
    return args.slice(2)
        .flatMap((a) => 'string' === typeof a ? a.split(',') : a)
        .filter((n) => null != n && '' !== n);
}
function loadContent(actx, which) {
    which = Array.isArray(which) ? which : [which];
    const content = {};
    const fs = actx.fs();
    const modelfolder = node_path_1.default.dirname(actx.url);
    which.map((w) => {
        const indexfile = node_path_1.default.join(modelfolder, w, w + '-index.aontu');
        const indexcontent = fs.readFileSync(indexfile, 'utf8');
        content[`${w}_index`] = indexcontent;
    });
    return content;
}
//# sourceMappingURL=action.js.map