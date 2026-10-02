"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveStrict = liveStrict;
exports.liveStrictNote = liveStrictNote;
exports.liveFlowNeeds = liveFlowNeeds;
const types_1 = require("../types");
const buildIdNames_1 = require("./buildIdNames");
function liveStrict(model, target) {
    const perTarget = null == target ? undefined :
        model?.main?.[types_1.KIT]?.target?.[target]?.test?.live?.strict;
    const configured = perTarget ?? model?.main?.[types_1.KIT]?.test?.live?.strict;
    return false !== configured;
}
// The comment a generated live test carries, in the target's own comment
// syntax, so every target states the setting and its effect alike.
function liveStrictNote(strict, prefix, indent = '') {
    return [
        `main.kit.test.live.strict is ${strict} (the default is true): a live`,
        'request that fails, or a live test missing an input it needs,',
        strict ? 'fails the test.' : 'skips the test with the reason.',
        'An account with no record for a test to read skips it either way.',
    ].map((line) => indent + prefix + ' ' + line).join('\n');
}
// What an entity flow generated from the offline fixtures needs before it
// can run live. A flow that creates its record needs nothing of the
// fixture's; one that only reads takes the first record its list finds.
function liveFlowNeeds(entity, flow) {
    const steps = (0, buildIdNames_1.flowSteps)(flow);
    const hasCreate = steps.some((step) => 'create' === step.o);
    const bound = (map) => Object.entries(map || {})
        .filter(([k, v]) => !k.endsWith('$') && 'string' === typeof v && '' !== v)
        .map(([, v]) => v);
    const keys = new Set();
    for (const step of steps) {
        if ('create' === step.o || 'list' === step.o)
            bound(step.m).forEach((k) => keys.add(k));
        if ('update' === step.o)
            bound(step.d).forEach((k) => keys.add(k));
    }
    const needs = { keys: [...keys] };
    if (hasCreate || null == entity?.id) {
        return needs;
    }
    if (steps.some((step) => 'update' === step.o)) {
        needs.blocked = 'the flow updates a ' + entity.name + ' record it did not create';
    }
    else if (steps.some((step) => 'load' === step.o)) {
        const list = steps.find((step) => 'list' === step.o);
        if (null == list) {
            needs.blocked = 'the flow loads a ' + entity.name + ' record it has no list to find';
        }
        else {
            needs.discover = Object.fromEntries(Object.entries(list.m || {})
                .filter(([k, v]) => !k.endsWith('$') && 'string' === typeof v && '' !== v));
        }
    }
    return needs;
}
//# sourceMappingURL=testPolicy.js.map