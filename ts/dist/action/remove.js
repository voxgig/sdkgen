"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kind_remove = kind_remove;
exports.planRemove = planRemove;
const kindCollection_1 = require("../helpers/kindCollection");
const node_path_1 = __importDefault(require("node:path"));
const types_1 = require("../types");
const utility_1 = require("../utility");
const definition_1 = require("../helpers/definition");
const featureSource_1 = require("../helpers/featureSource");
const manifest_1 = require("../helpers/manifest");
const junk_1 = require("../helpers/junk");
const kind_1 = require("./kind");
const resolve_1 = require("./resolve");
const action_1 = require("./action");
const doctor_1 = require("./doctor");
async function kind_remove(kind, names, actx) {
    const log = actx.log;
    const dryrun = !!actx.opts?.dryrun;
    const force = true === actx.flags?.force;
    const deleteOutput = true === actx.flags?.deleteOutput;
    (0, kind_1.kindDef)(kind);
    if (0 === names.length) {
        throw new utility_1.SdkGenError(kind + ' remove: nothing named' +
            '\n  usage: voxgig-sdkgen ' + kind + ' remove <name>[,<name>...]');
    }
    log.info({
        point: 'remove-start', kind, names,
        note: (dryrun ? '** DRY RUN ** ' : '') + kind + ' remove ' + names.join(',')
    });
    const plans = [];
    for (const name of names) {
        plans.push(await planRemove(kind, name, actx, deleteOutput));
    }
    const refused = plans.filter((p) => 0 < p.refused.length);
    if (0 < refused.length && !force) {
        // Differentiating an alias's model file is what an alias is for, so the
        // standard advice names the place that file already is.
        const aliased = refused.flatMap((p) => p.aliased);
        throw new utility_1.SdkGenError(kind + ' remove: refusing to delete what `' + kind + ' add` did not write' +
            refused.map((p) => '\n  ' + p.name + ':' +
                p.refused.map((r) => '\n    ' + r).join('')).join('') +
            (0 < aliased.length ?
                ('\n  ' + aliased.join(', ') + ' is an ALIAS\'s own model file: the' +
                    ' scaffold has none to compare it with, so differentiating it is' +
                    ' expected and there is nowhere else to move it. Pass --force to' +
                    ' delete it with the alias.') : '') +
            '\n  move any project decision into .sdk/model/, then run again;' +
            ' or pass --force to delete these too');
    }
    const removed = [];
    for (const plan of plans) {
        for (const r of plan.refused) {
            log.warn({
                point: 'remove-forced', kind, [kind]: plan.name, file: r,
                note: plan.name + ': --force, deleting ' + r
            });
        }
        for (const note of plan.notes) {
            log.warn({ point: 'remove-note', kind, [kind]: plan.name, note });
        }
        removed.push(...applyRemove(plan, actx, dryrun));
    }
    log.info({
        point: 'remove-end', kind, names, count: removed.length,
        note: dryrun ?
            ('** DRY RUN ** ' + removed.length + ' path(s) would be removed; nothing was written') :
            ('removed ' + removed.length + ' path(s)')
    });
    return {
        report: {
            ok: true,
            kind,
            names,
            removed,
            refused: plans.flatMap((p) => p.refused),
            notes: plans.flatMap((p) => p.notes),
            dryrun,
        }
    };
}
async function planRemove(kind, name, actx, deleteOutput) {
    const fs = actx.fs();
    const root = actx.folder;
    const model = actx.model;
    // A name, never a path: Path.join NORMALISES a traversal rather than
    // refusing it, so `go/../go` is indistinguishable from `go` once joined.
    // Same grammar as the add side, checked before any path is derived.
    if (!manifest_1.ITEM_NAME_RE.test(name)) {
        throw new utility_1.SdkGenError('Invalid ' + kind + ' name: ' + JSON.stringify(name) +
            '\n  a name matches ' + manifest_1.ITEM_NAME_RE.source + ' — it is not a path');
    }
    const declared = (0, kindCollection_1.kindCollection)(model, kind)?.[name];
    const modelfile = (0, definition_1.definitionPathAny)(fs, root, kind, name);
    const hasModel = fs.existsSync(modelfile);
    if (null == declared && !hasModel) {
        throw new utility_1.SdkGenError(kind + ' not installed: ' + name +
            '\n  nothing at ' + rel(root, modelfile) + ', and the model does not declare it');
    }
    if ('feature' === kind && ('test' === name || featureSource_1.BASE_FEATURE === name)) {
        throw new utility_1.SdkGenError('feature remove: `' + name + '` cannot be removed' +
            '\n  every target\'s generated test suite depends on it, and `target add`' +
            ' installs it unconditionally');
    }
    const plan = {
        kind, name, files: [], dirs: [], indexed: false,
        refused: [], aliased: [], notes: [],
    };
    // Feature overlays belong to both the feature and the target's tree.
    const inScope = (k, n) => (k === kind && n === name) ||
        ('feature' === kind && 'target' === k) ||
        ('target' === kind && 'feature' === k);
    const source = resolveDeclared(kind, name, declared, actx);
    if (null == source) {
        plan.refused.push('(source not found: the copy cannot be compared with what' +
            ' `' + kind + ' add` wrote; every file below is deleted only under --force)');
    }
    // The feature being removed counts as selected, so its own source is
    // compared rather than written off as stale — see checkTarget.
    const findings = null == source ? { all: [], aliased: new Set() } :
        await driftFindings(actx, inScope, 'feature' === kind ? [name] : undefined);
    if ('feature' === kind) {
        planFeature(plan, actx);
    }
    else {
        for (const tree of (0, kind_1.kindTrees)(kind, name)) {
            const dir = node_path_1.default.join(root, ...tree.path.split('/'));
            if (!fs.existsSync(dir)) {
                continue;
            }
            plan.dirs.push(tree.path);
            plan.files.push(...walk(fs, dir).map((r) => tree.path + '/' + r));
        }
    }
    if (hasModel) {
        plan.files.push('model/' + kind + '/' + node_path_1.default.basename(modelfile));
    }
    const wanted = new Set(plan.files);
    for (const f of findings.all) {
        if (wanted.has(f)) {
            plan.refused.push(f);
            if (findings.aliased.has(f)) {
                plan.aliased.push(f);
            }
        }
    }
    const index = node_path_1.default.join((0, definition_1.definitionFolder)(root, kind), (0, definition_1.indexName)(kind));
    plan.indexed = fs.existsSync(index) &&
        (0, action_1.removeIndexEntries)(String(fs.readFileSync(index, 'utf8')), [name]) !==
            String(fs.readFileSync(index, 'utf8'));
    if ('target' === kind) {
        planOutput(plan, actx, declared, deleteOutput);
    }
    plan.notes.push(...projectMentions(kind, name, actx));
    if ('feature' === kind && 0 < plan.files.length) {
        plan.notes.push(name + ': a target\'s cross-feature test suite may still' +
            ' name this feature; `target add <t>` re-applies the trim for each target');
    }
    return plan;
}
function planFeature(plan, actx) {
    const fs = actx.fs();
    const root = actx.folder;
    const targets = actx.model?.main?.[types_1.KIT]?.target ?? {};
    for (const tname of Object.keys(targets).sort()) {
        const tm = node_path_1.default.join(root, 'tm', tname);
        if (!fs.existsSync(tm)) {
            continue;
        }
        for (const found of (0, featureSource_1.findFeatureSources)(fs, tm, [plan.name])) {
            const abs = node_path_1.default.join(tm, found.path);
            const base = 'tm/' + tname + '/' + found.path;
            if (found.folder) {
                plan.dirs.push(base);
                plan.files.push(...walk(fs, abs).map((r) => base + '/' + r));
            }
            else {
                plan.files.push(base);
            }
        }
    }
}
function planOutput(plan, actx, declared, deleteOutput) {
    const fs = actx.fs();
    const root = actx.folder;
    if (null != declared?.output?.path) {
        plan.notes.push(plan.name + ': generates out of tree (' +
            declared.output.path + '); that output is not touched');
        return;
    }
    const output = node_path_1.default.join(root, '..', plan.name);
    if (!fs.existsSync(output)) {
        return;
    }
    if (deleteOutput) {
        plan.output = output;
        return;
    }
    plan.notes.push(plan.name + ': generated output kept at ' +
        rel(root, output) + '; pass --delete-output to remove it');
}
function resolveDeclared(kind, name, declared, actx) {
    const ref = (0, resolve_1.recordedRef)(declared, name) || name;
    try {
        return (0, resolve_1.resolveSource)(ref, kind, { folder: actx.folder, fs: actx.fs, log: actx.log, model: actx.model });
    }
    catch (err) {
        return undefined;
    }
}
async function driftFindings(actx, scope, selected) {
    const quiet = quietLog(actx.log);
    const res = await (0, doctor_1.doctor)({ ...actx, log: quiet }, scope, selected);
    const report = res.report;
    return {
        all: [
            ...report.forked,
            ...report.edited,
            ...report.stale,
            ...report.additive,
            ...report.aliasedDiff,
        ],
        // Kept apart because it needs different advice — see kindRemove.
        aliased: new Set(report.aliasedDiff),
    };
}
// Model files outside the item's own that still name it: a project's
// declarations are the project's, so they are reported, never edited.
function projectMentions(kind, name, actx) {
    const fs = actx.fs();
    const root = actx.folder;
    const modeldir = node_path_1.default.join(root, 'model');
    if (!fs.existsSync(modeldir)) {
        return [];
    }
    const own = kind + '/';
    const re = new RegExp('\\b' + kind + ':\\s*[\'"]?' + escapeRe(name) + '[\'"]?\\s*:');
    const out = [];
    for (const r of walk(fs, modeldir)) {
        if (!/\.(aontu|aon)$/.test(r) || r.startsWith(own)) {
            continue;
        }
        let src = '';
        try {
            src = String(fs.readFileSync(node_path_1.default.join(modeldir, r), 'utf8'));
        }
        catch (err) {
            continue;
        }
        if (re.test(src)) {
            out.push(name + ': model/' + r + ' still declares main.' + types_1.KIT + '.' +
                ('edition' === kind ? 'doc.edition' : kind) + '.' + name +
                '; remove that declaration by hand');
        }
    }
    return out;
}
function applyRemove(plan, actx, dryrun) {
    const fs = actx.fs();
    const log = actx.log;
    const root = actx.folder;
    const { kind, name } = plan;
    const touched = [];
    const say = (file, what) => {
        touched.push(file);
        log.info({
            point: 'remove-file', kind, [kind]: name, file, dryrun,
            note: (dryrun ? 'would remove ' : 'removed ') + what
        });
    };
    for (const f of plan.files) {
        say(f, f);
        if (!dryrun) {
            fs.unlinkSync(node_path_1.default.join(root, ...f.split('/')));
        }
    }
    for (const d of plan.dirs) {
        if (!dryrun) {
            rmEmptyTree(fs, node_path_1.default.join(root, ...d.split('/')));
        }
    }
    if (plan.indexed) {
        const index = node_path_1.default.join((0, definition_1.definitionFolder)(root, kind), (0, definition_1.indexName)(kind));
        say('model/' + kind + '/' + (0, definition_1.indexName)(kind), 'the index entry for ' + name);
        if (!dryrun) {
            fs.writeFileSync(index, (0, action_1.removeIndexEntries)(String(fs.readFileSync(index, 'utf8')), [name]));
        }
    }
    if (null != plan.output) {
        say(rel(root, plan.output), 'generated output ' + rel(root, plan.output));
        if (!dryrun) {
            fs.rmSync(plan.output, { recursive: true, force: true });
        }
    }
    if (!dryrun) {
        delete (0, kindCollection_1.kindCollection)(actx.model, kind)[name];
    }
    return touched;
}
// Drop a tree whose files have gone. Anything still inside (a droppings
// file the walk skipped, say) goes with it: the tree is the item's.
function rmEmptyTree(fs, dir) {
    if (!fs.existsSync(dir)) {
        return;
    }
    fs.rmSync(dir, { recursive: true, force: true });
}
function walk(fs, dir) {
    const out = [];
    const descend = (r) => {
        const abs = '' === r ? dir : node_path_1.default.join(dir, r);
        for (const entry of fs.readdirSync(abs).sort()) {
            if ((0, junk_1.isJunk)(entry)) {
                continue;
            }
            const er = '' === r ? entry : r + '/' + entry;
            if (fs.statSync(node_path_1.default.join(dir, er)).isDirectory()) {
                descend(er);
            }
            else {
                out.push(er);
            }
        }
    };
    descend('');
    return out.sort();
}
function rel(root, abs) {
    return node_path_1.default.relative(root, abs).split(node_path_1.default.sep).join('/');
}
function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function quietLog(log) {
    const noop = () => { };
    const quiet = {
        info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
    };
    quiet.child = () => quiet;
    return quiet;
}
//# sourceMappingURL=remove.js.map