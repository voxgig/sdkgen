"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyFacts = applyFacts;
exports.fact = fact;
exports.refuseRootPlan = refuseRootPlan;
const node_fs_1 = require("node:fs");
const aontu_1 = require("aontu");
const apidef_1 = require("@voxgig/apidef");
const doctext_1 = require("./doctext");
const shipped_1 = require("./shipped");
const utility_1 = require("../utility");
// No fact rule reads these, and they are most of a large model.
const UNREAD = ['entity', 'flow'];
function isMap(v) {
    return null != v && 'object' === typeof v && !Array.isArray(v);
}
function copyFacts(from, to) {
    for (const [key, val] of Object.entries(from)) {
        if ('fact' === key) {
            if (isMap(val) && 0 < Object.keys(val).length) {
                to.fact = val;
            }
        }
        else if (isMap(val) && isMap(to[key])) {
            copyFacts(val, to[key]);
        }
    }
}
// Computes every fact once and writes it into the model beside what it
// describes, as `fact`. Templates read facts with `fact`; none computes one.
function applyFacts(model) {
    const kit = model?.main?.[apidef_1.KIT];
    if (!isMap(kit)) {
        return model;
    }
    const input = {};
    for (const [key, val] of Object.entries(kit)) {
        if (!UNREAD.includes(key)) {
            input[key] = val;
        }
    }
    const texts = (0, doctext_1.docTexts)(model);
    const escape = Object.fromEntries(texts.map((t, i) => ['t' + i, { raw: t.raw, vendor: t.vendor }]));
    const path = (0, shipped_1.factRulesFile)();
    const src = JSON.stringify({ main: { [apidef_1.KIT]: input }, escape }).slice(1, -1) +
        '\n' + (0, node_fs_1.readFileSync)(path, 'utf8');
    const errs = [];
    const out = new aontu_1.Aontu().generate(src, { path, errs });
    if (0 < errs.length || null == out?.main?.[apidef_1.KIT]) {
        throw new Error('sdkgen facts: the fact rules did not evaluate: ' +
            errs.map((e) => `[${e.why}] ${e.msg}`).join(' | '));
    }
    copyFacts(out.main[apidef_1.KIT], kit);
    texts.forEach((t, i) => place(t.at, t.path, out.escape['t' + i]));
    return model;
}
function place(at, path, forms) {
    let node = at.fact = isMap(at.fact) ? at.fact : {};
    for (const key of path.slice(0, -1)) {
        node = node[key] = isMap(node[key]) ? node[key] : {};
    }
    node[path[path.length - 1]] = forms;
}
function fact(node, name) {
    const facts = node?.fact;
    if (!isMap(facts) || !(name in facts)) {
        throw new Error(`sdkgen facts: '${node?.name ?? '?'}' has no fact '${name}': ` +
            'the model did not pass through applyFacts, or lacks what the fact reads');
    }
    return facts[name];
}
// A plan no Root can write: several targets claiming the project root, or a
// target there beside the root documents, which would overwrite its own.
// `external` names the targets this run writes elsewhere; a target with no
// `output` claims no place at all.
function refuseRootPlan(model, external = []) {
    const kit = model.main[apidef_1.KIT];
    const target = kit.target || {};
    const atRoot = Object.keys(target).sort().filter((name) => !external.includes(name) && false !== target[name].active &&
        null != target[name].output && 'root' === fact(target[name], 'place'));
    if (1 < atRoot.length) {
        throw new utility_1.SdkGenError('Only one target can be generated at the project root, and ' +
            atRoot.length + ' declare `output: root: true`: ' + atRoot.join(', ') + '.');
    }
    if (1 === atRoot.length && fact(kit, 'top')) {
        throw new utility_1.SdkGenError('Target "' + atRoot[0] + '" is generated at the project root, where the ' +
            'SDK repository files (README, LICENSE, Makefile, workflows) would ' +
            'overwrite its own. Declare `main: kit: phase: top: active: false` in ' +
            'model/project.aontu.');
    }
}
//# sourceMappingURL=facts.js.map