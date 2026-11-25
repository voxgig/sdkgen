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
const resolve_1 = require("../action/resolve");
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
    if (isMap(kit.target)) {
        input.target = ruleTargets(kit.target);
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
    linkConsumers(kit.target, out.main[apidef_1.KIT].target);
    kit.fact = isMap(kit.fact) ? kit.fact : {};
    kit.fact.active = activeNames(kit.target);
    texts.forEach((t, i) => place(t.at, t.path, out.escape['t' + i]));
    return model;
}
// aontu lists no map's keys, so the active targets are named here.
function activeNames(target) {
    return !isMap(target) ? [] : Object.keys(target).sort()
        .filter((name) => isMap(target[name]) && false !== target[name].active);
}
// A hand-built model may lack the slots the rules read, and only code can say
// whether a target's provenance leads to the bundled scaffold.
function ruleTargets(target) {
    const out = {};
    for (const [name, t] of Object.entries(target)) {
        const decl = t;
        out[name] = !isMap(decl) ? decl : {
            ...decl,
            name: null == decl.name ? name : decl.name,
            origname: null == decl.origname ? '' : decl.origname,
            surface: null == decl.surface ? '' : decl.surface,
            consumes: null == decl.consumes ? '' : decl.consumes,
            scaffold: (0, resolve_1.resolvesBundled)(decl, name),
        };
    }
    return out;
}
// The rules name the origin a target builds on; only the installed keys can
// say which target that is, and which targets build on each one.
function linkConsumers(target, derived) {
    if (!isMap(target) || !isMap(derived)) {
        return;
    }
    const names = Object.keys(target).sort().filter((name) => isMap(target[name]?.fact));
    for (const name of names) {
        target[name].fact.consumes = consumed(target, name, derived[name]?.derive?.wraps);
    }
    for (const name of names) {
        target[name].fact.consumers = names.filter((other) => false !== target[other].active && name === target[other].fact.consumes);
    }
}
function consumed(target, name, wraps) {
    if ('string' !== typeof wraps || '' === wraps) {
        return '';
    }
    if (isMap(target[wraps])) {
        return wraps;
    }
    const found = Object.keys(target).sort().filter((other) => other !== name && wraps === target[other]?.fact?.origin);
    if (1 < found.length) {
        throw new utility_1.SdkGenError('Target "' + name + '" builds on ' + wraps + ', and ' +
            found.length + ' installed targets come from it: ' + found.join(', ') +
            '. Name one in its own model, as `consumes: \'<target>\'`.');
    }
    return found[0] ?? '';
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