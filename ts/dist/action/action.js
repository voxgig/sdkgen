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
// An index line that is an ACTIVE include, and the name it includes — or
// undefined for a blank line, a comment, or anything else.
//
// Parsed rather than compared as a string, because both spellings around an
// include are legal aontu and mean opposite things:
//
//   @"go.aontu"                 -> active, name 'go'
//   @"go.aontu"  # pinned       -> active, name 'go'  (trailing comment)
//     @"go.aontu"               -> active, name 'go'  (indented)
//   # @"go.aontu"               -> NOT active
//
// A substring test (what this used to be) reads the commented-out form as
// present, so `target add go` on a project that had switched the target off
// by hand appended nothing and reported success while the target stayed
// absent from the model. A whole-line equality test fixes that but then
// misses the trailing-comment form, and appends a SECOND active include.
const INDEX_ENTRY_RE = /^\s*@"([^"]+)\.aontu"\s*(?:#.*)?$/;
function indexEntryName(line) {
    const m = line.match(INDEX_ENTRY_RE);
    return null == m ? undefined : m[1];
}
// Is this name already included by the index?
function hasIndexEntry(content, name) {
    return content.split('\n')
        .some((line) => indexEntryName(line) === name);
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
    const drop = new Set(names);
    return content
        .split('\n')
        .filter((line) => {
        const name = indexEntryName(line);
        return undefined === name || !drop.has(name);
    })
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
// The current index file for each kind, which `UpdateIndex` appends to.
//
// `seed` IS THE UPGRADE PATH. A project scaffolded before a kind existed has
// no `model/<kind>/<kind>-index.aontu` — every project alive today is in
// exactly that position for `docs` — and reading it unguarded made the FIRST
// `docs add` in any existing project fail on ENOENT before it wrote anything.
//
// Seeded per call rather than defaulted for every kind: a missing
// `target-index.aontu` in a scaffolded project is a broken project, and
// quietly recreating it would hide that. A kind the project has never used is
// a different thing, and only its own action knows which case it is in.
function loadContent(actx, which, seed) {
    which = Array.isArray(which) ? which : [which];
    const content = {};
    const fs = actx.fs();
    const modelfolder = node_path_1.default.dirname(actx.url);
    which.map((w) => {
        const indexfile = node_path_1.default.join(modelfolder, w, w + '-index.aontu');
        content[`${w}_index`] = (null != seed?.[w] && !fs.existsSync(indexfile)) ?
            seed[w] : fs.readFileSync(indexfile, 'utf8');
    });
    return content;
}
//# sourceMappingURL=action.js.map