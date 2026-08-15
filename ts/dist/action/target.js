"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.action_target = action_target;
exports.featureCatalogue = featureCatalogue;
exports.target_add = target_add;
exports.resolveTarget = resolveTarget;
exports.trimFeatures = trimFeatures;
exports.readTargetFeature = readTargetFeature;
exports.aliasCmpText = aliasCmpText;
exports.aliasCmpName = aliasCmpName;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const util_1 = require("@voxgig/util");
const dryrun_1 = require("../helpers/dryrun");
const stdrep_1 = require("../helpers/stdrep");
const aontu_1 = require("aontu");
const types_1 = require("../types");
const utility_1 = require("../utility");
const featureSource_1 = require("../helpers/featureSource");
const feature_1 = require("./feature");
const action_1 = require("./action");
const kind_1 = require("./kind");
const resolve_1 = require("./resolve");
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
    // The targets just written are not in the in-memory model — nothing
    // recompiles `model/sdk.aontu` mid-process — so put them there before the
    // fan-out below.
    //
    // TargetRoot copies each new target's feature source from ITS OWN TREE,
    // which is the whole story only while every feature ships in the same
    // package as every target. For a feature supplied by a DIFFERENT package,
    // the source lives in that package's overlay, and only `feature_add`'s
    // two-tree lookup consults it — for targets in the model. So a target added
    // while such a feature was already active got no source for it at all:
    // TargetRoot could not find it, and the fan-out could not see the target.
    (0, resolve_1.registerInstalled)('target', targets, actx);
    // feature_add copies feature templates for every target in the model,
    // which now includes the ones just added.
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
    const { ctx$, targets, features, actx } = props;
    const { model, log } = ctx$;
    const fs = ctx$.fs();
    // The prune below writes through `fs` directly rather than through
    // jostraca, so it has to be told about the dry run itself.
    const dryrun = !!actx?.opts?.dryrun;
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
            // Resolved through the shared kind spine, so a BARE name follows what
            // the model records exactly as a feature's does. Without that, a target
            // installed from an external package resolved back to the bundled
            // scaffold on its next `target add` — the same write-only-provenance
            // trap features had.
            const source = (0, kind_1.resolveKind)(tref, 'target', ctx$);
            const { name: tname, folder: tfolder, origname: torigname, base } = source;
            tnames.push(tname);
            const targetNote = tname + (tname != tref ? ' ref:' + tref : '');
            log.info({
                point: 'target-name', name: tname, folder: tfolder,
                target: tref,
                tname,
                note: tname + (tname != torigname ? 'original' + torigname : '') + ' from:' + tfolder
            });
            // An ALIASED add (`target add go~go2`) installs the target under a new
            // name, and every one of the three trees has to agree about that name.
            const aliased = tname !== torigname;
            // The definition file and the index entry: the same for every kind, so
            // they are emitted once, in action/kind.
            (0, jostraca_1.Folder)({ name: 'model/target' }, () => (0, kind_1.kindModel)({
                ctx$, kind: 'target', source, names: tnames,
                content: ctx$.meta.content.target_index,
            }));
            if (aliased) {
                // Components are dispatched by CONVENTION — `cmp/<t>/Main_<t>` — so
                // an aliased tree whose files keep the origin suffix resolves
                // nothing: `src/cmp/go2/Main_go.ts` is invisible to a lookup for
                // `cmp/go2/Main_go2`. jostraca's tree Copy has no per-entry rename
                // hook, so an aliased tree is emitted file by file instead.
                aliasCmpTree(ctx$, tfolder + '/src/cmp/' + torigname, 'src/cmp/' + tname, torigname, tname);
            }
            else {
                (0, jostraca_1.Folder)({ name: 'src/cmp/' + tname }, () => {
                    (0, jostraca_1.Copy)({
                        from: tfolder + '/src/cmp/' + torigname,
                        // exclude: true
                    });
                });
            }
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
            pruneStaleTemplates(ctx$, tfolder + '/tm/' + torigname, 'tm/' + tname, trim, dryrun);
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
// `<Cmp>_<origname>.<ext>` -> `<Cmp>_<tname>.<ext>`, for an aliased install.
// Anything not carrying the suffix (tsconfig.json, the fragment sources)
// keeps its name — the `.<ext>` anchor is what keeps this off
// `Main.fragment.go`, whose `go` is a file extension.
//
// Shared with doctor for the same reason as aliasCmpText: doctor walks the
// ORIGIN tree to decide what should be present, so it has to land each file
// under the same name the writer gave it, or it reports the whole tree as
// missing.
function aliasCmpName(name, torigname, tname) {
    return name.replace(new RegExp('_' + (0, kind_1.escapeRe)(torigname) + '(\\.[^.]+)$'), '_' + tname + '$1');
}
// The origin name a component carries INSIDE its source, rewritten for an
// aliased install. Shared with doctor, which re-applies it before comparing —
// same discipline as templateReplacements: a writer and a reader that
// disagree by a character make every file read as a fork.
//
// Rewritten here rather than through jostraca's `replace` map, because that
// map canonicalises each key into a regex group NAME — `_go'` and `_go"` both
// reduce to the same name, so the later entry silently won and every
// single-quoted import came out as `from './Package_go2"`. One explicit regex
// keeps the quote it matched.
function aliasCmpText(src, torigname, tname) {
    const orig = (0, kind_1.escapeRe)(torigname);
    return src
        // The fragment directory, read relative to __dirname. The fragments are
        // copied into the ALIAS's folder, so leaving the origin path would miss —
        // or, if the origin target is also installed, silently read ITS fragments.
        .replace(new RegExp('src/cmp/' + orig + '/', 'g'), 'src/cmp/' + tname + '/')
        // Sibling imports: `'./Package_go'` -> `'./Package_go2'`. Anchored on the
        // closing quote (captured, so the style is preserved) to keep it off file
        // EXTENSIONS — `Main.fragment.go` must not become `Main.fragment.go2`.
        .replace(new RegExp('_' + orig + '([\'"])', 'g'), '_' + tname + '$1');
}
// Emit an aliased `src/cmp` tree: every file renamed from the origin suffix
// to the installed one, and its CONTENT rewritten to match.
//
// Renaming alone would break the tree, because a component names its origin
// twice over: sibling imports (`from './Package_go'`) and the fragment
// directory it reads through `__dirname` (`/../../../src/cmp/go/fragment/`,
// in 67 of the shipped components). Both are rewritten here — the fragment
// path because the fragments are copied to the ALIAS's folder, so the origin
// path would either miss or, worse, silently read the origin target's
// fragments if that target is also installed.
//
// Files are emitted through jostraca (`File`/`Content`) rather than copied
// with `fs`, so a dry run reports them and writes nothing, exactly as the
// tree Copy on the unaliased path does.
function aliasCmpTree(ctx$, fromDir, toRel, torigname, tname) {
    const fs = ctx$.fs();
    const aliasText = (src) => aliasCmpText(src, torigname, tname);
    const emit = (dir, rel) => {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch (e) {
            return;
        }
        // Sorted, so an aliased tree is emitted in the same byte-stable order
        // everything else in this toolchain is.
        const names = entries.map((ent) => ent.name).sort();
        for (const name of names) {
            const child = node_path_1.default.join(dir, name);
            const ent = entries.find((e) => e.name === name);
            if (ent.isDirectory()) {
                (0, jostraca_1.Folder)({ name }, () => emit(child, rel + '/' + name));
                continue;
            }
            const renamed = aliasCmpName(name, torigname, tname);
            // `template` against the model with no replace map, matching what Copy
            // does for the unaliased tree — jostraca's Copy always interpolates
            // `$$ref$$` against the model, so an aliased tree must too.
            const src = fs.readFileSync(child, 'utf8');
            (0, jostraca_1.File)({ name: renamed }, () => (0, jostraca_1.Content)((0, jostraca_1.template)(aliasText(src), ctx$.model)));
        }
    };
    (0, jostraca_1.Folder)({ name: toRel }, () => emit(fromDir, toRel));
}
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
function pruneStaleTemplates(ctx$, fromDir, toRel, trim, dryrun) {
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
    // A DRY RUN must not delete. This prune calls `fs.unlinkSync` directly, and
    // jostraca enforces `control.dryrun` only inside its own write layer — so
    // `-y target add <t>` previewed the copies and then really removed every
    // stale template, which is the opposite of what the flag promises and
    // exactly the blast radius a maintainer runs `-y` to inspect. Report the
    // deletions instead, in the same shape the copies are reported.
    if (dryrun) {
        log.info({
            point: 'target-template-prune', target: toRel, count: stale.length,
            files: stale, dryrun: true,
            note: toRel + ': would remove ' + stale.length +
                ' stale template(s) — ** DRY RUN **, nothing was written'
        });
        for (const rel of stale) {
            log.info({
                point: 'target-template-prune-file', target: toRel,
                file: toRel + '/' + rel, dryrun: true,
                note: 'would remove ' + toRel + '/' + rel
            });
        }
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
// WHICH NAMES COUNT AS FEATURE SOURCE, when deciding what to trim.
//
// This used to be the SOURCE folder's own `model/feature/` listing, which is
// right only while every target ships in the same package as every feature.
// An external target package declares no feature models of its own — it has
// no reason to — so nothing was discovered, nothing was trimmed, and the
// consumer received the target's source for EVERY feature regardless of what
// its model selected. Measured on a target copied from the bundled `go`: the
// bundled one keeps 2 feature source files, the external one kept all 18.
//
// That is the failure `helpers/featureSource` was written to end (272 stray
// files in one repo), arriving again by the one route it did not cover.
//
// The catalogue is therefore the union of every place a feature this project
// could select can come from:
//
//   - the bundled scaffold, which is what a bare `feature add <name>` means;
//   - the source package's own declarations, for a package shipping both;
//   - the consumer's OWN installed feature models, which is how an EXTERNAL
//     feature's source becomes trimmable at all.
//
// Every term is a place feature DEFINITIONS live, deliberately. Taking the
// third from the model's feature KEYS instead would make any name a project
// happens to declare a trim candidate — and a file in a `feature/` directory
// is not necessarily a feature. `tm/rust/feature/support.rs` and its siblings
// are shared machinery that `Main_rust` emits unconditionally (`pub mod
// support`), so a project that declared a feature called `support` would have
// had that file pruned and produced a crate that cannot compile. A definition
// file is evidence that the name really denotes a feature; a model key is not.
//
// For a bundled add this is `bundled ∪ bundled ∪ (⊆ bundled)`, so the trim is
// byte-identical to what it always was — the goldens hold it to that.
function featureCatalogue(ctx$, tfolder) {
    const fs = ctx$.fs();
    const root = ctx$.folder ?? '.';
    const names = new Set([
        ...(0, featureSource_1.availableFeatures)(fs, node_path_1.default.join(root, resolve_1.BUNDLED)),
        ...(0, featureSource_1.availableFeatures)(fs, tfolder),
        ...(0, featureSource_1.availableFeatures)(fs, root),
    ]);
    return Array.from(names).sort();
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
    const available = featureCatalogue(ctx$, tfolder);
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
// `target add`'s view of the shared resolver: the same resolution every kind
// uses, with this action's historical field names. Kept as a wrapper so its
// callers (TargetRoot, doctor) and their tests do not have to move with the
// extraction.
function resolveTarget(tref, ctx$) {
    const src = (0, resolve_1.resolveSource)(tref, 'target', ctx$);
    return {
        tname: src.name,
        tfolder: src.folder,
        torigname: src.origname,
        base: src.base,
        package: src.package,
    };
}
//# sourceMappingURL=target.js.map