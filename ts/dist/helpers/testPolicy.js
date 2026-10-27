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
exports.flowLoadRoute = flowLoadRoute;
exports.flowLoadReadsRecord = flowLoadReadsRecord;
exports.liveFlowRoutes = liveFlowRoutes;
exports.liveEntity = liveEntity;
exports.liveFlowSteps = liveFlowSteps;
exports.liveStepId = liveStepId;
exports.liveGetOnly = liveGetOnly;
exports.liveGetOnlyReason = liveGetOnlyReason;
exports.liveFlowPlan = liveFlowPlan;
exports.liveGates = liveGates;
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
const bindings = (map) => Object.entries(map || {})
    .filter(([k, v]) => !k.endsWith('$') && 'string' === typeof v && '' !== v);
// What an entity flow generated from the offline fixtures needs before it
// can run live: a create gives its record, a list finds it, else *_ENTID or
// the load's example names it. A bound parameter falls back to its example.
function liveFlowNeeds(entity, flow) {
    const steps = (0, buildIdNames_1.flowSteps)(flow);
    const hasCreate = steps.some((step) => 'create' === step.o);
    const keyed = null != entity?.id;
    const list = steps.find((step) => 'list' === step.o);
    const keys = new Set();
    const examples = new Map();
    const fill = (args) => args.filter((arg) => null != arg.key).forEach((arg) => undefined === arg.ex ? keys.add(arg.key) : examples.has(arg.key) || examples.set(arg.key, arg.ex));
    let unrouted = false;
    for (const step of steps) {
        if ('create' === step.o)
            bindings(step.m).forEach(([, k]) => keys.add(k));
        if ('update' === step.o)
            bindings(step.d).forEach(([, k]) => keys.add(k));
        if ('list' === step.o) {
            const args = liveStepArgs(entity, step, flow) || [];
            fill(args);
            bindings(step.m).filter(([, k]) => !args.some((arg) => k === arg.key)).forEach(([, k]) => keys.add(k));
        }
        if ('load' === step.o && !liveRecordFound(entity, flow)) {
            const args = liveStepArgs(entity, step, flow);
            unrouted = unrouted || null == args;
            fill(args || []);
        }
    }
    const needs = { keys: [...keys] };
    const seeded = [...examples].filter(([key]) => !keys.has(key));
    if (0 < seeded.length) {
        needs.examples = seeded;
    }
    if (hasCreate || !keyed) {
        return needs;
    }
    if (steps.some((step) => 'update' === step.o)) {
        needs.blocked = 'the flow updates a ' + entity.name + ' record it did not create';
    }
    else if (steps.some((step) => 'load' === step.o)) {
        if (null != list) {
            needs.discover = Object.fromEntries(bindings(list.m));
        }
        else if (unrouted) {
            needs.blocked = 'the flow loads a ' + entity.name + ' record it has no list to find';
        }
        else {
            needs.record = loadIdKey(entity, steps.find((step) => 'load' === step.o));
        }
    }
    if (null != needs.blocked) {
        delete needs.examples;
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
const isAction = (point) => null != point.q?.$action;
// An action route only when the operation has no other.
function plainPoints(entity, opname) {
    const points = (entity?.op?.[opname]?.points || []).filter((point) => false !== point.a);
    const plain = points.filter((point) => !isAction(point));
    return 0 < plain.length ? plain : points;
}
function routeArgs(point, bound, pathBound) {
    const params = pathBound ? [] : point.g?.params || [];
    const args = [...params, ...(point.g?.query || []).filter((arg) => arg.r)];
    const out = [];
    for (const arg of args) {
        if (out.some(({ name }) => name === arg.n))
            continue;
        const ex = scalarExample(arg);
        const binding = bound.get(arg.n);
        if (bound.has(arg.n)) {
            out.push({ name: arg.n, ex, bound: true, ...('string' === typeof binding ? { key: binding } : {}) });
        }
        else if (undefined !== ex)
            out.push({ name: arg.n, ex });
        else if (false !== arg.r)
            return undefined;
    }
    return out;
}
function routeExamples(point, bound, pathBound) {
    const args = routeArgs(point, new Map(bound.map((name) => [name, undefined])), pathBound);
    return null == args ? undefined : unboundExamples(args);
}
const unboundExamples = (args) => args.filter((arg) => !arg.bound).map((arg) => [arg.name, arg.ex]);
function firstRouteArgs(points, bound, pathBound) {
    for (const point of points) {
        const args = routeArgs(point, bound, pathBound);
        if (null != args)
            return args;
    }
    return undefined;
}
// The live entity harness's route: the first whose required parameters are
// all bound or exemplified. A load of a known record binds its own path.
function liveRouteExamples(entity, opname, bound, pathBound = false) {
    for (const point of plainPoints(entity, opname)) {
        const fill = routeExamples(point, bound, pathBound);
        if (null != fill)
            return fill;
    }
    return [];
}
// A record the flow creates or its list finds; an entity with no id has none.
function liveRecordFound(entity, flow) {
    return null != entity?.id &&
        (0, buildIdNames_1.flowSteps)(flow).some((step) => 'create' === step.o || 'list' === step.o);
}
// The idmap key a live load of no known record reads its id from.
function loadIdKey(entity, step) {
    const binding = (0, getMatchEntries_1.getMatchEntries)(step).find(([name]) => 'id' === name)?.[1];
    return 'string' === typeof binding && '' !== binding ? binding : liveIdKey(entity.name, 'id');
}
// The arguments of the route a live list or load takes; undefined when none qualifies.
function liveStepArgs(entity, step, flow) {
    if ('list' !== step?.o && 'load' !== step?.o)
        return [];
    const bound = new Map((0, getMatchEntries_1.getMatchEntries)(step));
    const keyed = 'load' === step.o && null != entity?.id;
    if (keyed && (null == flow || liveRecordFound(entity, flow))) {
        const route = flowLoadRoute(entity, step);
        return null == route ? firstRouteArgs(plainPoints(entity, 'load'), bound, true) :
            routeArgs(route.point, bound, true);
    }
    if (keyed) {
        bound.set('id', loadIdKey(entity, step));
    }
    else if ('load' === step.o) {
        // The match of a load of an entity with no id never carries an id binding.
        bound.delete('id');
    }
    const route = keyed ? flowLoadRoute(entity, step) : undefined;
    const points = plainPoints(entity, step.o);
    return firstRouteArgs(null == route ? points :
        [route.point, ...points.filter((point) => point !== route.point)], bound, false);
}
// The examples of the arguments a live step leaves unbound, which it always sends.
function liveStepExamples(entity, step, flow) {
    return unboundExamples(liveStepArgs(entity, step, flow) || []);
}
const SCALAR_FIELD = ['`$STRING`', '`$INTEGER`', '`$NUMBER`', '`$BOOLEAN`'];
// The scalar field of the record a route parameter reads: the entity id's
// mapping for it, else its namesake; a dotted mapping reads into an object.
function recordField(entity, name) {
    const field = entity?.id?.from?.[name] ?? name;
    if ('string' !== typeof field || field.includes('.'))
        return undefined;
    const def = Object.values(entity?.fields || {}).find((f) => f?.n === field);
    return SCALAR_FIELD.includes(def?.t) ? field : undefined;
}
// The route a flow's load of a known record takes: the first the runtime
// tries that takes the id and whose other path parameters the record holds
// or the step binds, read from the record first. Without an id it is the route
// the step binds, filled from the record offline only. Undefined keeps the match.
function flowLoadRoute(entity, step) {
    if ('load' !== step?.o)
        return undefined;
    const keyed = null != entity?.id;
    const bound = new Map((0, getMatchEntries_1.getMatchEntries)(step)
        .filter(([name, binding]) => 'string' === typeof binding && (keyed || 'id' !== name)));
    const order = [...bound.keys()];
    const rank = (arg) => order.includes(arg.name) ? order.indexOf(arg.name) : order.length;
    for (const point of plainPoints(entity, 'load').filter((point) => !isAction(point))) {
        const names = [...new Set((point.g?.params || []).map((arg) => arg.n))];
        if (keyed && !names.includes('id'))
            continue;
        const args = names.filter((name) => !keyed || 'id' !== name).map((name) => {
            const binding = bound.get(name);
            return {
                name, field: recordField(entity, name),
                idmap: null == binding || binding === name ? [name] : [name, binding],
            };
        });
        if (args.every((arg) => bound.has(arg.name) || (keyed && null != arg.field))) {
            return {
                route: routeOf(point), point, args: args.sort((a, b) => rank(a) - rank(b)), offline: !keyed,
            };
        }
    }
    return undefined;
}
function flowLoadReadsRecord(entity, step) {
    return (flowLoadRoute(entity, step)?.args || []).some((arg) => null != arg.field);
}
// The flow, each load of a known record naming its route and record fields.
function liveFlowRoutes(entity, flow) {
    if (!Array.isArray(flow?.step))
        return flow;
    const step = flow.step.map((step) => {
        const route = flowLoadRoute(entity, step);
        return null == route || route.offline ? step : {
            ...step, route: route.route,
            record: Object.fromEntries(route.args.filter((arg) => null != arg.field)
                .map((arg) => [arg.name, arg.field])),
        };
    });
    return { ...flow, step };
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
const hasRoute = (entity, opname) => (entity?.op?.[opname]?.points || []).some((point) => false !== point.a);
// What a live run leaves out: a step on an operation the entity has no route
// for, or no GET route reaches in a GET-only run, and what acts on its record.
function livePlan(entity, flow, getOnly) {
    const steps = liveFlowSteps(flow);
    const reasons = new Map();
    let writes = 0;
    for (const step of steps) {
        const route = writeRoute(entity, step.o);
        if (!hasRoute(entity, step.o))
            reasons.set(step, entity.name + ' has no ' + step.o + ' operation');
        else if (getOnly && null != route) {
            reasons.set(step, GETONLY + 'needs ' + route);
            writes++;
        }
    }
    const id = (step) => liveStepId(entity, step, steps.indexOf(step));
    const left = () => steps.filter((step) => !reasons.has(step));
    const after = (sources, why) => (sources.some((step) => reasons.get(step).startsWith(GETONLY)) ? GETONLY : '') + why;
    const create = steps.find((step) => 'create' === step.o && reasons.has(step));
    const sources = steps.filter((step) => ['create', 'list'].includes(step.o) && reasons.has(step));
    for (const step of null == create ? [] : left()) {
        if (['update', 'remove'].includes(step.o)) {
            reasons.set(step, after([create], 'acts on the record ' + id(create) + ' makes'));
        }
        else if (null != entity?.id && 'list' === step.o &&
            (step.v || []).some((v) => 'ItemNotExists' === v?.apply)) {
            reasons.set(step, after([create], 'checks a removal this run does not make'));
        }
    }
    if (null != entity?.id && 0 < sources.length && !left().some((step) => 'list' === step.o)) {
        for (const step of left().filter((step) => 'load' === step.o)) {
            reasons.set(step, after(sources, 'reads a record only ' + sources.map(id).join(', ') + ' gives'));
        }
    }
    return {
        writes,
        plan: {
            excluded: steps.filter((step) => reasons.has(step))
                .map((step) => ({ id: id(step), reason: reasons.get(step) })),
            flow: { ...flow, step: left() },
        },
    };
}
// A GET-only run's plan; undefined when it leaves out no more than any live run.
function liveGetOnly(entity, flow) {
    const { plan, writes } = livePlan(entity, flow, true);
    return 0 === writes ? undefined : plan;
}
// Any live run's plan, undefined when every step runs; one with none left skips.
function liveFlowPlan(entity, flow) {
    const { plan } = livePlan(entity, flow, false);
    return 0 < plan.excluded.length || 0 === (0, buildIdNames_1.flowSteps)(plan.flow).length ? plan : undefined;
}
// The plans a live flow test settles before its offline flow, GET-only first.
function liveGates(entity, flow) {
    return [liveGetOnly(entity, flow), liveFlowPlan(entity, flow)]
        .map((plan, index) => null == plan ? undefined :
        { getOnly: 0 === index, plan, runs: 0 < (0, buildIdNames_1.flowSteps)(plan.flow).length })
        .filter((gate) => null != gate);
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
const LIVE_NO_STEP = 'the flow has no step to run';
// Why a test with no step left to run skips, as the live harness says it.
function liveExcludedSummary(plan) {
    return 'Live coverage incomplete: ' + (0 === plan.excluded.length ? LIVE_NO_STEP :
        plan.excluded.map(({ id, reason }) => id + ' excluded (' + reason + ')').join('; '));
}
//# sourceMappingURL=testPolicy.js.map