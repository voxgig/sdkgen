"use strict";
// Where a `<kind> add <ref>` gets its definition from.
//
// One resolver for every KIND of thing an add can install — targets today,
// features as of this change, more later — because the ref grammar is the
// same whatever is being added, and it had drifted: `target add` accepted a
// path ref and an alias, while `feature add` accepted only a bare name and
// read from a hardcoded `node_modules/@voxgig/sdkgen`. A feature defined
// anywhere else could not be added at all.
//
// It lives in its own module rather than in `target.ts` because `target.ts`
// imports `feature_add`, so a resolver there would put `feature.ts` and
// `target.ts` in a require cycle.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUNDLED = void 0;
exports.resolveSource = resolveSource;
exports.lastSegment = lastSegment;
const node_path_1 = __importDefault(require("node:path"));
const struct_1 = require("@voxgig/struct");
const definition_1 = require("../helpers/definition");
const manifest_1 = require("../helpers/manifest");
// The bundled scaffold: what a bare name resolves to.
const BUNDLED = 'node_modules/@voxgig/sdkgen/project/.sdk';
exports.BUNDLED = BUNDLED;
// Last path segment of a ref. A ref may be a bare name ('go'), a
// package-relative path ('@acme/kit/go'), or an ABSOLUTE path — and on Windows
// an absolute path is separated by `\`, so splitting on '/' alone hands back
// the whole path as the name and every lookup below then misses. On POSIX
// Path.sep IS '/', so this is the same split it always was.
function lastSegment(ref) {
    return (0, struct_1.getelem)(ref.split('/').flatMap((p) => p.split(node_path_1.default.sep)), -1);
}
function resolveSource(ref, kind, ctx$) {
    const root = ctx$.folder;
    const fs = ctx$.fs();
    let folder = node_path_1.default.normalize(node_path_1.default.join(root, BUNDLED));
    let name = lastSegment(ref);
    // `<ref>~<alias>` installs the ref's definition under a different name.
    //
    // The `~` is only an alias separator in the LAST SEGMENT, which is where a
    // name can appear. Splitting the whole ref on it broke any ref whose PATH
    // contains a tilde — and on Windows that is routine: an 8.3 short name like
    // `C:\Users\RUNNER~1\AppData\Local\Temp\pkg\circuitbreaker` was read as
    // "install `C:\Users\RUNNER` under the alias `1\AppData\...`", which then
    // looked for `C:\Users\.sdk`. Legal on POSIX too — a directory may simply
    // be called `foo~bar`.
    const sep = Math.max(ref.lastIndexOf('/'), ref.lastIndexOf(node_path_1.default.sep));
    const dir = sep < 0 ? '' : ref.slice(0, sep + 1);
    const last = sep < 0 ? ref : ref.slice(sep + 1);
    const aliasing = last.split('~');
    const origlast = aliasing[0];
    let aliasref = dir + origlast;
    let origname = origlast;
    if (1 < aliasing.length) {
        name = aliasing.slice(1).join('~');
    }
    const search = [];
    let found = false;
    // Windows: an absolute ref is `D:\a\...` or `D:/a/...`, and a Path.join'd
    // one carries backslashes, so neither `includes('/')` nor `startsWith('/')`
    // recognises it. Path.isAbsolute and Path.sep are platform-correct and
    // reduce to the same answers on POSIX.
    if (aliasref.includes('/') || aliasref.includes(node_path_1.default.sep)) {
        // NOTE: the last path element of the ref is the name, not a folder.
        const aliasbase = node_path_1.default.dirname(aliasref);
        if (!node_path_1.default.isAbsolute(aliasref)) {
            folder = node_path_1.default.normalize(node_path_1.default.join(root, 'node_modules', aliasbase, '.sdk'));
            search.push(folder);
            found = fs.existsSync(folder);
            if (!found) {
                folder = node_path_1.default.normalize(node_path_1.default.join(root, aliasbase, '.sdk'));
                search.push(folder);
                found = fs.existsSync(folder);
            }
        }
        else {
            folder = node_path_1.default.normalize(node_path_1.default.join(aliasbase, '.sdk'));
            search.push(folder);
            found = fs.existsSync(folder);
        }
    }
    else {
        search.push(folder);
        found = fs.existsSync(folder);
    }
    if (!found) {
        throw new Error(capitalise(kind) + ' folder not found in:\n' + search.join('\n  '));
    }
    // `base` is the folder relative to the project root. Compare with the
    // PLATFORM separator: on Windows `root + '/'` never prefixes a normalised
    // absolute path, so the root would not be stripped and `base` would stay
    // absolute. Normalise both sides first for the same reason.
    const nroot = node_path_1.default.normalize(root);
    const rootslash = nroot.endsWith(node_path_1.default.sep) ? nroot : nroot + node_path_1.default.sep;
    return {
        name,
        origname,
        folder,
        // '/'-normalised, unlike `folder`. `base` is the one value here that gets
        // WRITTEN INTO A COMMITTED FILE (the provenance stamp), so it must not
        // depend on the OS that ran the add: on Windows Path.join yields
        // `node_modules\@voxgig\sdkgen\project\.sdk`, so the same project resynced
        // on Linux and on Windows produced two different model files and each
        // churned the other's. Forward slashes are accepted by every Node path API
        // on Windows, so the readers are unaffected.
        base: (folder.startsWith(rootslash)
            ? folder.slice(rootslash.length)
            : folder).split(node_path_1.default.sep).join('/'),
        // Path.join, not concatenation: an absolute Windows ref makes `folder`
        // backslash-separated, and appending '/model/...' produced a mixed-
        // separator path that some readers handle and others do not.
        model: (0, definition_1.definitionPath)(folder, kind, origname),
        // The package that provided it, when the source declares a manifest.
        // Read here rather than by the callers so a DIRECT ref
        // (`target add ../pkg/iot-go`) records the same provenance
        // `package add @acme/sdkgen-iot` would — the two spellings install the
        // same thing, so they must record the same thing.
        //
        // A manifest is OPTIONAL for a direct ref and its absence is not a
        // finding here: a bare `.sdk`-shaped folder is still a valid source, and
        // every consumer's existing fixtures are exactly that. It is `package
        // add` that requires one.
        package: sourcePackage(fs, folder, ctx$),
    };
}
// The manifest's package name, or undefined.
//
// TOLERANT BY DESIGN, on this path. A malformed manifest must not break
// `target add` — the definition, the components and the templates are all
// present and correct, and refusing to install them because a JSON file
// beside them has a trailing comma would be a worse outcome than installing
// them with one provenance line missing. `package add` validates properly and
// refuses; this only reads a name.
function sourcePackage(fs, folder, ctx$) {
    const read = (0, manifest_1.readManifest)(fs, folder);
    if (null != read.err) {
        ctx$.log?.warn({
            point: 'package-manifest-unreadable', file: read.file, err: read.err,
            note: read.file + ': ignoring an unreadable package manifest (' +
                read.err + '); the copy records no `package` provenance'
        });
        return undefined;
    }
    const name = read.manifest?.name;
    return 'string' === typeof name && '' !== name ? name : undefined;
}
function capitalise(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
//# sourceMappingURL=resolve.js.map