"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.feature_add = feature_add;
exports.action_feature = action_feature;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const util_1 = require("@voxgig/util");
const dryrun_1 = require("../helpers/dryrun");
const types_1 = require("../types");
const utility_1 = require("../utility");
const featureSource_1 = require("../helpers/featureSource");
const stdrep_1 = require("../helpers/stdrep");
const junk_1 = require("../helpers/junk");
const kind_1 = require("./kind");
const action_1 = require("./action");
const CMD_MAP = {
    add: cmd_feature_add
};
const BASE = 'node_modules/@voxgig/sdkgen';
// The `.sdk` folder a bundled feature comes from — the value recorded as its
// provenance. Still hardcoded, like the path above: giving `feature add` the
// ref grammar `target add` already has is the next step, and this becomes
// whatever the ref resolved to.
const SDKFOLDER = BASE + '/project/.sdk';
async function action_feature(args, actx) {
    const cmdname = args[1];
    const cmd = CMD_MAP[cmdname];
    if (null == cmd) {
        throw new utility_1.SdkGenError('Unknown feature cmd: ' + cmdname);
    }
    return await cmd(args, actx);
}
async function cmd_feature_add(args, actx) {
    return feature_add((0, action_1.parseAddNames)(args), actx);
}
async function feature_add(features, actx) {
    // Reuse the caller's Jostraca instance so feature generation honours the
    // shared controls (notably `dryrun`). A fresh Jostraca() defaults dryrun
    // to false and would write files during a dry run.
    const jostraca = actx.jostraca;
    const opts = {
        fs: actx.fs,
        folder: actx.folder,
        log: actx.log.child({ cmp: 'jostraca' }),
        meta: {
            // model: actx.model,
            // tree: actx.tree,
            url: actx.url,
            content: (0, action_1.loadContent)(actx, 'feature')
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
        // Per-call for the same reason, and covering the same accident: see
        // helpers/junk.
        cmp: (0, junk_1.copyOpts)(),
    };
    opts.log.info({
        point: 'feature-start',
        note: (actx.opts.dryrun ? '** DRY RUN **' : '')
    });
    const jres = await jostraca.generate(opts, () => FeatureRoot({ features }));
    (0, util_1.showChanges)(opts.log, 'feature-result', jres);
    if (actx.opts.dryrun) {
        (0, dryrun_1.showDryrun)(opts.log, 'feature-result', jres, actx.folder);
    }
    opts.log.info({
        point: 'feature-end',
        note: (actx.opts.dryrun ? '** DRY RUN **' : '')
    });
    return {
        jres
    };
}
const FeatureRoot = (0, jostraca_1.cmp)(function FeatureRoot(props) {
    const { ctx$, features } = props;
    const { model, log } = ctx$;
    const fs = ctx$.fs();
    const target = model.main[types_1.KIT].target;
    (0, jostraca_1.Project)({}, () => {
        // The names as INSTALLED, which is what the index must list. A ref is
        // not a name: `feature add @acme/sdkgen-iot/circuitbreaker` installs
        // `circuitbreaker`, and writing the raw ref into feature-index.aon
        // would produce an include of a file that does not exist.
        const fnames = [];
        (0, jostraca_1.each)(features, (n) => {
            const fref = n.val$;
            // TODO: validate feature is a-z0-9-_. only
            // Resolution, the alias policy, and the bare-name fallback to what the
            // model records are the same for every kind — see action/kind.
            //
            // A name that no longer resolves must not abort the RUN: `target add`
            // re-runs this action for every active feature, so one feature whose
            // source has moved (package uninstalled, checkout relocated) would
            // otherwise stop every other feature — including `test`, which every
            // generated target needs — from being copied at all.
            let source;
            try {
                source = (0, kind_1.resolveKind)(fref, 'feature', ctx$);
            }
            catch (err) {
                if (err instanceof utility_1.SdkGenError) {
                    throw err;
                }
                log.warn({
                    point: 'feature-source-unresolved', feature: fref,
                    err: err.message,
                    note: fref + ': cannot find its source (' + err.message +
                        '); skipping, the already-copied files are left alone'
                });
                return;
            }
            const fname = source.name;
            fnames.push(fname);
            log.info({
                point: 'feature-build',
                feature: fname,
                note: fname + (fname === fref ? '' : ' ref:' + fref)
            });
            (0, jostraca_1.Folder)({ name: 'model/feature' }, () => (0, kind_1.kindModel)({
                ctx$, kind: 'feature', source, names: fnames,
                content: ctx$.meta.content.feature_index,
            }));
            // Bring in the feature's source for every target already in the model.
            // Where that source lives is language-specific — `src/feature/<name>/`
            // for ts and js, `feature/<name>_feature.go` for go,
            // `lib/feature/<name>/` for dart, and so on — so discover it in the
            // target's template tree instead of assuming one layout. Assuming
            // `src/feature/<name>` meant `feature add` silently added nothing for
            // every target that keeps feature source elsewhere.
            (0, jostraca_1.each)(target, (t) => {
                // The target's OWN tree, under the name it has in ITS source — an
                // aliased target's templates live at `tm/<origname>`, so searching
                // `tm/<t.name>` missed them entirely.
                const sdkfolder = t.base || SDKFOLDER;
                const torigname = t.origname || t.name;
                const owntm = node_path_1.default.join(sdkfolder, 'tm', torigname);
                // Two places a feature's per-target source can live, in order:
                // the FEATURE package's own overlay for this target, then the
                // target's own tree. A feature shipped by one package for a target
                // shipped by another has nowhere else to put it.
                //
                // First hit wins at DISCOVERY rather than by copy order: jostraca
                // writes last-write-wins, so copying both would silently invert the
                // precedence.
                const featuretm = node_path_1.default.join(source.folder, 'tm', torigname);
                const overlay = featuretm === owntm ? [] :
                    (0, featureSource_1.findFeatureSources)(fs, featuretm, [fname]);
                const own = 0 < overlay.length ?
                    (0, featureSource_1.findFeatureSources)(fs, owntm, [fname]) : [];
                // Both trees carrying source for one feature means two packages claim
                // the same name. The overlay wins, but the target's own files were
                // already copied by `target add` and Copy never removes, so the
                // project is left holding BOTH — duplicate symbols, or stale feature
                // code that still runs. Detecting the name collision at add time is
                // what actually fixes this (it belongs with manifest validation); say
                // so loudly until then, rather than leaving a silent hybrid.
                if (0 < own.length) {
                    log.warn({
                        point: 'feature-source-shadowed', feature: fname, target: t.name,
                        overlay: featuretm, own: owntm,
                        note: fname + ': both ' + featuretm + ' and ' + owntm +
                            ' provide source for target ' + t.name +
                            '; the overlay is used, but the files already copied from the ' +
                            "target's own tree are NOT removed — check tm/" + t.name +
                            ' for a mix of the two'
                    });
                }
                const sources = 0 < overlay.length ? overlay :
                    (0, featureSource_1.findFeatureSources)(fs, owntm, [fname]);
                const tmfolder = 0 < overlay.length ? featuretm : owntm;
                if (0 === sources.length) {
                    log.warn({
                        point: 'feature-source-missing', feature: fname, target: t.name,
                        folder: tmfolder,
                        note: 'no ' + fname + ' source found for target ' + t.name
                    });
                    return;
                }
                for (const source of sources) {
                    // A folder source IS the destination folder; a file source goes
                    // into the folder that holds it.
                    const dest = source.folder ? source.path : node_path_1.default.dirname(source.path);
                    (0, jostraca_1.Folder)({ name: 'tm/' + t.name + '/' + dest }, () => {
                        (0, jostraca_1.Copy)({
                            from: node_path_1.default.join(tmfolder, source.path),
                            // The SAME map `target add` writes `tm/<t>` with. Without it
                            // this copy laid RAW template text over files the target add
                            // had already substituted, so `ProjectName` / `PROJECTVERSION`
                            // survived into the project depending only on which action
                            // wrote the file last — the writer/writer disagreement
                            // helpers/stdrep.ts exists to prevent, in the one place that
                            // did not share the map.
                            replace: (0, stdrep_1.templateReplacements)(model, t.name),
                        });
                    });
                }
            });
            log.info({
                point: 'feature-done', feature: fname,
                note: fname
            });
        });
    });
});
//# sourceMappingURL=feature.js.map