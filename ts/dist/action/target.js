"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.action_target = action_target;
exports.target_add = target_add;
exports.resolveTarget = resolveTarget;
exports.trimFeatures = trimFeatures;
exports.readTargetFeature = readTargetFeature;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const util_1 = require("@voxgig/util");
const dryrun_1 = require("../helpers/dryrun");
const stdrep_1 = require("../helpers/stdrep");
const struct_1 = require("@voxgig/struct");
const aontu_1 = require("aontu");
const types_1 = require("../types");
const utility_1 = require("../utility");
const featureSource_1 = require("../helpers/featureSource");
const feature_1 = require("./feature");
const action_1 = require("./action");
const CMD_MAP = {
    add: cmd_target_add
};
async function action_target(args, actx) {
    const cmdname = args[1];
    const cmd = CMD_MAP[cmdname];
    if (null == cmd) {
        throw new utility_1.SdkGenError('Unknown target cmd: ' + cmdname);
    }
    return await cmd(args, actx);
}
async function cmd_target_add(args, actx) {
    return target_add((0, action_1.parseAddNames)(args), actx);
}
// Code API
async function target_add(targets, actx) {
    // const jostraca = Jostraca()
    const jostraca = actx.jostraca;
    const opts = {
        fs: actx.fs,
        folder: actx.folder,
        log: actx.log.child({ cmp: 'jostraca' }),
        meta: {
            // model: actx.model,
            // tree: actx.tree,
            url: actx.url,
            content: (0, action_1.loadContent)(actx, 'target')
        },
        model: actx.model,
        // Dry run must be passed per-call, not left to the Jostraca instance.
        // jostraca's `generate` runs its own options through OptionsShape FIRST,
        // which fills in `control.dryrun: false`, and only then merges
        // `deep({}, gOpts.control, opts.control)` — so the shape default silently
        // OVERRIDES the instance-level flag. `-y target add ts` printed
        // ** DRY RUN ** and wrote every file. (Same trap as the `existing` FIX
        // note in jostraca.js.)
        control: {
            dryrun: !!actx.opts.dryrun
        },
    };
    opts.log.info({
        point: 'target-start',
        note: (actx.opts.dryrun ? '** DRY RUN **' : '')
    });
    // The `test` feature is required by every generated target (SDK.test()
    // depends on it), so ensure it is added even if the model does not yet
    // declare it.
    //
    // Everything else has to be BOTH declared and active: `active` defaults to
    // false in the schema, and a feature the model has switched off should not
    // have its source land in the project. This used to be a plain
    // Object.keys(), so `retry: { active: false }` still shipped every retry
    // source file.
    const featuremodel = actx.model.main[types_1.KIT]?.feature ?? {};
    const features = Array.from(new Set([
        'test',
        ...Object.keys(featuremodel).filter((n) => false !== featuremodel[n]?.active),
    ]));
    const jres = await jostraca.generate(opts, () => TargetRoot({ targets, features, actx }));
    (0, util_1.showChanges)(opts.log, 'target-result', jres);
    if (actx.opts.dryrun) {
        (0, dryrun_1.showDryrun)(opts.log, 'target-result', jres, actx.folder);
    }
    // feature_add copies feature templates for targets already registered in
    // the model. The targets added above are not in the in-memory model yet,
    // so TargetRoot copies their feature templates itself.
    await (0, feature_1.feature_add)(features, actx);
    opts.log.info({
        point: 'target-end',
        note: (actx.opts.dryrun ? '** DRY RUN **' : '')
    });
    return {
        jres
    };
}
const TargetRoot = (0, jostraca_1.cmp)(function TargetRoot(props) {
    const { ctx$, targets, features } = props;
    const { model, log } = ctx$;
    // TODO: jostraca - make from value easier to specify 
    // const tfolder = 'node_modules/@voxgig/sdkgen/project/.sdk'
    (0, jostraca_1.Project)({}, () => {
        // Resolved names of every target in this run. The index File is
        // re-rendered per target and the last render wins, so each render must
        // carry all names seen so far, not just its own.
        const tnames = [];
        (0, jostraca_1.each)(targets, (n) => {
            const tref = n.val$;
            log.info({
                point: 'target-build',
                target: tref,
                note: tref
            });
            const { tname, tfolder, torigname, base } = resolveTarget(tref, ctx$);
            tnames.push(tname);
            const targetNote = tname + (tname != tref ? ' ref:' + tref : '');
            log.info({
                point: 'target-name', name: tname, folder: tfolder,
                target: tref,
                tname,
                note: tname + (tname != torigname ? 'original' + torigname : '') + ' from:' + tfolder
            });
            (0, jostraca_1.Folder)({ name: 'model/target' }, () => {
                (0, jostraca_1.Copy)({
                    from: tfolder + '/model/target/' + torigname + '.aontu',
                    // exclude: true
                    replace: {
                        "'BASE'": "'" + base + "'"
                    }
                });
                (0, jostraca_1.File)({ name: 'target-index.aontu' }, () => (0, action_1.UpdateIndex)({
                    content: ctx$.meta.content.target_index,
                    names: tnames,
                }));
            });
            (0, jostraca_1.Folder)({ name: 'src/cmp/' + tname }, () => {
                (0, jostraca_1.Copy)({
                    from: tfolder + '/src/cmp/' + torigname,
                    // exclude: true
                });
            });
            // Copy the whole template tree MINUS the source of every feature the
            // model did not ask for. Which files those are is discovered from the
            // tree rather than assumed (see helpers/featureSource), because each
            // language puts feature source somewhere different.
            const trim = trimFeatures(ctx$, tfolder, torigname, tname, features);
            // Copy only ADDS and overwrites — it never removes, and it never even
            // looks at a file the trim excludes. So a template that this SDK should
            // NOT have lived on at whatever revision it was first copied at, and
            // kept being generated from.
            //
            // That is how 30 cedar repos ended up with tm/go/test/feature_test.go
            // still declaring the nine fh* harness helpers after upstream moved them
            // into feature_harness_test.go: feature_test.go is feature-source, so it
            // is trimmed for an SDK without those features, so Copy skipped it, so
            // the pre-move revision survived every `target add go` those repos ever
            // ran. Generation then emitted it alongside the new harness and the go
            // package failed to compile — "fhHasFeature redeclared in this block".
            //
            // The invariant this restores: tm/<target> == source tree MINUS trim.
            pruneStaleTemplates(ctx$, tfolder + '/tm/' + torigname, 'tm/' + tname, trim);
            (0, jostraca_1.Folder)({ name: 'tm/' + tname }, () => {
                (0, jostraca_1.Copy)({
                    from: tfolder + '/tm/' + torigname,
                    exclude: trim,
                    // Shared with doctor, which re-applies them before comparing.
                    replace: (0, stdrep_1.templateReplacements)(model, tname),
                });
            });
            log.info({
                point: 'target-done', target: tref, note: targetNote
            });
        });
    });
});
// Path patterns that keep a target's unwanted feature source out of the
// project: the source of every AVAILABLE feature the model did not select,
// plus the templates that only compile with the complete feature set.
//
// Returns an empty list — copy the whole tree, as before — when the target
// opts out with `feature: { trim: false }`, or when its model cannot be
// read. Trimming a target whose templates are not ready for it produces a
// project that does not build, so an unreadable declaration must fail safe
// rather than fail tidy.
// Bring the consumer's `tm/<target>` back to the invariant that Copy alone
// cannot maintain: it must contain EXACTLY the source tree minus the files
// this SDK's feature set trims away.
//
// Copy adds and overwrites. It does not remove, and it does not touch an
// excluded file at all — so both of these persist silently forever:
//
//   - a template the toolchain has RETIRED (absent from the source tree);
//   - a template this SDK should not have (present in source, but trimmed),
//     frozen at whatever revision it was first copied at.
//
// The second is the one that bit: tm/go/test/feature_test.go is feature
// source, so it is trimmed for an SDK without those features, so it was never
// refreshed after upstream moved the fh* harness helpers out of it.
//
// tm/ is toolchain-owned — the scaffold rewrites it on every add-target, and
// model/guide/guide.aontu is the one file a user owns (merged separately by
// create-sdkgen) — so removing what the toolchain says should not be there is
// consistent with how the rest of that tree is already treated.
function pruneStaleTemplates(ctx$, fromDir, toRel, trim) {
    const { log } = ctx$;
    const fs = ctx$.fs();
    const folder = ctx$.folder ?? '.';
    const destDir = node_path_1.default.join(folder, toRel);
    const listRel = (root) => {
        const out = [];
        const walk = (dir, rel) => {
            let entries;
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            }
            catch (e) {
                return;
            }
            for (const ent of entries) {
                const child = node_path_1.default.join(dir, ent.name);
                const childRel = '' === rel ? ent.name : rel + '/' + ent.name;
                if (ent.isDirectory()) {
                    walk(child, childRel);
                }
                else {
                    out.push(childRel);
                }
            }
        };
        walk(root, '');
        return out;
    };
    const sourceFiles = listRel(fromDir);
    // An unreadable source tree must not be read as "everything is stale" — that
    // would empty the destination.
    if (0 === sourceFiles.length) {
        return;
    }
    // What SHOULD be present: source, minus anything the trim excludes. The trim
    // patterns are matched against the source-relative path, the same way Copy
    // applies them.
    const trimmed = (rel) => trim.some((re) => re.test(rel));
    const want = new Set(sourceFiles.filter((rel) => !trimmed(rel)));
    const stale = listRel(destDir).filter((rel) => !want.has(rel));
    if (0 === stale.length) {
        return;
    }
    const removed = [];
    for (const rel of stale) {
        try {
            fs.unlinkSync(node_path_1.default.join(destDir, rel));
            removed.push(rel);
        }
        catch (e) {
            log.warn({
                point: 'target-template-prune', target: toRel, file: rel,
                note: 'could not remove stale template ' + rel + ': ' + e.message
            });
        }
    }
    if (0 < removed.length) {
        log.info({
            point: 'target-template-prune', target: toRel, count: removed.length,
            files: removed,
            note: toRel + ': removed ' + removed.length +
                ' stale template(s) the toolchain no longer provides for this SDK'
        });
    }
}
function trimFeatures(ctx$, tfolder, torigname, tname, features) {
    const { log } = ctx$;
    const fs = ctx$.fs();
    const cfg = readTargetFeature(ctx$, tfolder, torigname, tname);
    if (false === cfg.trim) {
        log.info({
            point: 'target-feature-trim', target: tname, trim: false,
            note: tname + ': feature trim disabled, copying all feature source'
        });
        return [];
    }
    // `base` is not a declared feature — it is the always-present foundation
    // every other feature builds on — so it is never a trim candidate.
    const selected = new Set(['base', ...(features ?? [])]);
    const available = (0, featureSource_1.availableFeatures)(fs, tfolder);
    const drop = (0, featureSource_1.findFeatureSources)(fs, tfolder + '/tm/' + torigname, available)
        .filter((s) => !selected.has(s.name));
    const trimmed = 0 < drop.length;
    log.info({
        point: 'target-feature-trim', target: tname, trim: true,
        drop: drop.map((s) => s.name),
        note: tname + ': ' + (trimmed ?
            ('dropping ' + drop.length + ' unselected feature source entries') :
            'all available features selected')
    });
    return [
        ...(0, featureSource_1.featureExcludes)(drop),
        // The cross-feature test suite is only excluded when something WAS
        // trimmed; a project carrying the full set keeps its feature tests.
        ...(trimmed ? (0, featureSource_1.fullsetExcludes)(cfg.fullset) : []),
    ];
}
// Load a target's `feature` declaration from its own model file.
//
// The target being added is not in the in-memory model yet (that is what
// `target add` is for), so this reads the very file that is about to be
// copied into `model/target/`. Each shipped target model is self-contained,
// so Aontu can resolve it on its own.
function readTargetFeature(ctx$, tfolder, torigname, tname) {
    const { log } = ctx$;
    const fs = ctx$.fs();
    const path = tfolder + '/model/target/' + torigname + '.aontu';
    try {
        const errs = [];
        const model = new aontu_1.Aontu().generate(fs.readFileSync(path, 'utf8'), { path, errs });
        if (0 < errs.length) {
            throw new Error(errs.map((e) => e.msg || String(e)).join('\n'));
        }
        const feature = model?.main?.[types_1.KIT]?.target?.[torigname]?.feature ?? {};
        return {
            trim: false !== feature.trim,
            fullset: Array.isArray(feature.fullset) ? feature.fullset : [],
        };
    }
    catch (err) {
        log.warn({
            point: 'target-feature-model', target: tname, path,
            err: err.message,
            note: tname + ': cannot read target model (' + err.message +
                '); copying all feature source'
        });
        return { trim: false, fullset: [] };
    }
}
// Last path segment of a ref. A ref may be a bare target name ('go'), a
// package-relative path ('@acme/kit/go'), or an ABSOLUTE path — and on Windows
// an absolute path is separated by `\`, so splitting on '/' alone hands back
// the whole path as the target name and every tree lookup below then misses.
// On POSIX Path.sep IS '/', so this is the same split it always was.
function lastSegment(ref) {
    return (0, struct_1.getelem)(ref.split('/').flatMap((p) => p.split(node_path_1.default.sep)), -1);
}
function resolveTarget(tref, ctx$) {
    let tname = tref;
    let torigname = tref;
    let tfolder = 'node_modules/@voxgig/sdkgen/project/.sdk';
    const root = ctx$.folder;
    const fs = ctx$.fs();
    let fulltfolder = node_path_1.default.normalize(node_path_1.default.join(root, tfolder));
    tname = lastSegment(tref);
    let aliasref = tref;
    torigname = lastSegment(aliasref);
    const aliasing = tref.split('~');
    if (1 < aliasing.length) {
        aliasref = aliasing[0];
        tname = aliasing.slice(1).join('~');
        torigname = lastSegment(aliasref);
    }
    const search = [];
    let found = false;
    // Windows: an absolute ref is `D:\a\...` or `D:/a/...`, and a Path.join'd
    // one carries backslashes, so neither `includes('/')` nor `startsWith('/')`
    // recognises it. Path.isAbsolute and Path.sep are platform-correct and
    // reduce to the same answers on POSIX.
    if (aliasref.includes('/') || aliasref.includes(node_path_1.default.sep)) {
        // NOTE: the last path element of the ref is the target name, not a folder.
        const aliasbase = node_path_1.default.dirname(aliasref);
        if (!node_path_1.default.isAbsolute(aliasref)) {
            fulltfolder = node_path_1.default.normalize(node_path_1.default.join(root, 'node_modules', aliasbase, '.sdk'));
            search.push(fulltfolder);
            found = fs.existsSync(fulltfolder);
            if (!found) {
                fulltfolder = node_path_1.default.normalize(node_path_1.default.join(root, aliasbase, '.sdk'));
                search.push(fulltfolder);
                found = fs.existsSync(fulltfolder);
            }
        }
        else {
            fulltfolder = node_path_1.default.normalize(node_path_1.default.join(aliasbase, '.sdk'));
            search.push(fulltfolder);
            found = fs.existsSync(fulltfolder);
        }
    }
    else {
        search.push(fulltfolder);
        found = fs.existsSync(fulltfolder);
    }
    if (!found) {
        throw new Error('Target folder not found in:\n' + search.join('\n  '));
    }
    // `base` is the target folder relative to the project root. Compare with the
    // PLATFORM separator: on Windows `root + '/'` never prefixes a normalised
    // absolute path, so the root would not be stripped and `base` would stay
    // absolute. Normalise both sides first for the same reason.
    const nroot = node_path_1.default.normalize(root);
    const rootslash = nroot.endsWith(node_path_1.default.sep) ? nroot : nroot + node_path_1.default.sep;
    const out = {
        tname,
        tfolder: fulltfolder,
        torigname,
        base: fulltfolder.startsWith(rootslash)
            ? fulltfolder.slice(rootslash.length)
            : fulltfolder
    };
    return out;
}
//# sourceMappingURL=target.js.map