"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUNDLED = void 0;
exports.resolveSource = resolveSource;
exports.recordedRef = recordedRef;
exports.isBare = isBare;
exports.registerInstalled = registerInstalled;
exports.nameConflict = nameConflict;
exports.lastSegment = lastSegment;
const kindCollection_1 = require("../helpers/kindCollection");
const node_path_1 = __importDefault(require("node:path"));
const struct_1 = require("@voxgig/struct");
const types_1 = require("../types");
const definition_1 = require("../helpers/definition");
const manifest_1 = require("../helpers/manifest");
const BUNDLED = 'node_modules/@voxgig/sdkgen/project/.sdk';
exports.BUNDLED = BUNDLED;
function lastSegment(ref) {
    return (0, struct_1.getelem)(ref.split('/').flatMap((p) => p.split(node_path_1.default.sep)), -1);
}
function resolveSource(ref, kind, ctx$) {
    // Registration and copying must resolve a bare resync name identically.
    const declared = (0, kindCollection_1.kindCollection)(ctx$.model, kind)?.[ref];
    ref = (isBare(ref) && recordedRef(declared, ref)) || ref;
    const root = ctx$.folder;
    const fs = ctx$.fs();
    let folder = node_path_1.default.normalize(node_path_1.default.join(root, BUNDLED));
    let name = lastSegment(ref);
    const sep = Math.max(ref.lastIndexOf('/'), ref.lastIndexOf(node_path_1.default.sep));
    const dir = sep < 0 ? '' : ref.slice(0, sep + 1);
    const last = sep < 0 ? ref : ref.slice(sep + 1);
    const aliasing = last.split('~');
    const origlast = aliasing[0];
    let aliasref = dir + origlast;
    let origname = origlast;
    if (1 < aliasing.length) {
        name = aliasing.slice(1).join('~');
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
        base: (folder.startsWith(rootslash)
            ? folder.slice(rootslash.length)
            : folder).split(node_path_1.default.sep).join('/'),
        // Path.join, not concatenation: an absolute Windows ref makes `folder`
        // backslash-separated, and appending '/model/...' produced a mixed-
        // separator path that some readers handle and others do not.
        model: (0, definition_1.definitionPathAny)(fs, folder, kind, origname),
        package: sourcePackage(fs, folder, kind, origname, ctx$),
    };
}
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
function registerInstalled(kind, refs, ctx$) {
    const kit = ctx$.model?.main?.[types_1.KIT];
    if (null == kit) {
        return;
    }
    const items = (0, kindCollection_1.kindCollection)(ctx$.model, kind, true);
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
function nameConflict(kind, source, ctx$) {
    const declared = (0, kindCollection_1.kindCollection)(ctx$.model, kind)?.[source.name];
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
    if (samePackage || sameBase) {
        return undefined;
    }
    return providesStill(kind, declared, source, ctx$) ? declared : undefined;
}
function providesStill(kind, declared, source, ctx$) {
    let fs;
    try {
        fs = ctx$.fs();
    }
    catch (err) {
        return true;
    }
    const base = String(declared.base);
    const folder = node_path_1.default.isAbsolute(base) ?
        node_path_1.default.normalize(base) :
        node_path_1.default.normalize(node_path_1.default.join(ctx$.folder, base));
    if (!fs.existsSync(folder)) {
        // Uninstalled, moved, or never fetched. Nothing there to collide with.
        return false;
    }
    const seek = declared.origname || source.name;
    const read = (0, manifest_1.readManifest)(fs, folder);
    const manifest = read.manifest;
    if (null != manifest && 0 === (0, manifest_1.checkShape)(manifest, read.file).length) {
        const names = manifest.provides?.[kind];
        return Array.isArray(names) && names.includes(seek);
    }
    // No manifest, or one too malformed to be believed: a bare `.sdk`-shaped
    // folder is a legal source, and its definition file is the only claim it
    // makes.
    return fs.existsSync((0, definition_1.definitionPathAny)(fs, folder, kind, seek));
}
function recordedRef(declared, name) {
    if (null == declared?.base || '' === declared.base) {
        return undefined;
    }
    const origname = declared.origname || name;
    return node_path_1.default.join(declared.base, '..', origname) +
        (origname === name ? '' : '~' + name);
}
function isBare(ref) {
    return !ref.includes('/') && !ref.includes(node_path_1.default.sep);
}
function normaliseBase(base) {
    return node_path_1.default.normalize(String(base ?? '')).split(node_path_1.default.sep).join('/');
}
function capitalise(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
//# sourceMappingURL=resolve.js.map