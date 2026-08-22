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
exports.registerInstalled = registerInstalled;
exports.nameConflict = nameConflict;
exports.lastSegment = lastSegment;
const node_path_1 = __importDefault(require("node:path"));
const struct_1 = require("@voxgig/struct");
const types_1 = require("../types");
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
        // The alias becomes a DESTINATION: `model/<kind>/<name>.aon`,
        // `src/cmp/<name>/`, `tm/<name>/` — all written, and `target add`
        // overwrites what it writes. `go~..` therefore redirects the copy out of
        // the target-specific directory and over unrelated scaffold. Checked
        // against the same grammar the manifest applies to a name, because it is
        // the same thing: what the item is called once installed.
        if (!manifest_1.ITEM_NAME_RE.test(name)) {
            throw new Error('Invalid ' + kind + ' alias: ' + JSON.stringify(name) +
                ' in ' + ref + '\n  an alias is a NAME (matching ' +
                manifest_1.ITEM_NAME_RE.source + '), not a path — it becomes the directory the ' +
                kind + ' is installed into');
        }
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
        package: sourcePackage(fs, folder, kind, origname, ctx$),
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
//
// Tolerant is not the same as credulous. The SHAPE is checked before the name
// is believed, because `package:` provenance is what `package update` later
// acts on: recording a project as belonging to `@acme/sdkgen-iot` on the
// strength of a file that declares no schema version and no `provides` would
// point a future update at a package that cannot be added at all. A manifest
// that would fail validation is treated exactly like one that would not
// parse — warn, and record nothing.
function sourcePackage(fs, folder, kind, origname, ctx$) {
    const read = (0, manifest_1.readManifest)(fs, folder);
    if (null != read.err) {
        warnManifest(ctx$, read.file, read.err);
        return undefined;
    }
    if (null == read.manifest) {
        return undefined;
    }
    const shape = (0, manifest_1.checkShape)(read.manifest, read.file);
    if (0 < shape.length) {
        warnManifest(ctx$, read.file, shape.map((f) => f.note).join('; '));
        return undefined;
    }
    // The manifest must actually CLAIM this item. A package may carry a
    // definition it deliberately does not list — that is what the
    // `manifest-item-unclaimed` warning is about, "nothing will install it" —
    // and stamping the package name onto one anyway would record that
    // `@acme/sdkgen-iot` supplied something `package add @acme/sdkgen-iot`
    // would never install, which is exactly the equivalence the comment at the
    // call site rests on. `package update` would then act on it.
    const claimed = read.manifest.provides?.[kind];
    if (!Array.isArray(claimed) || !claimed.includes(origname)) {
        ctx$.log?.info({
            point: 'package-item-unclaimed', file: read.file, kind, name: origname,
            note: read.file + ': ' + kind + ' `' + origname + '` is not listed in ' +
                '`provides.' + kind + '`, so the copy records no `package` ' +
                'provenance — add it to the manifest if the package supplies it'
        });
        return undefined;
    }
    return read.manifest.name;
}
function warnManifest(ctx$, file, err) {
    ctx$.log?.warn({
        point: 'package-manifest-unreadable', file, err,
        note: file + ': ignoring an unusable package manifest (' + err +
            '); the copy records no `package` provenance'
    });
}
// Teach the IN-MEMORY model about items that have just been installed.
//
// An action reads `actx.model`, compiled from `model/sdk.aontu` before the
// run. Writing `model/target/iotgo.aon` does not change it and nothing
// recompiles mid-process, so anything later in the SAME command behaves as if
// the item is not installed.
//
// That is not cosmetic. `feature add` copies a feature's source into every
// target IN THE MODEL, using the two-tree lookup that reaches a feature
// package's overlay — so a target missing from the model gets source only
// from its own tree. For a target and an active feature that come from
// DIFFERENT packages, that means no source at all: the overlay is never
// consulted for it, and the target's own tree does not have it. Silent, bar
// one `feature-source-missing` warning.
//
// ONE definition, called by `target_add` before its own fan-out and by
// `package add` after each kind, because two places computing what to record
// is how the recorded values drift from the stamped ones.
function registerInstalled(kind, refs, ctx$) {
    const kit = ctx$.model?.main?.[types_1.KIT];
    if (null == kit) {
        return;
    }
    const items = kit[kind] = kit[kind] ?? {};
    for (const ref of refs) {
        let source;
        try {
            source = resolveSource(ref, kind, ctx$);
        }
        catch (err) {
            ctx$.log?.warn({
                point: 'model-register-failed', kind, ref, err: err.message,
                note: ref + ': could not be added to the in-memory model (' +
                    err.message + '); anything later in this command will behave as ' +
                    'if it is not installed'
            });
            continue;
        }
        // Merge, never replace: the model may already carry the project's own
        // configuration for this item, which is the project's, not the source's.
        items[source.name] = {
            ...(items[source.name] ?? {}),
            name: source.name,
            base: source.base,
            origname: source.origname,
            ...(null == source.package ? {} : { package: source.package }),
        };
    }
}
// Is this name already installed FROM SOMEWHERE ELSE?
//
// `add` is overwrite, deliberately — that is how a resync works. But
// overwriting one package's target with a different package's target of the
// same name is not a resync, it is a collision, and doing it silently
// replaces a working target's model, components and templates with another's.
//
// Returns the conflicting record, or undefined when the name is free or is
// the SAME source (which is a resync and must keep working).
function nameConflict(kind, source, ctx$) {
    const declared = ctx$.model?.main?.[types_1.KIT]?.[kind]?.[source.name];
    if (null == declared || 'object' !== typeof declared) {
        return undefined;
    }
    // Nothing recorded — a copy predating provenance. It cannot be shown to be
    // a different source, and refusing on a suspicion would block every
    // pre-provenance project from adopting a package.
    if (null == declared.base || '' === declared.base) {
        return undefined;
    }
    const samePackage = null != source.package && '' !== source.package &&
        declared.package === source.package;
    const sameBase = normaliseBase(declared.base) === normaliseBase(source.base);
    return (samePackage || sameBase) ? undefined : declared;
}
function normaliseBase(base) {
    return node_path_1.default.normalize(String(base ?? '')).split(node_path_1.default.sep).join('/');
}
function capitalise(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
//# sourceMappingURL=resolve.js.map