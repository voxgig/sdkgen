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
const kind_1 = require("./kind");
// jostraca's Copy walk skips these (IGNORED_RE in CopyOp) — editor backups and
// deliberately-disabled templates never reach a project, so they are not drift.
const IGNORED_RE = /(~|-jostraca-off)$/;
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
// Code API. Returns the report; the CLI turns a non-ok report into a
// non-zero exit so this can gate CI.
async function doctor(actx) {
    const log = actx.log;
    const fs = actx.fs();
    const model = actx.model;
    const root = actx.folder;
    const report = {
        forked: [], edited: [], stale: [], missing: [], additive: [],
        unwired: [], resyncPending: [], aliasedDiff: [], ok: true,
    };
    const targets = Object.keys(model?.main?.[types_1.KIT]?.target ?? {});
    log.info({ point: 'doctor-start', targets: targets.length });
    for (const tname of targets) {
        const declared = model?.main?.[types_1.KIT]?.target?.[tname];
        // The target model records where it came from and what it was called
        // there (`base` / `origname`, written by `target add`). Fall back to the
        // bundled scaffold for a copy that predates provenance.
        //
        // `origname` is what makes an ALIAS checkable. The ref used to be rebuilt
        // as `<base>/../<tname>`, which names the INSTALLED target — so
        // `target add ts~ts2` sent doctor looking for a `ts2` scaffold that does
        // not exist, both trees walked empty, and every component read as
        // `additive` while every template read as `stale` (a FAILING category).
        // Real edits were undetectable and doctor went red on noise. With the
        // origin name recorded, the alias compares against the tree it actually
        // came from.
        const torigname = (declared && declared.origname) || tname;
        const tref = (declared && declared.base) ?
            node_path_1.default.join(declared.base, '..', torigname) +
                (torigname === tname ? '' : '~' + tname) : tname;
        let resolved;
        try {
            resolved = (0, target_1.resolveTarget)(tref, { folder: root, fs: () => fs });
        }
        catch (err) {
            log.warn({
                point: 'doctor-target-unresolved', target: tname, err: err.message,
                note: tname + ': cannot find its scaffold (' + err.message + ')'
            });
            continue;
        }
        if (null != resolved) {
            checkTarget(actx, resolved, report);
        }
    }
    checkWiring(actx, report);
    report.ok = 0 === report.forked.length + report.edited.length +
        report.stale.length + report.missing.length;
    for (const [kind, note] of [
        ['forked', 'FORKED (will be reverted by `target add`)'],
        ['edited', 'EDITED template master'],
        ['stale', 'STALE (no longer written by `target add`)'],
        ['missing', 'MISSING (would be written by `target add`)'],
        ['additive', 'additive (project-owned, not drift)'],
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
function checkTarget(actx, resolved, report) {
    const { tname, tfolder, torigname } = resolved;
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
    const excludes = (0, target_1.trimFeatures)({ log: quietLog(actx.log), fs: () => fs }, tfolder, torigname, tname, features);
    for (const tree of trees) {
        // Findings are reported at project-relative paths, the way a maintainer
        // would type them.
        const label = node_path_1.default.relative(root, tree.project).split(node_path_1.default.sep).join('/') + '/';
        const scaffoldFiles = 'edited' === tree.kind ?
            walk(fs, tree.scaffold).filter((rel) => !excluded(rel, excludes)) :
            walk(fs, tree.scaffold);
        // Scaffold path -> the name it lands under in the project.
        const landed = new Map(scaffoldFiles.map((rel) => [null == tree.rename ? rel : tree.rename(rel), rel]));
        const expected = Array.from(landed.keys()).sort();
        const actual = walk(fs, tree.project);
        const expectedSet = new Set(expected);
        const actualSet = new Set(actual);
        for (const rel of expected) {
            if (!actualSet.has(rel)) {
                report.missing.push(label + rel);
                continue;
            }
            const from = landed.get(rel);
            if (differs(fs, node_path_1.default.join(tree.scaffold, from), node_path_1.default.join(tree.project, rel), model, tree.replace, undefined, tree.rewrite)) {
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
    checkTargetModel(actx, resolved, report);
}
// The THIRD thing `target add` writes for a target, and the one nothing
// compared: `model/target/<t>.aontu` (src/action/target.ts, the Copy with the
// `'BASE'` replacement).
//
// It is not scaffolding trivia. That file carries the target's dependency
// set, its `phase` gates, `srcfeature`, `feature.trim` / `feature.fullset`
// and its publish-registry identity — and `target add` OVERWRITES it exactly
// as it overwrites src/cmp and tm. So a maintainer who fixes a dep version
// there loses the fix on the next resync with nothing said (the SDK regresses
// with nobody touching it, which is the failure the "a project decision
// belongs in the MODEL" rule exists to prevent), and a project whose copy
// predates a scaffold change carries the old declaration forever while doctor
// reported the target in sync. Both are the drift this command exists to
// name; the file was simply in neither tree it walked.
function checkTargetModel(actx, resolved, report) {
    const { tname, tfolder, torigname, base } = resolved;
    const fs = actx.fs();
    const scaffold = node_path_1.default.join(tfolder, 'model', 'target', torigname + '.aontu');
    // Nothing to compare against — a source that no longer ships this target.
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
    // rewrite `target add` applied — and anything left over is the project's
    // own differentiation, reported as informational.
    const aliased = tname !== torigname;
    const project = node_path_1.default.join(actx.folder, 'model', 'target', tname + '.aontu');
    const label = 'model/target/' + tname + '.aontu';
    if (!fs.existsSync(project)) {
        report.missing.push(label);
        return;
    }
    // The substitution `target add` applied on the way in: jostraca's template()
    // against the model (so `module: name: '$$name$$'` arrives as the project
    // slug) plus the provenance block recording where the scaffold was.
    //
    // NOT templateReplacements() — that is the tm/ tree's map. The two writers
    // pass different maps, so doctor has to as well, or every project reads as
    // forked on the `base:` line alone. The map itself is shared with the
    // writer (helpers/stdrep) so the two cannot drift.
    const provenance = (0, stdrep_1.provenanceReplace)({ base, origname: torigname, name: tname });
    // For an alias, compare against what the origin WOULD produce under the new
    // name, so the rename itself is not the difference.
    const rewrite = aliased ?
        (src) => (0, kind_1.aliasModelText)(src, torigname, tname) : undefined;
    if (!differs(fs, scaffold, project, actx.model, provenance, undefined, rewrite)) {
        return;
    }
    if (aliased) {
        report.aliasedDiff.push(label);
        return;
    }
    // A copy that predates the provenance rollout differs from the scaffold by
    // exactly the anchor line, because the scaffold now carries keys the copy
    // was written before. That is not a fork — the project changed nothing —
    // and reporting it as one would turn every existing consumer's CI red on
    // upgrade. Say what it is, and what fixes it.
    //
    // ONLY for a copy that is genuinely UNSTAMPED. Applying the tolerance to
    // any provenance-confined difference would hide a real edit: a project that
    // changed or deleted a `package:` line on a stamped copy would be reported
    // as resync-pending and pass the check, while the next `target add` quietly
    // reverted it — which is the whole class of thing doctor exists to catch.
    const unstamped = !String(fs.readFileSync(project, 'utf8'))
        .split('\n').some((line) => PROVENANCE_LINE_RE.test(line));
    if (unstamped && !differs(fs, scaffold, project, actx.model, provenance, (line) => PROVENANCE_LINE_RE.test(line), rewrite)) {
        report.resyncPending.push(label);
        return;
    }
    report.forked.push(label);
}
// A provenance line, in either the scaffold's anchor form or a stamped one.
const PROVENANCE_LINE_RE = /^\s*(base|origname|package):\s*'[^']*'\s*$/;
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
            if (IGNORED_RE.test(entry)) {
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
    const rawsrc = fs.readFileSync(scaffoldPath, 'utf8');
    const src = null == rewrite ? rawsrc : rewrite(rawsrc);
    // template() runs even when there is nothing to REPLACE, because jostraca's
    // Copy always interpolates `$$ref$$` against the model as well — the replace
    // map is an extra, not the whole substitution. Skipping it for the src/cmp
    // tree (whose Copy passes no replace map) meant the three Config fragments
    // that carry `$$const.Name$$` / `$$main.kit.info.servers.0.url$$` arrived
    // substituted and compared as bytes: every project with ts, js or dart
    // reported `src/cmp/<t>/fragment/Config.fragment.<ext>` as FORKED straight
    // out of `target add`, which is precisely the noise this function exists to
    // remove. With no `$$` refs and no replace keys, template() is the identity.
    const expected = (0, jostraca_1.template)(src, model, { replace });
    const actual = fs.readFileSync(projectPath, 'utf8');
    if (null == ignore) {
        return expected !== actual;
    }
    const strip = (s) => s.split('\n').filter((line) => !ignore(line)).join('\n');
    return strip(expected) !== strip(actual);
}
// trimFeatures logs its decisions; doctor is a report, not a run.
function quietLog(log) {
    const noop = () => { };
    const quiet = { info: noop, debug: noop, warn: log.warn.bind(log), error: noop, trace: noop, fatal: noop };
    quiet.child = () => quiet;
    return quiet;
}
//# sourceMappingURL=doctor.js.map