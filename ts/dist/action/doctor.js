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
        unwired: [], ok: true,
    };
    const targets = Object.keys(model?.main?.[types_1.KIT]?.target ?? {});
    log.info({ point: 'doctor-start', targets: targets.length });
    for (const tname of targets) {
        const declared = model?.main?.[types_1.KIT]?.target?.[tname];
        // The target model records where it came from (`base`, written by
        // `target add`). Fall back to the bundled scaffold.
        const tref = (declared && declared.base) ?
            node_path_1.default.join(declared.base, '..', tname) : tname;
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
    const trees = [
        {
            project: node_path_1.default.join(root, 'src', 'cmp', tname),
            scaffold: node_path_1.default.join(tfolder, 'src', 'cmp', torigname),
            replace: {},
            kind: 'forked',
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
        const expected = 'edited' === tree.kind ?
            walk(fs, tree.scaffold).filter((rel) => !excluded(rel, excludes)) :
            walk(fs, tree.scaffold);
        const actual = walk(fs, tree.project);
        const expectedSet = new Set(expected);
        const actualSet = new Set(actual);
        for (const rel of expected) {
            if (!actualSet.has(rel)) {
                report.missing.push(label + rel);
                continue;
            }
            if (differs(fs, node_path_1.default.join(tree.scaffold, rel), node_path_1.default.join(tree.project, rel), model, tree.replace)) {
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
            const known = fs.existsSync(node_path_1.default.join(tree.scaffold, rel));
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
    // No scaffold file means nothing to compare against, which is the ALIASED
    // target: `target add go~go2` copies go.aontu to model/target/go2.aontu and
    // docs/how-to/add-a-target.md then tells the project to EDIT it (a second Go
    // module needs its own module name and deps). doctor resolves a target by
    // its INSTALLED name — the model records `base`, not the ref it came from —
    // so the origin is not recoverable here, and reporting that documented edit
    // as drift on every run is worse than saying nothing.
    if (!fs.existsSync(scaffold)) {
        return;
    }
    const project = node_path_1.default.join(actx.folder, 'model', 'target', tname + '.aontu');
    const label = 'model/target/' + tname + '.aontu';
    if (!fs.existsSync(project)) {
        report.missing.push(label);
        return;
    }
    // The substitution `target add` applied on the way in: jostraca's template()
    // against the model (so `module: name: '$$name$$'` arrives as the project
    // slug) plus the `'BASE'` replacement recording where the scaffold was.
    //
    // NOT templateReplacements() — that is the tm/ tree's map. The two writers
    // pass different maps, so doctor has to as well, or every csharp/swift/ts
    // project reads as forked on the `base:` line alone.
    if (differs(fs, scaffold, project, actx.model, { "'BASE'": "'" + base + "'" })) {
        report.forked.push(label);
    }
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
function differs(fs, scaffoldPath, projectPath, model, replace) {
    if (BINARY_RE.test(scaffoldPath)) {
        return !fs.readFileSync(scaffoldPath).equals(fs.readFileSync(projectPath));
    }
    const src = fs.readFileSync(scaffoldPath, 'utf8');
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
    return expected !== fs.readFileSync(projectPath, 'utf8');
}
// trimFeatures logs its decisions; doctor is a report, not a run.
function quietLog(log) {
    const noop = () => { };
    const quiet = { info: noop, debug: noop, warn: log.warn.bind(log), error: noop, trace: noop, fatal: noop };
    quiet.child = () => quiet;
    return quiet;
}
//# sourceMappingURL=doctor.js.map