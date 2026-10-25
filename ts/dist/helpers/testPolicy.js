"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveStrict = liveStrict;
exports.liveStrictNote = liveStrictNote;
exports.liveFlowNeeds = liveFlowNeeds;
exports.liveIdKey = liveIdKey;
exports.liveExampleIds = liveExampleIds;
exports.liveQueryExamples = liveQueryExamples;
exports.liveRouteExamples = liveRouteExamples;
exports.liveStepExamples = liveStepExamples;
const types_1 = require("../types");
const buildIdNames_1 = require("./buildIdNames");
const graphqlPoint_1 = require("./graphqlPoint");
const getMatchEntries_1 = require("./getMatchEntries");
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
// The *_ENTID key, the same in the live entity harness and every live test.
function liveIdKey(entityName, paramName) {
    return ('id' === paramName ? entityName : paramName.replace(/_id$/, '')) + '01';
}
function scalarExample(arg) {
    const ex = arg?.ex;
    return 'string' === typeof ex || 'number' === typeof ex || 'boolean' === typeof ex ? ex : undefined;
}
function liveExampleIds(entity) {
    const ids = {};
    for (const opname of ['list', 'load']) {
        const points = entity?.op?.[opname]?.points;
        const point = null == points ? undefined : (0, graphqlPoint_1.primaryPoint)(points, entity.name, opname);
        for (const arg of point?.g?.params || []) {
            const key = liveIdKey(entity.name, arg.n);
            const ex = scalarExample(arg);
            if (undefined === ids[key] && undefined !== ex)
                ids[key] = ex;
        }
    }
    return Object.keys(ids).sort().map((key) => [key, ids[key]]);
}
function liveQueryExamples(point) {
    return (point?.g?.query || [])
        .filter((arg) => arg.r && undefined !== scalarExample(arg))
        .map((arg) => [arg.n, scalarExample(arg)]);
}
// The live entity harness's route: the first whose required parameters are
// all bound or exemplified. A load of a known record binds its own path.
function liveRouteExamples(entity, opname, bound, pathBound = false) {
    const points = (entity?.op?.[opname]?.points || [])
        .filter((point) => false !== point.a && null == point.q?.$action);
    for (const point of points) {
        const params = pathBound ? [] : point.g?.params || [];
        const args = [...params, ...(point.g?.query || []).filter((arg) => arg.r)];
        const fill = [];
        let usable = true;
        for (const arg of args) {
            if (bound.includes(arg.n) || fill.some(([name]) => name === arg.n))
                continue;
            const ex = scalarExample(arg);
            if (undefined !== ex)
                fill.push([arg.n, ex]);
            else if (false !== arg.r)
                usable = false;
        }
        if (usable)
            return fill;
    }
    return [];
}
function liveStepExamples(entity, step) {
    if ('list' !== step?.o && 'load' !== step?.o)
        return [];
    const bound = (0, getMatchEntries_1.getMatchEntries)(step).map(([name]) => name);
    return liveRouteExamples(entity, step.o, bound, 'load' === step.o && null != entity?.id);
}
//# sourceMappingURL=testPolicy.js.map