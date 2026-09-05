"use strict";
// `voxgig-sdkgen doctor` — does this project's `.sdk/` still match the
// scaffold?
//
// WHY THIS EXISTS
//
// Nothing told a project that its `.sdk/` had drifted. `target add`
// OVERWRITES the vendored components, the template masters AND the per-target
// model file, so any hand-edit there is silently reverted on the next run —
// and any file the scaffold has since stopped shipping just stays, compiling
// into the output forever. In voxgig-solardemo-sdk two such orphans broke the
// Go build in a single session: `utility/make_target.go` (replaced upstream by
// `make_point.go`, leaving a duplicate symbol) and `utility/struct/go.mod` (a
// nested module that made `utility/struct` unimportable).
//
// Every divergence in that repo was found by hand-diffing. Without a check,
// fixing it once guarantees nothing about next month.
//
// WHY A NAIVE `diff -r` DOES NOT WORK
//
// `target add` writes template masters with substitution PARTLY applied, and
// inconsistently: `tm/go/core/error.go` arrives substituted (`SolardemoError`
// where the scaffold says `ProjectNameError`), `tm/ts/test/utility.ts` arrives
// raw (its placeholders are substituted later, at generate time), and
// `tm/go/LICENSE` has the year filled in. A plain `diff -r` against the
// scaffold reported 20 edited files in that repo; 19 were substitution
// artefacts and exactly ONE was a real hand-edit.
//
// Only sdkgen knows which replacements it applied to which files, which is
// why this check belongs here and cannot be scripted downstream. It re-runs
// the same substitution before comparing, so what it reports is real.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.action_doctor = action_doctor;
exports.doctor = doctor;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const utility_1 = require("../utility");
const stdrep_1 = require("../helpers/stdrep");
const target_1 = require("./target");
// `aliasModelText` is no longer named here: the model-file comparison asks
// the registry for the kind's own `rename`, so a kind that renames
// differently is handled without this file knowing how.
const kind_1 = require("./kind");
const resolve_1 = require("./resolve");
const definition_1 = require("../helpers/definition");
const featureSource_1 = require("../helpers/featureSource");
const junk_1 = require("../helpers/junk");
// jostraca's Copy walk skips these (IGNORED_RE in CopyOp) — editor backups and
// deliberately-disabled templates never reach a project, so they are not drift.
//
// `isJunk` is the other half of the same statement: what the WRITER refuses to
// copy, this reader must refuse to miss. A `__pycache__` in the scaffold would
// otherwise be reported as missing from every project on earth, and one in a
// project as an unexplained extra file. See helpers/junk.
const IGNORED_RE = /(~|-jostraca-off)$/;
function ignoredEntry(name) {
    return IGNORED_RE.test(name) || (0, junk_1.isJunk)(name);
}
// Extensions jostraca copies byte-for-byte. Comparing them as text would
// report spurious differences, so they are compared by raw bytes.
const BINARY_RE = /\.(png|jpg|jpeg|gif|ico|pdf|zip|gz|woff2?|ttf|eot|wasm)$/i;
// Root-level components sdkgen provides, and what a project loses by not
// wiring one in. A project's `Root.ts` / `Top.ts` come from create-sdkgen at
// init and are then FROZEN — `target add` never touches them — so a
// capability added to sdkgen afterwards is invisible to every existing
// project. solardemo's `Top.ts`, written before `ReadmeTop` existed, kept
// hand-rolling a 9-line stub root README with an empty mermaid diagram for
// months, and no number of `target add` runs would ever have said so.
//
// Not wiring one in is a legitimate choice, so this is REPORTED, never a
// failure.
const ROOT_COMPONENTS = [
    ['ReadmeTop', 'the assembled root README (quickstart, howto, test, package table)'],
    ['AgentGuideTop', 'the root AGENTS.md / CLAUDE.md agent guides'],
    ['License', 'the root LICENSE'],
    ['Security', 'the root SECURITY.md'],
    ['Changelog', 'the root CHANGELOG.md'],
    ['Deploy', 'the release/publish recipes'],
];
const CMD_MAP = {
    check: cmd_doctor_check,
    prune: cmd_doctor_prune,
};
async function action_doctor(args, actx) {
    // `doctor` with no subcommand is the check — the command exists to be run
    // in CI without anyone remembering a verb.
    const cmdname = args[1];
    const cmd = null == cmdname ? cmd_doctor_check : CMD_MAP[cmdname];
    if (null == cmd) {
        throw new utility_1.SdkGenError('Unknown doctor cmd: ' + cmdname);
    }
    return await cmd(args, actx);
}
async function cmd_doctor_check(_args, actx) {
    return doctor(actx);
}
// `doctor prune` — the ONE write doctor performs, and only ever of files a
// target's model DECLARES superseded (retired templates jostraca cannot
// delete from a consumer: the old runner beside its replacement, a
// pre-reshape vendored file). Everything else doctor does stays read-only.
async function cmd_doctor_prune(_args, actx) {
    const log = actx.log;
    const fs = actx.fs();
    const found = supersededFiles(actx);
    const pruned = [];
    for (const abs of found) {
        fs.unlinkSync(abs);
        pruned.push(abs);
        log.info({ point: 'doctor-prune', file: abs, note: 'pruned superseded: ' + abs });
    }
    log.info({
        point: 'doctor-prune-end', pruned: pruned.length,
        note: 0 === pruned.length ? 'nothing superseded to prune' :
            ('pruned ' + pruned.length + ' superseded file(s)')
    });
    return { report: { pruned, ok: true } };
}
// Generated files the model says this toolchain NO LONGER writes, that
// still exist in the project's target output directories. Paths in the
// model are relative to each target's output dir (a sibling of `.sdk/`,
// named for the target).
function supersededFiles(actx) {
    const fs = actx.fs();
    const model = actx.model;
    const root = actx.folder;
    const targets = model?.main?.[types_1.KIT]?.target ?? {};
    const found = [];
    for (const tname of Object.keys(targets).sort()) {
        for (const rel of (targets[tname].superseded || [])) {
            const abs = node_path_1.default.join(root, '..', tname, String(rel));
            if (fs.existsSync(abs)) {
                found.push(abs);
            }
        }
    }
    return found;
}
// Code API. Returns the report; the CLI turns a non-ok report into a
// non-zero exit so this can gate CI.
async function doctor(actx, scope) {
    const log = actx.log;
    const fs = actx.fs();
    const model = actx.model;
    const root = actx.folder;
    const report = {
        forked: [], edited: [], stale: [], missing: [], additive: [],
        superseded: [], unwired: [], resyncPending: [], aliasedDiff: [], ok: true,
    };
    // Retired-output leftovers first: purely model-driven, and a finding —
    // two copies of the same machinery, one stale, is exactly the state the
    // migration guide had to clean up by hand three times.
    report.superseded = supersededFiles(actx);
    // EVERY KIND, not just targets.
    //
    // `add` writes a copied model file for each kind — `model/target/<t>.aon`
    // and `model/feature/<f>.aon` alike — and overwrites it on every resync.
    // Only the target one was ever compared, so a hand-edit to an installed
    // FEATURE definition read as perfectly in sync and was silently reverted by
    // the next `target add` (which re-runs `feature add` for every active
    // feature). That is exactly the failure `checkTargetModel` was added for,
    // left open for the other half of what add owns.
    //
    // Driven off the registry, so a kind added later is checked without
    // anything here changing. The per-kind EXTRAS — a target's `src/cmp` and
    // `tm` trees — stay in that kind's own check, because they are genuinely
    // different work rather than the same work with different strings.
    const kinds = Object.keys(kind_1.KINDS).sort();
    const counts = {};
    for (const kind of kinds) {
        counts[kind] = Object.keys(model?.main?.[types_1.KIT]?.[kind] ?? {}).length;
    }
    log.info({ point: 'doctor-start', targets: counts.target ?? 0, ...counts });
    // Targets resolved ONCE, before the kind loop, because the feature checks
    // need them too: a feature's per-target source lives under the name the
    // target has in its own source, so finding it means knowing where each
    // target came from. Resolving per (feature, target) pair would re-read
    // every package manifest dozens of times and warn repeatedly about the
    // same unresolvable target.
    //
    // Resolved even when the run is SCOPED past them — a scoped check of one
    // feature still has to look in every target's tree for that feature's
    // files.
    const targets = new Map();
    for (const tname of Object.keys(model?.main?.[types_1.KIT]?.target ?? {}).sort()) {
        const source = resolveDeclared('target', tname, actx);
        if (null != source) {
            targets.set(tname, source);
        }
    }
    for (const kind of kinds) {
        const items = Object.keys(model?.main?.[types_1.KIT]?.[kind] ?? {}).sort();
        for (const name of items) {
            if (null != scope && !scope(kind, name)) {
                continue;
            }
            const source = 'target' === kind ?
                targets.get(name) : resolveDeclared(kind, name, actx);
            if (null == source) {
                continue;
            }
            if ('target' === kind) {
                checkTarget(actx, source, report);
            }
            if ('docs' === kind) {
                checkDocs(actx, source, report);
            }
            // Only an ACTIVE feature has source copied out; what an inactive one
            // left behind is stale, and the target walk reports it as such.
            if ('feature' === kind &&
                false !== model?.main?.[types_1.KIT]?.feature?.[name]?.active) {
                checkFeatureSource(actx, source, targets, report);
            }
            checkItemModel(actx, kind, source, report);
        }
    }
    // Root-component wiring is a property of the PROJECT, not of any item, so a
    // scoped run has no business reporting on it — `package update` asking "is
    // this package's copy clean" should not also say the project never wired in
    // `ReadmeTop`.
    if (null == scope) {
        checkWiring(actx, report);
    }
    report.ok = 0 === report.forked.length + report.edited.length +
        report.stale.length + report.missing.length + report.superseded.length;
    for (const [kind, note] of [
        ['forked', 'FORKED (will be reverted by `target add`)'],
        ['edited', 'EDITED template master'],
        ['stale', 'STALE (no longer written by `target add`)'],
        ['missing', 'MISSING (would be written by `target add`)'],
        ['additive', 'additive (project-owned, not drift)'],
        ['superseded', 'SUPERSEDED generated output (run `doctor prune` to delete)'],
        ['unwired', 'NOT WIRED IN (root capability this project is missing)'],
        ['resyncPending', 'RESYNC PENDING (predates provenance; `target add` updates it)'],
        ['aliasedDiff', 'aliased model differs from its origin (project-owned, not drift)'],
    ]) {
        for (const file of report[kind]) {
            log.info({ point: 'doctor-finding', kind, file, note: note + ': ' + file });
        }
    }
    log.info({
        point: 'doctor-end',
        ok: report.ok,
        forked: report.forked.length,
        edited: report.edited.length,
        stale: report.stale.length,
        missing: report.missing.length,
        additive: report.additive.length,
        superseded: report.superseded.length,
        unwired: report.unwired.length,
        resyncPending: report.resyncPending.length,
        aliasedDiff: report.aliasedDiff.length,
        note: report.ok ?
            ('.sdk matches the scaffold (' + report.additive.length + ' additive)') :
            ('.sdk has drifted: ' + report.forked.length + ' forked, ' +
                report.edited.length + ' edited, ' + report.stale.length + ' stale, ' +
                report.missing.length + ' missing')
    });
    return { report };
}
// Which root-level components the project's own wiring calls. The wiring is
// hand-written TypeScript (Root.ts / Top.ts / BuildSDK.ts), so this is a
// reference check, not a diff: sdkgen has no reference copy of a file it does
// not ship.
function checkWiring(actx, report) {
    const fs = actx.fs();
    const src = node_path_1.default.join(actx.folder, 'src');
    if (!fs.existsSync(src)) {
        return;
    }
    // Everything except cmp/, which is the per-target layer target add owns.
    const wiring = walk(fs, src)
        .filter((rel) => !rel.startsWith('cmp/') && rel.endsWith('.ts'))
        .map((rel) => fs.readFileSync(node_path_1.default.join(src, rel), 'utf8'))
        .join('\n');
    if ('' === wiring) {
        return;
    }
    for (const [name, what] of ROOT_COMPONENTS) {
        // A bare identifier reference: imported and called, or at least named.
        if (!new RegExp('\\b' + name + '\\b').test(wiring)) {
            report.unwired.push(name + ' — ' + what);
        }
    }
}
// Where one declared item came from, or undefined with the reason said out
// loud.
//
// The model records `base` and `origname` (written by add), and `origname` is
// what makes an ALIAS checkable: the ref used to be rebuilt as
// `<base>/../<name>`, which names the INSTALLED item — so `target add ts~ts2`
// sent doctor looking for a `ts2` scaffold that does not exist, both trees
// walked empty, and every component read as `additive` while every template
// read as `stale` (a FAILING category). Real edits were undetectable and
// doctor went red on noise.
//
// A bare name falls back to the bundled scaffold, for a copy predating
// provenance.
function resolveDeclared(kind, name, actx) {
    const declared = actx.model?.main?.[types_1.KIT]?.[kind]?.[name];
    const ref = (0, kind_1.recordedRef)(declared, name) || name;
    try {
        // WITH THE LOG. Resolution reads the source's package manifest, and an
        // unusable one is reported only through `ctx$.log`. Without it doctor
        // silently lost the package name — and then reported every item from that
        // package as FORKED, because the expected text no longer carries the
        // `package:` line the copy has, with nothing anywhere saying why. That is
        // accurate (the next add really would strip the line) but unactionable,
        // which is the same defect as being wrong.
        return (0, resolve_1.resolveSource)(ref, kind, { folder: actx.folder, fs: actx.fs, log: actx.log });
    }
    catch (err) {
        actx.log.warn({
            point: 'doctor-source-unresolved', kind, [kind]: name, err: err.message,
            note: name + ': cannot find its ' + kind + ' source (' +
                err.message + ')'
        });
        return undefined;
    }
}
function checkTarget(actx, resolved, report) {
    const tname = resolved.name;
    const tfolder = resolved.folder;
    const torigname = resolved.origname;
    const fs = actx.fs();
    const model = actx.model;
    const root = actx.folder;
    // The two TREES `target add` owns, and the substitution it applies to each.
    // (It owns one FILE as well — see checkTargetModel, below.)
    //
    //   src/cmp — copied verbatim, so a byte compare is the truth.
    //   tm      — copied through jostraca's template(), with ProjectName.
    // An ALIASED install renames every `<Cmp>_<origname>` component to
    // `<Cmp>_<alias>` and rewrites the origin name inside the file (sibling
    // imports, the __dirname-relative fragment path), because components are
    // dispatched by the convention `cmp/<t>/Main_<t>`. doctor has to apply the
    // same two transforms or it expects the ORIGIN names in the alias's folder
    // and reports the entire tree as missing — 25 files for `go~go2`, none of
    // them a real finding.
    const aliased = tname !== torigname;
    const renameCmp = aliased ?
        (rel) => (0, target_1.aliasCmpName)(rel, torigname, tname) : undefined;
    const rewriteCmp = aliased ?
        (src) => (0, target_1.aliasCmpText)(src, torigname, tname) : undefined;
    const trees = [
        {
            project: node_path_1.default.join(root, 'src', 'cmp', tname),
            scaffold: node_path_1.default.join(tfolder, 'src', 'cmp', torigname),
            replace: {},
            kind: 'forked',
            rename: renameCmp,
            rewrite: rewriteCmp,
        },
        {
            project: node_path_1.default.join(root, 'tm', tname),
            scaffold: node_path_1.default.join(tfolder, 'tm', torigname),
            replace: (0, stdrep_1.templateReplacements)(model, tname),
            kind: 'edited',
        },
    ];
    // The feature set `target add` would select right now. A project that
    // added its targets before feature trimming existed carries source for
    // features its model never declared — expected here as STALE, which is
    // exactly what it is.
    const featuremodel = model?.main?.[types_1.KIT]?.feature ?? {};
    const features = Array.from(new Set([
        'test',
        ...Object.keys(featuremodel).filter((n) => false !== featuremodel[n]?.active),
    ]));
    // `folder` and `model` matter: the trim catalogue is resolved consumer-side
    // (see featureCatalogue), so a doctor that withheld them would compute a
    // different trim from the one `target add` applied and report correctly
    // trimmed files as missing.
    const excludes = (0, target_1.trimFeatures)({ log: quietLog(actx.log), fs: () => fs, folder: root, model }, tfolder, torigname, tname, features);
    compareTrees(actx, report, trees, {
        excludes,
        // Only a TARGET has foreign feature source landing in its tree.
        foreign: (kind) => 'edited' === kind ?
            foreignFeatureSource(actx, resolved) : [],
    });
}
// COMPARE A SET OF TREES against the sources they were copied from.
//
// Extracted from `checkTarget` unchanged, because the docs kind needs exactly
// this and a second copy of it is the defect this workstream keeps producing.
// What differs per kind stays in the caller: which trees, what the copy
// substituted, whether a trim excludes part of the source, and whether
// anything foreign is expected to land in the tree.
//
// This is the mechanism behind the rule in CLAUDE.md — anything an add
// writes, doctor must compare, or the next add silently reverts a project's
// edit. A kind that declares trees and is not walked here would break it.
function compareTrees(actx, report, trees, opts) {
    const fs = actx.fs();
    const model = actx.model;
    const root = actx.folder;
    const excludes = opts?.excludes ?? [];
    for (const tree of trees) {
        // Findings are reported at project-relative paths, the way a maintainer
        // would type them.
        const label = node_path_1.default.relative(root, tree.project).split(node_path_1.default.sep).join('/') + '/';
        const scaffoldFiles = 'edited' === tree.kind ?
            walk(fs, tree.scaffold).filter((rel) => !excluded(rel, excludes)) :
            walk(fs, tree.scaffold);
        // Where each file the project should have COMES FROM: the name it lands
        // under, mapped to the absolute path of the file it was copied from.
        //
        // An absolute path rather than a tree-relative one, because not every
        // expected file comes from THIS tree — see the foreign-feature union
        // below.
        const landed = new Map(scaffoldFiles.map((rel) => [
            null == tree.rename ? rel : tree.rename(rel),
            node_path_1.default.join(tree.scaffold, rel),
        ]));
        // FOREIGN FEATURE SOURCE.
        //
        // A feature supplied by a different package than the target ships its
        // per-target source in ITS OWN `tm/<target>/` overlay, and `feature add`
        // copies that into the project. Compared against the target's scaffold
        // alone, those files are present in the project and absent upstream — so
        // every one of them was reported STALE, a FAILING category. Any project
        // using an external feature had a red `doctor` and nothing wrong with it.
        //
        // They are not stale, they are expected — just expected from somewhere
        // else. Adding them here rather than suppressing them keeps them
        // CHECKED: a hand-edit to a foreign feature's source is still reported,
        // which is what `package update`'s gate needs in order to cover
        // everything the re-add writes.
        const foreign = new Set();
        for (const [rel, from] of (opts?.foreign?.(tree.kind) ?? [])) {
            landed.set(rel, from);
            foreign.add(rel);
        }
        const expected = Array.from(landed.keys()).sort();
        const actual = walk(fs, tree.project);
        const expectedSet = new Set(expected);
        const actualSet = new Set(actual);
        for (const rel of expected) {
            if (!actualSet.has(rel)) {
                report.missing.push(label + rel);
                continue;
            }
            // A foreign feature's file is EXPECTED here (so it is not stale) but
            // compared by `checkFeatureSource`, from the feature's side. Comparing
            // it here too would report it twice on a full run — and, worse, would
            // leave it uncompared on a run scoped to the feature alone, which is
            // exactly when `feature add` is about to rewrite it.
            if (foreign.has(rel)) {
                continue;
            }
            const from = landed.get(rel);
            if (differs(fs, from, node_path_1.default.join(tree.project, rel), model, tree.replace, undefined, tree.rewrite)) {
                report[tree.kind].push(label + rel);
            }
        }
        for (const rel of actual) {
            if (expectedSet.has(rel)) {
                continue;
            }
            // A component the scaffold has NEVER shipped is the project's own —
            // the supported way to add a per-target component. Anything else under
            // a tree `target add` owns is stale output.
            const known = fs.existsSync(node_path_1.default.join(tree.scaffold, rel)) ||
                landed.has(rel);
            if ('forked' === tree.kind && !known) {
                report.additive.push(label + rel);
            }
            else {
                report.stale.push(label + rel);
            }
        }
    }
}
// A DOCS item's trees.
//
// Simpler than a target's in every way that matters here: no trim (a docs
// item has no per-feature source to leave out), and nothing foreign lands in
// them (a feature package's overlay targets a TARGET's tree). What is the
// same is the alias handling — docs components are dispatched by the same
// `Main_<n>` convention — and the tree paths, which come from the registry
// rather than being spelled a second time.
//
// The optional template tree is skipped when the SOURCE does not ship one:
// `docs add` did not copy it, so the project is right not to have it.
function checkDocs(actx, resolved, report) {
    const fs = actx.fs();
    const root = actx.folder;
    const name = resolved.name;
    const origname = resolved.origname;
    const aliased = name !== origname;
    const dest = (0, kind_1.kindTrees)('docs', name);
    const from = (0, kind_1.kindTrees)('docs', origname);
    const trees = dest.flatMap((tree, i) => {
        const scaffold = node_path_1.default.join(resolved.folder, ...from[i].path.split('/'));
        if (!fs.existsSync(scaffold)) {
            return [];
        }
        const templated = 'template' === tree.replace;
        return [{
                project: node_path_1.default.join(root, ...tree.path.split('/')),
                scaffold,
                replace: templated ? (0, stdrep_1.templateReplacements)(actx.model, name) : {},
                kind: templated ? 'edited' : 'forked',
                rename: aliased && !templated ?
                    (rel) => (0, target_1.aliasCmpName)(rel, origname, name) : undefined,
                rewrite: aliased && !templated ?
                    (src) => (0, target_1.aliasCmpText)(src, origname, name) : undefined,
            }];
    });
    compareTrees(actx, report, trees);
}
// Per-target source that a FEATURE package supplies for this target, as
// `project-relative path -> the file it was copied from`.
//
// Only for features whose source folder is not the target's own: everything
// the target ships for itself is already in the tree being walked, and
// listing it twice would compare it against itself.
//
// Only for ACTIVE features, because that is what `feature add` copies. A
// feature switched off later leaves its files behind, and those really are
// stale — reporting them is the point.
//
// Discovered with `findFeatureSources`, the same function the fan-out and the
// trim use, so doctor's idea of which files belong to a feature cannot drift
// from the one that put them there.
function foreignFeatureSource(actx, target) {
    const out = new Map();
    const features = actx.model?.main?.[types_1.KIT]?.feature ?? {};
    for (const fname of Object.keys(features).sort()) {
        if (false === features[fname]?.active) {
            continue;
        }
        const source = resolveDeclared('feature', fname, actx);
        if (null == source) {
            continue;
        }
        for (const [rel, from] of overlayFiles(actx, source, target)) {
            out.set(rel, from);
        }
    }
    return out;
}
// One feature's per-target source, as `tm-relative path -> the file it was
// copied from`, for source the FEATURE package supplies rather than the
// target.
//
// ONE enumerator, used from both directions: the target walk needs these to
// know they are expected, and the feature check needs them to compare. Two
// enumerations would be two ideas of which files a feature owns, and the
// pair would drift — which is the failure this codebase keeps producing.
//
// Empty when the feature's source IS the target's own tree: those files are
// already in the tree being walked, and listing them would compare them
// against themselves.
function overlayFiles(actx, feature, target) {
    const fs = actx.fs();
    const out = new Map();
    if (feature.folder === target.folder) {
        return out;
    }
    // The feature package's overlay for THIS target, under the name the target
    // has in its own source — an aliased target's templates live at
    // `tm/<origname>`.
    const overlay = node_path_1.default.join(feature.folder, 'tm', target.origname);
    for (const found of (0, featureSource_1.findFeatureSources)(fs, overlay, [feature.name])) {
        const from = node_path_1.default.join(overlay, found.path);
        // A folder source is the whole feature directory; expand it, because the
        // comparison is per file.
        if (found.folder) {
            for (const rel of walk(fs, from)) {
                out.set(found.path + '/' + rel, node_path_1.default.join(from, rel));
            }
        }
        else {
            out.set(found.path, from);
        }
    }
    return out;
}
// A FEATURE's per-target source, checked from the feature's side.
//
// This is where those files are COMPARED. The target walk only marks them
// expected, so that each is compared exactly once — by the feature that owns
// it, which is also the only scope in which `feature add` will rewrite it.
//
// Doing it the other way round — leaving the comparison in the target walk —
// left the gate open in the case it was built for: `package update` on a
// FEATURE package scopes doctor to that feature, no target is walked, and so
// nothing compared the very overlay the feature package supplies. Verified
// before fixing: the update succeeded without asking, and the local edit was
// destroyed.
function checkFeatureSource(actx, feature, targets, report) {
    const fs = actx.fs();
    const root = actx.folder;
    const model = actx.model;
    for (const [tname, target] of targets) {
        for (const [rel, from] of overlayFiles(actx, feature, target)) {
            const project = node_path_1.default.join(root, 'tm', tname, rel);
            const label = 'tm/' + tname + '/' + rel;
            if (!fs.existsSync(project)) {
                report.missing.push(label);
                continue;
            }
            // The same map `feature add` copies with — see helpers/stdrep. A
            // different one here would report every substituted file as edited.
            if (differs(fs, from, project, model, (0, stdrep_1.templateReplacements)(model, tname))) {
                report.edited.push(label);
            }
        }
    }
}
// The copied MODEL FILE — `model/<kind>/<name>.aon`, written by add with
// the `'BASE'` replacement, and overwritten on every resync exactly as
// `src/cmp` and `tm` are.
//
// It is not scaffolding trivia. A target's carries its dependency set, its
// `phase` gates, `srcfeature`, `feature.trim` / `feature.fullset` and its
// publish-registry identity; a feature's carries its version, `active`
// default, `config` defaults and hook wiring. So a maintainer who fixes a dep
// version there loses the fix on the next resync with nothing said (the SDK
// regresses with nobody touching it, which is the failure the "a project
// decision belongs in the MODEL" rule exists to prevent), and a project whose
// copy predates a scaffold change carries the old declaration forever while
// doctor reports it in sync.
//
// KIND-NEUTRAL, because the file is the same kind of thing for every kind:
// one definition, copied, stamped with provenance, optionally renamed for an
// alias. Only the alias rewrite is kind-specific, and the registry already
// says which kinds can be aliased at all.
function checkItemModel(actx, kind, source, report) {
    const name = source.name;
    const origname = source.origname;
    const base = source.base;
    const fs = actx.fs();
    const scaffold = (0, definition_1.definitionPath)(source.folder, kind, origname);
    // Nothing to compare against — a source that no longer ships this item.
    if (!fs.existsSync(scaffold)) {
        return;
    }
    // An ALIAS's model file is PROJECT-OWNED: `target add go~go2` creates it and
    // never overwrites it again, because differentiating it is the whole point
    // of an alias (a second Go module needs its own module name and deps), and
    // add-a-target tells the project to edit it. So a difference here is not a
    // fork — `target add` will not revert it — and must not fail the check.
    //
    // It is still worth REPORTING, which it never was before: the origin was
    // unrecoverable, so doctor skipped the file entirely and an alias that had
    // drifted far from a moved-on upstream said nothing. With `origname`
    // recorded the comparison is possible, so it runs, with the same key
    // rewrite the add applied — and anything left over is the project's own
    // differentiation, reported as informational.
    //
    // Only for a kind that CAN be aliased. A feature cannot, so for features
    // this is always false and the ownership argument never applies — the
    // registry says which, rather than this inferring it from the names
    // happening to match.
    const aliased = (0, kind_1.kindDef)(kind).alias && name !== origname;
    const project = (0, definition_1.definitionPath)(actx.folder, kind, name);
    const label = 'model/' + kind + '/' + name + '.aon';
    if (!fs.existsSync(project)) {
        report.missing.push(label);
        return;
    }
    // The substitution the add applied on the way in: jostraca's template()
    // against the model (so `module: name: '$$name$$'` arrives as the project
    // slug) plus the provenance block recording where the scaffold was.
    //
    // NOT templateReplacements() — that is the tm/ tree's map. The two writers
    // pass different maps, so doctor has to as well, or every project reads as
    // forked on the `base:` line alone. The map itself is shared with the
    // writer (helpers/stdrep) so the two cannot drift.
    //
    // `package` comes from the SOURCE's manifest, not from what the copy
    // records, for the same reason `base` does: what this compares is what the
    // add would write NOW. A package that renamed itself therefore reads as
    // forked, which is accurate — the next add would rewrite the line.
    const provenance = (0, stdrep_1.provenanceReplace)({ base, origname, name, package: source.package });
    // For an alias, compare against what the origin WOULD produce under the new
    // name, so the rename itself is not the difference.
    const rename = (0, kind_1.kindDef)(kind).rename;
    const rewrite = (aliased && null != rename) ?
        (src) => rename(src, origname, name) : undefined;
    if (!differs(fs, scaffold, project, actx.model, provenance, undefined, rewrite)) {
        return;
    }
    if (aliased) {
        report.aliasedDiff.push(label);
        return;
    }
    // A copy written before the toolchain stamped some provenance key differs
    // from the scaffold by exactly the lines carrying that key. That is not a
    // fork — the project changed nothing — and reporting it as one would turn
    // every existing consumer's CI red on upgrade.
    //
    // PER KEY, not all-or-nothing. The keys arrived in stages — `base` and
    // `origname` first, `package` with the manifest — so a project that
    // resynced between two of them holds a copy that IS stamped (it has `base`)
    // and is still missing a later key. An all-or-nothing "is it stamped at
    // all" test called every one of those a fork: on the released 3.4.8
    // scaffold only ts, csharp and swift carried the anchor, and `ts` is in
    // essentially every consumer SDK, so that was close to the whole installed
    // base going red on a file nobody touched.
    if (stampOnly(fs, scaffold, project, actx.model, provenance, rewrite)) {
        report.resyncPending.push(label);
        return;
    }
    report.forked.push(label);
}
// Is the ONLY difference a provenance line the copy has not been given yet?
//
// MATCHED AGAINST THE EXACT LINES THE STAMP PRODUCES, never against a pattern
// for "a line that looks like provenance". `base`, `origname` and `package`
// are not reserved words: `main: kit: target: <t>: module: package` (the Go
// root package identifier) and `publish: registry: package` (the published
// package name) are declared model slots that a target model may write in
// block form, on their own line, looking exactly like a provenance line to
// any regex. A generic pattern got BOTH directions wrong on such a model —
// it read the copy's `module: package:` as proof the copy was already
// stamped, so an untouched pre-manifest file was reported as forked; and it
// stripped that same real line from the comparison, so DELETING it — an
// actual fork, silently reverted by the next `target add` — was reported as
// a pending resync and passed the check.
//
// Comparing against `provenanceReplace`'s own output has no such ambiguity,
// and keeps the reader tied to the writer, which is the whole point of
// helpers/stdrep.
//
// The rule, once the two are known to differ:
//
//   - every line the EXPECTED has and the copy lacks must be a stamp line;
//   - the copy must have NO line the expected lacks.
//
// The second half is what keeps the tolerance narrow, as the previous
// rollout's review required: a changed `package:` value leaves the old line
// in the copy and unmatched, so it is a fork and is reported as one.
function stampOnly(fs, scaffoldPath, projectPath, model, provenance, rewrite) {
    const { expected, actual } = renderPair(fs, scaffoldPath, projectPath, model, provenance, rewrite);
    // The rendered block, as lines: `base: '...'` plus whichever of
    // `origname:` / `package:` applied. Trimmed on both sides of the
    // comparison, because the anchor's own indentation belongs to the scaffold.
    const stamp = new Set(Object.values(provenance).join('\n').split('\n')
        .map((s) => s.trim()));
    const onlyExpected = lineDiff(expected, actual);
    const onlyActual = lineDiff(actual, expected);
    return 0 === onlyActual.length &&
        0 < onlyExpected.length &&
        onlyExpected.every((line) => stamp.has(line.trim()));
}
// Lines of `a` that `b` does not have, counting duplicates.
function lineDiff(a, b) {
    const pool = new Map();
    for (const line of b.split('\n')) {
        pool.set(line, (pool.get(line) ?? 0) + 1);
    }
    const out = [];
    for (const line of a.split('\n')) {
        const n = pool.get(line) ?? 0;
        if (0 < n) {
            pool.set(line, n - 1);
        }
        else {
            out.push(line);
        }
    }
    return out;
}
// Every file under `dir`, as forward-slash paths relative to it, sorted.
// Missing directory -> no files (a target that was never added).
function walk(fs, dir) {
    const out = [];
    if (!fs.existsSync(dir)) {
        return out;
    }
    const descend = (rel) => {
        const abs = '' === rel ? dir : node_path_1.default.join(dir, rel);
        for (const entry of fs.readdirSync(abs).sort()) {
            if (ignoredEntry(entry)) {
                continue;
            }
            const entryrel = '' === rel ? entry : rel + '/' + entry;
            if (fs.statSync(node_path_1.default.join(dir, entryrel)).isDirectory()) {
                descend(entryrel);
            }
            else {
                out.push(entryrel);
            }
        }
    };
    descend('');
    return out.sort();
}
function excluded(rel, excludes) {
    for (const re of excludes) {
        if (re.test(rel)) {
            return true;
        }
    }
    return false;
}
// Compare a scaffold file with a project file, applying the SAME substitution
// `target add` applied on the way in. Without this the comparison reports
// every substituted placeholder as an edit.
// `ignore` drops matching lines from BOTH sides before comparing, for a
// difference that is known not to be a fork (see the provenance rollout in
// checkTargetModel). It is deliberately a second, narrower question asked
// only after a plain comparison has already found a difference — so a file
// that matches exactly never depends on it.
function differs(fs, scaffoldPath, projectPath, model, replace, ignore, rewrite) {
    if (BINARY_RE.test(scaffoldPath)) {
        return !fs.readFileSync(scaffoldPath).equals(fs.readFileSync(projectPath));
    }
    const { expected, actual } = renderPair(fs, scaffoldPath, projectPath, model, replace, rewrite);
    if (null == ignore) {
        return expected !== actual;
    }
    const strip = (s) => s.split('\n').filter((line) => !ignore(line)).join('\n');
    return strip(expected) !== strip(actual);
}
// What `target add` WOULD write, beside what the project actually has.
//
// One definition, shared by the byte comparison and the stamp-only tolerance,
// so the two can never disagree about what the expected text is.
//
// template() runs even when there is nothing to REPLACE, because jostraca's
// Copy always interpolates `$$ref$$` against the model as well — the replace
// map is an extra, not the whole substitution. Skipping it for the src/cmp
// tree (whose Copy passes no replace map) meant the three Config fragments
// that carry `$$const.Name$$` / `$$main.kit.info.servers.0.url$$` arrived
// substituted and compared as bytes: every project with ts, js or dart
// reported `src/cmp/<t>/fragment/Config.fragment.<ext>` as FORKED straight
// out of `target add`, which is precisely the noise this exists to remove.
// With no `$$` refs and no replace keys, template() is the identity.
function renderPair(fs, scaffoldPath, projectPath, model, replace, rewrite) {
    const rawsrc = fs.readFileSync(scaffoldPath, 'utf8');
    const src = null == rewrite ? rawsrc : rewrite(rawsrc);
    return {
        expected: (0, jostraca_1.template)(src, model, { replace }),
        actual: fs.readFileSync(projectPath, 'utf8'),
    };
}
// trimFeatures logs its decisions; doctor is a report, not a run.
function quietLog(log) {
    const noop = () => { };
    const quiet = { info: noop, debug: noop, warn: log.warn.bind(log), error: noop, trace: noop, fatal: noop };
    quiet.child = () => quiet;
    return quiet;
}
//# sourceMappingURL=doctor.js.map