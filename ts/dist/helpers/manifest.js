"use strict";
// THE PACKAGE MANIFEST: `sdkgen-package.json`, beside the package's `.sdk`.
//
// See docs/design/sdkgen-packages.md §2.
//
//   <package-root>/
//   ├── sdkgen-package.json      <- this
//   └── .sdk/                    <- shaped exactly like ts/project/.sdk
//
// WHY JSON RATHER THAN AONTU
//
// Consumer models compile under `@voxgig/model`'s strictly-configured parser,
// which accepts `#` comments only — a `//` line is a parse error, and seven
// shipped targets once broke on exactly that (ts/test/model-compile.test.ts
// exists because of it). The manifest is read by the CLI and never unified
// into the model, so JSON keeps it outside that trap entirely.
//
// WHAT IT IS FOR
//
// A package's CLAIM about what it provides, so that:
//
//   - `package add <pkg>` knows what to install without guessing from
//     directory listings;
//   - a typo'd ref fails naming what the package actually provides, rather
//     than resolving to a folder that exists and failing later on a missing
//     file;
//   - an item records WHICH PACKAGE supplied it (`package:` provenance), so a
//     project can be resynced against a newer version of that package.
//
// A claim is worth nothing unless it is checked, so `validateManifest`
// compares it against the trees actually on disk, in both directions: a
// manifest that lies is an error, on-disk extras are a warning.
//
// THE MANIFEST IS OPTIONAL FOR A DIRECT REF. `target add ../pkg/iot-go`
// against a bare `.sdk`-shaped folder keeps working exactly as it does today
// — that is what every existing consumer fixture is — and simply records no
// `package` provenance. Requiring one is `package add`'s business.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEMA = exports.MANIFEST = void 0;
exports.manifestPath = manifestPath;
exports.readManifest = readManifest;
exports.validateManifest = validateManifest;
exports.checkShape = checkShape;
const node_path_1 = __importDefault(require("node:path"));
const definition_1 = require("./definition");
const MANIFEST = 'sdkgen-package.json';
exports.MANIFEST = MANIFEST;
// The manifest schema version this generator understands. Bumped only for a
// BREAKING change to the manifest's own shape; new optional fields do not
// need it. Read from `sdkgen.package` so the gate is the very first thing in
// the file, before anything version-specific is interpreted.
const SCHEMA = 1;
exports.SCHEMA = SCHEMA;
// The manifest path for a `.sdk` folder: its SIBLING, not its child.
//
// The package root is the parent of `.sdk` — which is what `resolveSource`
// already assumes when it probes `<ref-dir>/.sdk`, so the manifest sits where
// the ref already pointed.
function manifestPath(sdkfolder) {
    return node_path_1.default.join(sdkfolder, '..', MANIFEST);
}
function readManifest(fs, sdkfolder) {
    const file = manifestPath(sdkfolder);
    if (!fs.existsSync(file)) {
        return { file };
    }
    let manifest;
    try {
        manifest = JSON.parse(String(fs.readFileSync(file, 'utf8')));
    }
    catch (err) {
        return { file, err: err.message };
    }
    // A JSON scalar or array parses fine and then fails much later, on a
    // property access that reads `undefined`. Reject it here, where the file
    // that caused it is still in hand.
    if (null == manifest || 'object' !== typeof manifest ||
        Array.isArray(manifest)) {
        return { file, err: 'not a JSON object' };
    }
    return { file, manifest };
}
// Is the manifest itself well-formed? Checked before anything reads its
// contents, so a malformed file produces one clear finding rather than a
// cascade of consequences.
function checkShape(manifest, file) {
    const found = [];
    const version = manifest?.sdkgen?.package;
    if (null == version) {
        found.push({
            level: 'error', point: 'manifest-unversioned', file,
            note: file + ': no `sdkgen.package` schema version — this is the gate ' +
                'that says the file is an sdkgen package manifest at all'
        });
    }
    else if (version > SCHEMA) {
        // FORWARD, not backward: a manifest written for a later schema may use
        // fields this generator would misread. Say both numbers — "too new" is
        // actionable (upgrade sdkgen), "invalid" is not.
        found.push({
            level: 'error', point: 'manifest-schema-too-new', file,
            note: file + ': manifest schema version ' + version +
                ' is newer than this generator understands (' + SCHEMA +
                ') — upgrade @voxgig/sdkgen'
        });
    }
    if ('string' !== typeof manifest?.name || '' === manifest.name) {
        found.push({
            level: 'error', point: 'manifest-unnamed', file,
            note: file + ': no `name` — the name is what an item records as its ' +
                '`package` provenance and what `package update` is given'
        });
    }
    const provides = manifest?.provides;
    if (null == provides || 'object' !== typeof provides ||
        Array.isArray(provides)) {
        found.push({
            level: 'error', point: 'manifest-provides-missing', file,
            note: file + ': no `provides` map — a package that provides nothing ' +
                'has nothing to add (use `{}` to say so deliberately)'
        });
    }
    else {
        for (const [kind, names] of Object.entries(provides)) {
            if (!Array.isArray(names) ||
                names.some((n) => 'string' !== typeof n || '' === n)) {
                found.push({
                    level: 'error', point: 'manifest-provides-malformed', file, kind,
                    note: file + ': `provides.' + kind +
                        '` is not a list of names'
                });
            }
        }
    }
    return found;
}
// Does the package's disk match its claim?
//
// BOTH DIRECTIONS, because they fail differently and neither implies the
// other:
//
//   claim without disk  -> ERROR. `package add` would try to install it and
//                          break partway through, having already written the
//                          items listed before it.
//   disk without claim  -> WARN. Everything works; the author has shipped
//                          something nobody can discover, which is nearly
//                          always a forgotten manifest edit.
//
// `kindRequires` is supplied by the caller rather than imported, because the
// kind registry lives in `action/` and this is a helper — the dependency has
// to point that way, not this way.
function validateManifest(fs, sdkfolder, manifest, kinds) {
    const file = manifestPath(sdkfolder);
    const shape = checkShape(manifest, file);
    // A malformed manifest cannot be compared against anything — the checks
    // below would read `undefined` and invent findings about it.
    if (0 < shape.length) {
        return shape;
    }
    const found = [];
    const provides = manifest.provides;
    for (const [kind, names] of Object.entries(provides)) {
        const def = kinds[kind];
        if (null == def) {
            found.push({
                level: 'error', point: 'manifest-unknown-kind', file, kind,
                note: file + ': `provides.' + kind + '` — unknown kind; this ' +
                    'generator knows: ' + Object.keys(kinds).sort().join(', ')
            });
            continue;
        }
        for (const name of names) {
            for (const missing of missingPaths(fs, sdkfolder, kind, name, def)) {
                found.push({
                    level: 'error', point: 'manifest-item-missing', file, kind, name,
                    note: file + ': claims ' + kind + ' `' + name +
                        '` but ' + missing + ' is not in the package'
                });
            }
        }
    }
    // The other direction. Only for kinds the manifest MENTIONS plus the ones
    // this generator knows — a directory named after a kind nobody registered
    // is already reported above if claimed, and is not this check's business if
    // not.
    for (const kind of Object.keys(kinds)) {
        const claimed = new Set(provides[kind] ?? []);
        for (const name of (0, definition_1.definitionNames)(fs, sdkfolder, kind)) {
            if (!claimed.has(name)) {
                found.push({
                    level: 'warn', point: 'manifest-item-unclaimed', file, kind, name,
                    note: file + ': model/' + kind + '/' + name +
                        '.aontu is in the package but not listed in `provides.' + kind +
                        '` — nothing will install it'
                });
            }
        }
    }
    return found;
}
// Every path an item of this kind needs, that is not there.
//
// The definition file is implied for every kind; `requires` adds whatever
// else the kind needs (a target's component and template trees). Returned as
// package-relative strings because that is what an error message should say —
// the absolute path is this machine's business, not the author's.
function missingPaths(fs, sdkfolder, kind, name, def) {
    const rels = ['model/' + kind + '/' + name + '.aontu'];
    for (const req of def.requires ?? []) {
        rels.push(req.split('{name}').join(name));
    }
    return rels.filter((rel) => !fs.existsSync(node_path_1.default.join(sdkfolder, ...rel.split('/'))));
}
//# sourceMappingURL=manifest.js.map