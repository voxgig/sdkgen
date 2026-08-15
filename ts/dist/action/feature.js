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
const action_1 = require("./action");
const CMD_MAP = {
    add: cmd_feature_add
};
const BASE = 'node_modules/@voxgig/sdkgen';
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
        (0, jostraca_1.each)(features, (n) => {
            const fname = n.val$;
            // TODO: validate feature is a-z0-9-_. only
            log.info({
                point: 'feature-build',
                feature: fname,
                note: fname
            });
            (0, jostraca_1.Folder)({ name: 'model/feature' }, () => {
                (0, jostraca_1.Copy)({
                    // TODO: these paths needs to be parameterised
                    from: BASE + '/project/.sdk/model/feature/' + fname + '.aontu',
                });
                (0, jostraca_1.File)({ name: 'feature-index.aontu' }, () => (0, action_1.UpdateIndex)({
                    content: ctx$.meta.content.feature_index,
                    names: features,
                }));
            });
            // Bring in the feature's source for every target already in the model.
            // Where that source lives is language-specific — `src/feature/<name>/`
            // for ts and js, `feature/<name>_feature.go` for go,
            // `lib/feature/<name>/` for dart, and so on — so discover it in the
            // target's template tree instead of assuming one layout. Assuming
            // `src/feature/<name>` meant `feature add` silently added nothing for
            // every target that keeps feature source elsewhere.
            (0, jostraca_1.each)(target, (t) => {
                const sdkfolder = t.base || node_path_1.default.join(BASE, 'project/.sdk');
                const tmfolder = node_path_1.default.join(sdkfolder, 'tm', t.name);
                const sources = (0, featureSource_1.findFeatureSources)(fs, tmfolder, [fname]);
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