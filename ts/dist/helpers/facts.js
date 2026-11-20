"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyFacts = applyFacts;
exports.fact = fact;
const node_fs_1 = require("node:fs");
const aontu_1 = require("aontu");
const apidef_1 = require("@voxgig/apidef");
const shipped_1 = require("./shipped");
// No fact rule reads these, and they are most of a large model.
const UNREAD = ['entity', 'flow'];
function isMap(v) {
    return null != v && 'object' === typeof v && !Array.isArray(v);
}
function copyFacts(from, to) {
    for (const [key, val] of Object.entries(from)) {
        if ('fact' === key) {
            to.fact = val;
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
    const path = (0, shipped_1.factRulesFile)();
    const src = JSON.stringify({ main: { [apidef_1.KIT]: input } }).slice(1, -1) +
        '\n' + (0, node_fs_1.readFileSync)(path, 'utf8');
    const errs = [];
    const out = new aontu_1.Aontu().generate(src, { path, errs });
    if (0 < errs.length || null == out?.main?.[apidef_1.KIT]) {
        throw new Error('sdkgen facts: the fact rules did not evaluate: ' +
            errs.map((e) => `[${e.why}] ${e.msg}`).join(' | '));
    }
    copyFacts(out.main[apidef_1.KIT], kit);
    return model;
}
function fact(node, name) {
    const facts = node?.fact;
    if (!isMap(facts) || !(name in facts)) {
        throw new Error(`sdkgen facts: '${node?.name ?? '?'}' has no fact '${name}': ` +
            'the model did not pass through applyFacts, or lacks what the fact reads');
    }
    return facts[name];
}
//# sourceMappingURL=facts.js.map