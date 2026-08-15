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
    let aliasref = ref;
    let origname = lastSegment(aliasref);
    const aliasing = ref.split('~');
    if (1 < aliasing.length) {
        aliasref = aliasing[0];
        name = aliasing.slice(1).join('~');
        origname = lastSegment(aliasref);
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
        model: node_path_1.default.join(folder, 'model', kind, origname + '.aontu'),
    };
}
function capitalise(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
//# sourceMappingURL=resolve.js.map