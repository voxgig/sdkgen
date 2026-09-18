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
exports.aliasCmpTree = aliasCmpTree;
exports.pruneStaleTemplates = pruneStaleTemplates;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const util_1 = require("@voxgig/util");
const dryrun_1 = require("../helpers/dryrun");
const stdrep_1 = require("../helpers/stdrep");
const junk_1 = require("../helpers/junk");
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
        control: {
            dryrun: !!actx.opts.dryrun
        },
        // Per-call for the same reason `control` is: this action runs on whatever
        // Jostraca instance the caller handed it, and a template tree must not
        // carry a maintainer's build droppings into a project. See helpers/junk.
        cmp: (0, junk_1.copyOpts)(),
    };
    opts.log.info({
        point: 'target-start',
        note: (actx.opts.dryrun ? '** DRY RUN **' : '')
    });
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
            const aliased = tname !== torigname;
            // The definition file and the index entry: the same for every kind, so
            // they are emitted once, in action/kind.
            (0, jostraca_1.Folder)({ name: 'model/target' }, () => (0, kind_1.kindModel)({
                ctx$, kind: 'target', source, names: tnames,
                content: ctx$.meta.content.target_index,
            }));
            if (aliased) {
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
            const trim = trimFeatures(ctx$, tfolder, torigname, tname, features);
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
        if (0 < tnames.length) {
            (0, jostraca_1.Folder)({ name: 'model/target' }, () => (0, kind_1.kindIndex)({
                kind: 'target', names: tnames,
                content: ctx$.meta.content.target_index,
            }));
        }
    });
});
function aliasCmpName(name, torigname, tname) {
    return name.replace(new RegExp('_' + (0, kind_1.escapeRe)(torigname) + '(\\.[^.]+)$'), '_' + tname + '$1');
}
function aliasCmpText(src, torigname, tname, cmpbase = 'src/cmp/') {
    const orig = (0, kind_1.escapeRe)(torigname);
    return src
        // The fragment directory, read relative to __dirname. The fragments are
        // copied into the ALIAS's folder, so leaving the origin path would miss —
        // or, if the origin target is also installed, silently read ITS fragments.
        .replace(new RegExp((0, kind_1.escapeRe)(cmpbase) + orig + '/', 'g'), cmpbase + tname + '/')
        // Sibling imports: `'./Package_go'` -> `'./Package_go2'`. Anchored on the
        // closing quote (captured, so the style is preserved) to keep it off file
        // EXTENSIONS — `Main.fragment.go` must not become `Main.fragment.go2`.
        .replace(new RegExp('_' + orig + '([\'"])', 'g'), '_' + tname + '$1');
}
function aliasCmpTree(ctx$, fromDir, toRel, torigname, tname, cmpbase = 'src/cmp/') {
    const fs = ctx$.fs();
    const aliasText = (src) => aliasCmpText(src, torigname, tname, cmpbase);
    const emit = (dir, rel) => {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch (e) {
            return;
        }
        // Sorted, so an aliased tree is emitted in the same byte-stable order
        // everything else in this toolchain is. Junk is dropped here because this
        // walk stands in for a tree Copy, which drops it through
        // `cmp.Copy.ignore` — an aliased install must not be the one path that
        // ships a maintainer's `__pycache__`. See helpers/junk.
        const names = entries
            .map((ent) => ent.name)
            .filter((name) => !(0, junk_1.isJunk)(name))
            .sort();
        for (const name of names) {
            const child = node_path_1.default.join(dir, name);
            const ent = entries.find((e) => e.name === name);
            if (ent.isDirectory()) {
                (0, jostraca_1.Folder)({ name }, () => emit(child, rel + '/' + name));
                continue;
            }
            const renamed = aliasCmpName(name, torigname, tname);
            const src = fs.readFileSync(child, 'utf8');
            (0, jostraca_1.File)({ name: renamed }, () => (0, jostraca_1.Content)((0, jostraca_1.template)(aliasText(src), ctx$.model)));
        }
    };
    (0, jostraca_1.Folder)({ name: toRel }, () => emit(fromDir, toRel));
}
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
                if ((0, junk_1.isJunk)(ent.name)) {
                    continue;
                }
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
    const selected = new Set([featureSource_1.BASE_FEATURE, ...(features ?? [])]);
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
function readTargetFeature(ctx$, tfolder, torigname, tname) {
    const { log } = ctx$;
    const fs = ctx$.fs();
    const path = tfolder + '/model/target/' + torigname + '.aon';
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