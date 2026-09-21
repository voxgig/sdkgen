"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OP_SUFFIX = void 0;
exports.deriveEntityNames = deriveEntityNames;
exports.entityCollection = entityCollection;
exports.opTypeName = opTypeName;
exports.opParams = opParams;
exports.ownPoint = ownPoint;
exports.opActions = opActions;
exports.entityActions = entityActions;
exports.entityPath = entityPath;
exports.opRequestShape = opRequestShape;
exports.entityIdField = entityIdField;
exports.entityDataIdField = entityDataIdField;
exports.entityOps = entityOps;
exports.entityPrimaryOp = entityPrimaryOp;
exports.pickExampleEntity = pickExampleEntity;
exports.entityClassName = entityClassName;
exports.entityTypeCollisions = entityTypeCollisions;
exports.warnEntityTypeCollisions = warnEntityTypeCollisions;
const jostraca_1 = require("jostraca");
const apidef_1 = require("@voxgig/apidef");
const pointPath_1 = require("./pointPath");
const _entityCollCache = new WeakMap();
function entityCollection(model) {
    if (null == model || 'object' !== typeof model) {
        return {};
    }
    const cached = _entityCollCache.get(model);
    if (null != cached) {
        return cached;
    }
    const coll = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.entity`, { only_active: false, required: false }) || {};
    deriveEntityNames(coll);
    _entityCollCache.set(model, coll);
    return coll;
}
function deriveEntityNames(entityColl) {
    const ents = (0, jostraca_1.each)(entityColl).filter((e) => e && null != e.name);
    ents.forEach((e) => { if (null == e.Name)
        (0, jostraca_1.names)(e, e.name); });
    return ents;
}
// The five ops, and whether their request payload is a `Match` (query/id) or
// `Data` (body) — this fixes the generated type-name suffix per op.
const OP_SUFFIX = {
    load: 'Match',
    list: 'Match',
    remove: 'Match',
    create: 'Data',
    update: 'Data',
};
exports.OP_SUFFIX = OP_SUFFIX;
function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
function opTypeName(Name, opname) {
    return Name + cap(opname) + (OP_SUFFIX[opname] || 'Match');
}
function opActions(op) {
    const points = op && op.points ? (0, jostraca_1.each)(op.points) : [];
    return points
        .filter((pt) => null != (pt && pt.q && pt.q['$action']))
        .map((pt) => ({
        action: String(pt.q['$action']),
        path: String(pt.o || ''),
    }))
        .sort((a, b) => a.action < b.action ? -1 : a.action > b.action ? 1 : 0);
}
function entityActions(entity) {
    const out = [];
    (0, jostraca_1.each)(entity && entity.op).forEach((op) => {
        opActions(op).forEach((a) => out.push({ op: op.name, ...a }));
    });
    return out;
}
function entityPath(entity) {
    const ops = (entity && entity.op) || {};
    for (const opname of ['list', 'load', 'create', 'update', 'remove']) {
        const op = ops[opname];
        if (null == op) {
            continue;
        }
        const points = op.points ? (0, jostraca_1.each)(op.points) : [];
        const canonical = points.filter((pt) => null == (pt && pt.q && pt.q['$action']));
        const pick = (0 < canonical.length ? canonical : points)[0];
        if (null != pick && null != pick.o && '' !== pick.o) {
            return String(pick.o);
        }
    }
    return '';
}
function ownPoint(points) {
    let best = points[0];
    for (const pt of points) {
        if (null == pt || null == pt.s || null == best || null == best.s) {
            continue;
        }
        const ptterm = (0, pointPath_1.pointTerminalParam)(pt);
        const bestterm = (0, pointPath_1.pointTerminalParam)(best);
        if (ptterm !== bestterm ?
            ptterm : (0, pointPath_1.pointSegments)(pt).length < (0, pointPath_1.pointSegments)(best).length) {
            best = pt;
        }
    }
    return best;
}
// Do all these points describe the same route? Then they are alternative
// selectors on one endpoint (the same path, chosen by different query
// params), not cross-references to different resources.
function samePath(points) {
    const first = (0, pointPath_1.pointPathKey)(points[0]);
    return points.every((pt) => first === (0, pointPath_1.pointPathKey)(pt));
}
function opParams(op) {
    let points = op && op.points ? (0, jostraca_1.each)(op.points) : [];
    const canonical = points.filter((pt) => null == (pt && pt.q && pt.q['$action']));
    if (0 < canonical.length) {
        points = canonical;
    }
    const seen = {};
    const requiredOnAll = {};
    const out = [];
    points.forEach((pt, pointIndex) => {
        // Path AND query: a path-param-only read misses e.g. GET /result?trace_id=,
        // which has no path param at all but still addresses one record.
        const pathParams = pt && pt.g && pt.g.params ? (0, jostraca_1.each)(pt.g.params) : [];
        const queryParams = pt && pt.g && pt.g.query ? (0, jostraca_1.each)(pt.g.query) : [];
        const params = [...pathParams, ...queryParams];
        const requiredHere = {};
        params.forEach((p) => {
            if (p && null != p.n) {
                requiredHere[p.n] = false !== p.r;
                if (!seen[p.n]) {
                    seen[p.n] = { ...p };
                    requiredOnAll[p.n] = 0 === pointIndex;
                    out.push(seen[p.n]);
                }
            }
        });
        Object.keys(requiredOnAll).forEach((name) => {
            if (true !== requiredHere[name]) {
                requiredOnAll[name] = false;
            }
        });
    });
    out.forEach((p) => {
        p.r = true === requiredOnAll[p.n];
    });
    if (1 < points.length && !out.some((p) => p.r) && !samePath(points)) {
        return opParams({ points: [ownPoint(points)] });
    }
    return out;
}
function fieldInOp(field, opname) {
    const fop = field && field.op && field.op[opname];
    return null == fop || fop.active !== false;
}
function fieldOptional(field, opname) {
    switch (opname) {
        case 'create':
            return false === field.r;
        case 'update':
            return true;
        case 'load':
        case 'remove':
            return 'id' !== field.n;
        case 'list':
        default:
            return true;
    }
}
// The ordered request-payload members for an entity op, with each member's
// required/optional decision baked in. `fromParams` records whether the op's
// declared params were used (true) or the entity-field fallback (false).
function opRequestShape(ent, opname) {
    const op = ent && ent.op ? ent.op[opname] : null;
    if (null == op) {
        return { items: [], fromParams: false };
    }
    const isbodyop = 'create' === opname || 'update' === opname || 'patch' === opname;
    const params = opParams(op);
    if (0 < params.length && !isbodyop) {
        const items = params.map((p) => ({
            name: p.n,
            type: p.t,
            optional: false === p.r,
        }));
        return { items, fromParams: true };
    }
    const paramItems = isbodyop ? params.map((p) => ({
        name: p.n,
        type: p.t,
        optional: false === p.r,
    })) : [];
    const paramNames = new Set(paramItems.map((p) => p.name));
    const fields = (ent.fields ? (0, jostraca_1.each)(ent.fields) : [])
        .filter((f) => f.a !== false)
        .filter((f) => fieldInOp(f, opname));
    const items = paramItems.concat(fields
        .filter((f) => !paramNames.has(f.n))
        .map((f) => ({
        name: f.n,
        type: f.t,
        optional: fieldOptional(f, opname),
    })));
    return { items, fromParams: false };
}
function entityIdField(ent) {
    if (null == ent) {
        return null;
    }
    const idName = (ent.id && ent.id.field) || 'id';
    const loadItems = opRequestShape(ent, 'load').items;
    if (loadItems.some((it) => it.name === idName)) {
        return idName;
    }
    if (loadItems.some((it) => it.name === 'id')) {
        return 'id';
    }
    // NO fallback to entity.fields: this is the load-MATCH key. An entity whose
    // DATA type has an `id` field but whose load match does NOT (a query-param
    // load, e.g. playstation-store's StoreLoadMatch { age, country, ... }) must
    // degrade to a no-arg load(); `.id` access is decided by entityDataIdField.
    return null;
}
// The entity's ACTIVE op names, in canonical CRUD order (list, load, create,
// update, remove), with any non-canonical ops appended in sorted order. Doc
// generators must gate an op example on this (an op present in the model but
// `active: false` generates no method, so an example calling it would not
// compile) — NOT on the raw `Object.keys(ent.op)`, which includes inactive ops.
const CANON_OP_ORDER = ['list', 'load', 'create', 'update', 'remove'];
function entityOps(ent) {
    const ops = (ent && ent.op) || {};
    const active = Object.keys(ops).filter((o) => ops[o] && ops[o].active !== false);
    return CANON_OP_ORDER.filter((o) => active.includes(o))
        .concat(active.filter((o) => !CANON_OP_ORDER.includes(o)).sort());
}
// The entity's primary/representative op for a single illustrative call —
// prefer a read op (list, then load) so the snippet needs no fabricated match,
// then fall back to create/update/remove. null when the entity exposes no op.
// Doc generators MUST pick their "primary" op through this rather than
// hardcoding `load`: a create-only entity has no `load` method.
function entityPrimaryOp(ent) {
    const ops = entityOps(ent);
    for (const o of CANON_OP_ORDER) {
        if (ops.includes(o)) {
            return o;
        }
    }
    return ops[0] || null;
}
const _classNameCache = new WeakMap();
function entityClassNames(entityColl) {
    const cached = _classNameCache.get(entityColl);
    if (null != cached) {
        return cached;
    }
    const ents = deriveEntityNames(entityColl);
    const taken = {};
    ents.forEach((e) => {
        taken[e.Name] = true;
        for (const op of ['load', 'list', 'create', 'update', 'remove']) {
            if (e.op && e.op[op]) {
                taken[opTypeName(e.Name, op)] = true;
            }
        }
    });
    // 2. Assign each class name, avoiding all data types and prior classes.
    const out = {};
    ents.forEach((e) => {
        let name = e.Name + 'Entity';
        if (taken[name]) {
            const base = name + 'Client';
            name = base;
            let n = 1;
            while (taken[name]) {
                n++;
                name = base + n;
            }
        }
        taken[name] = true;
        out[e.name] = name;
    });
    _classNameCache.set(entityColl, out);
    return out;
}
// The collision-free class name for one entity (see entityClassNames).
// `entityColl` is main.<KIT>.entity (the collection the entity belongs to).
function entityClassName(ent, entityColl) {
    if (null == ent) {
        return '';
    }
    const map = entityClassNames(entityColl);
    return map[ent.name] || (ent.Name + 'Entity');
}
const _typeCollisionCache = new WeakMap();
function entityTypeCollisions(entityColl) {
    const cached = _typeCollisionCache.get(entityColl);
    if (null != cached) {
        return cached;
    }
    const counts = {};
    const bump = (n) => { counts[n] = (counts[n] || 0) + 1; };
    deriveEntityNames(entityColl)
        .forEach((e) => {
        bump(e.Name);
        for (const op of ['load', 'list', 'create', 'update', 'remove']) {
            if (e.op && e.op[op]) {
                bump(opTypeName(e.Name, op));
            }
        }
    });
    const out = Object.keys(counts).filter((n) => 1 < counts[n]).sort();
    _typeCollisionCache.set(entityColl, out);
    return out;
}
// Emitter convenience: warn (once per collection per target run) when the
// generated typed model would contain duplicate top-level type names.
function warnEntityTypeCollisions(entityColl, log, lang) {
    const dups = entityTypeCollisions(entityColl);
    if (0 < dups.length && log && log.warn) {
        log.warn({
            point: 'entity-types-name-collision', lang, names: dups,
            note: `${lang}: duplicate generated type name(s) ${dups.join(', ')} — ` +
                `two entities produce the same PascalCase type name; rename one ` +
                `entity (or alias it) in the model or the generated typed model ` +
                `will not compile in statically-typed targets`,
        });
    }
    return dups;
}
function pickExampleEntity(entity) {
    const actives = (0, jostraca_1.each)(entity).filter((e) => e && e.active !== false);
    const readable = actives.filter((e) => {
        const op = entityPrimaryOp(e);
        return 'list' === op || 'load' === op;
    });
    const withOp = actives.filter((e) => null != entityPrimaryOp(e));
    // Prefer a readable entity, then any entity with an op, then anything at all.
    // WITHIN the chosen tier pick an entity of MEDIAN "size" — median name length
    // and median field count — so the generated README/examples showcase a
    // representative entity, not the alphabetically-first one (often a degenerate
    // stub with a terse name and no fields) nor an atypically sprawling one.
    const pool = readable.length ? readable : (withOp.length ? withOp : actives);
    const chosen = pickMedianEntity(pool);
    return { entity: chosen, primaryOp: null == chosen ? null : entityPrimaryOp(chosen) };
}
// The pool entity closest to the median on both axes (name length, field
// count). Distance on each axis is normalised by that axis's own median so the
// two are comparable, then summed. Ties keep the pool's existing key-sorted
// order (each() is byte-stable), so the pick is deterministic.
function pickMedianEntity(pool) {
    if (0 === pool.length)
        return null;
    if (1 === pool.length)
        return pool[0];
    const fieldCount = (e) => (e && e.fields ? (0, jostraca_1.each)(e.fields).length : 0);
    const nameLen = (e) => (e && e.name ? String(e.name).length : 0);
    const medName = medianOf(pool.map(nameLen));
    const medField = medianOf(pool.map(fieldCount));
    let best = pool[0];
    let bestScore = Infinity;
    for (const e of pool) {
        const score = Math.abs(nameLen(e) - medName) / (medName || 1) +
            Math.abs(fieldCount(e) - medField) / (medField || 1);
        if (score < bestScore) {
            bestScore = score;
            best = e;
        }
    }
    return best;
}
function medianOf(xs) {
    const s = xs.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return 0 === s.length ? 0 : (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}
// The id field on the entity's DATA type (its fields{}), or null. DISTINCT from
// entityIdField (the load-MATCH key): an API can model a load match that carries
// an `id` param while the response entity itself has no `id` field, so `.id`
// access on a RETURNED record must be guarded on this, not on the match key.
function entityDataIdField(ent) {
    if (null == ent) {
        return null;
    }
    const idName = (ent.id && ent.id.field) || 'id';
    const fields = ent.fields ? (0, jostraca_1.each)(ent.fields) : [];
    if (fields.some((f) => f && f.n === idName)) {
        return idName;
    }
    if (fields.some((f) => f && f.n === 'id')) {
        return 'id';
    }
    return null;
}
//# sourceMappingURL=opShape.js.map