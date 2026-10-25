"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIVE_GETONLY_ENV = void 0;
exports.liveStrict = liveStrict;
exports.liveStrictNote = liveStrictNote;
exports.liveFlowNeeds = liveFlowNeeds;
exports.liveIdKey = liveIdKey;
exports.liveExampleIds = liveExampleIds;
exports.liveQueryExamples = liveQueryExamples;
exports.liveRouteExamples = liveRouteExamples;
exports.liveStepExamples = liveStepExamples;
exports.liveEntity = liveEntity;
exports.liveFlowSteps = liveFlowSteps;
exports.liveStepId = liveStepId;
exports.liveGetOnly = liveGetOnly;
exports.liveGetOnlyReason = liveGetOnlyReason;
exports.liveDirectGetOnly = liveDirectGetOnly;
exports.liveExcludedLines = liveExcludedLines;
exports.liveExcludedSummary = liveExcludedSummary;
const types_1 = require("../types");
const buildIdNames_1 = require("./buildIdNames");
const graphqlPoint_1 = require("./graphqlPoint");
const getMatchEntries_1 = require("./getMatchEntries");
const resolved_1 = require("./resolved");
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
function scalar(value) {
    return 'string' === typeof value || 'number' === typeof value || 'boolean' === typeof value ?
        value : undefined;
}
function scalarExample(arg) {
    return scalar(arg?.ex);
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
        .map((arg) => [arg.or || arg.n, scalarExample(arg)]);
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
// The first value a parameter's enum allows; apidef already takes a schema
// default as the example.
function enumExample(facts, arg) {
    const where = 'param' === arg.k ? 'path' : arg.k;
    const def = (Array.isArray(facts?.parameters) ? facts.parameters : [])
        .find((param) => param?.name === (arg.or ?? arg.n) && (null == param.in || param.in === where));
    const values = (def?.schema ?? def)?.enum;
    return Array.isArray(values) ? scalar(values[0]) : undefined;
}
// The entity as a live test reads it: a required parameter with no example
// takes the first value its definition's enum allows.
function liveEntity(ctx$, entity) {
    let filled = false;
    const op = {};
    for (const [name, operation] of Object.entries(entity?.op || {})) {
        op[name] = !Array.isArray(operation?.points) ? operation : {
            ...operation,
            points: operation.points.map((point) => {
                if (null == point?.g)
                    return point;
                const facts = (0, resolved_1.pointFacts)(ctx$, point);
                const g = { ...point.g };
                for (const kind of ['params', 'query'].filter((kind) => Array.isArray(g[kind]))) {
                    g[kind] = g[kind].map((arg) => {
                        const ex = !arg?.r || undefined !== scalarExample(arg) ? undefined : enumExample(facts, arg);
                        if (undefined === ex)
                            return arg;
                        filled = true;
                        return { ...arg, ex };
                    });
                }
                return { ...point, g };
            }),
        };
    }
    return filled ? { ...entity, op } : entity;
}
// Set by the GET-only guard of a read-only live run.
const LIVE_GETONLY_ENV = 'VOXGIG_GETONLY_GUARD';
exports.LIVE_GETONLY_ENV = LIVE_GETONLY_ENV;
// The steps of a flow the live harness runs, as its step ids count them.
function liveFlowSteps(flow) {
    return Object.values(flow?.step || {})
        .filter((step) => false !== step?.a || true === step?.unreachable);
}
function liveStepId(entity, step, index) {
    return entity.name + '.' + step.o + '.' + index;
}
const GETONLY = 'GET-only live run: ';
const isGet = (point) => 'GET' === String(point?.m).toUpperCase();
const routeOf = (point) => String(point?.m).toUpperCase() + ' ' + point?.o;
function writeRoute(entity, opname) {
    const points = (entity?.op?.[opname]?.points || []).filter((point) => false !== point.a);
    return 0 === points.length || points.some(isGet) ? undefined : routeOf(points[0]);
}
// Why a GET-only live run sends no request to a route: undefined for a GET.
function liveGetOnlyReason(point) {
    return isGet(point) ? undefined : GETONLY + 'needs ' + routeOf(point);
}
// What a GET-only live run leaves out of a flow: each step no GET route
// reaches, and each step that acts on a record only such a step gives.
// Undefined when every step can run.
function liveGetOnly(entity, flow) {
    const steps = liveFlowSteps(flow);
    const reasons = new Map();
    for (const step of steps) {
        const route = writeRoute(entity, step.o);
        if (null != route)
            reasons.set(step, 'needs ' + route);
    }
    if (0 === reasons.size)
        return undefined;
    const id = (step) => liveStepId(entity, step, steps.indexOf(step));
    const left = () => steps.filter((step) => !reasons.has(step));
    const create = steps.find((step) => 'create' === step.o && reasons.has(step));
    const sources = steps.filter((step) => ['create', 'list'].includes(step.o) && reasons.has(step));
    if (null != entity?.id && 0 < sources.length) {
        for (const step of null == create ? [] : left()) {
            if (['update', 'remove'].includes(step.o)) {
                reasons.set(step, 'acts on the record ' + id(create) + ' makes');
            }
            else if ('list' === step.o && (step.v || []).some((v) => 'ItemNotExists' === v?.apply)) {
                reasons.set(step, 'checks a removal this run does not make');
            }
        }
        if (!left().some((step) => 'list' === step.o)) {
            for (const step of left().filter((step) => 'load' === step.o)) {
                reasons.set(step, 'reads a record only ' + sources.map(id).join(', ') + ' gives');
            }
        }
    }
    return {
        excluded: steps.filter((step) => reasons.has(step))
            .map((step) => ({ id: id(step), reason: GETONLY + reasons.get(step) })),
        flow: { ...flow, step: left() },
    };
}
// The ids a live direct test needs that a GET-only run cannot get, unless
// *_ENTID gives them: of a record only a non-GET create makes, no GET list finds.
function liveDirectGetOnly(model, entity, test, keys) {
    const entities = model?.main?.[types_1.KIT]?.entity || {};
    const out = [];
    for (const key of keys) {
        const owner = liveIdKey(entity.name, 'id') === key ? entity : entities[key.replace(/01$/, '')];
        const make = null == owner ? undefined : writeRoute(owner, 'create');
        const listed = (owner?.op?.list?.points || []).some((point) => false !== point.a && isGet(point));
        if (null != make && !listed) {
            out.push({ key, id: test, reason: GETONLY + 'needs ' + key + ', which only ' + make + ' gives' });
        }
    }
    return out;
}
// The lines the live harness prints for the steps a run leaves out.
function liveExcludedLines(plan) {
    return plan.excluded.map(({ id, reason }) => 'LIVE STEP ' + JSON.stringify({ id, state: 'excluded', attempted: false, reason }));
}
// Why a test whose every step is left out skips, as the live harness says it.
function liveExcludedSummary(plan) {
    return 'Live coverage incomplete: ' +
        plan.excluded.map(({ id, reason }) => id + ' excluded (' + reason + ')').join('; ');
}
//# sourceMappingURL=testPolicy.js.map