"use strict";
// Per-op request-payload shape + partiality policy for the typed-model
// generators (EntityTypes_<lang>.ts).
//
// SINGLE SOURCE OF TRUTH for two things every language generator needs:
//   1. The type-name scheme: <Name>{Load,List,Remove}Match /
//      <Name>{Create,Update}Data (OP_SUFFIX + opTypeName).
//   2. Which fields make up an op's request payload, and whether each is
//      required or optional (opRequestShape) — i.e. the partiality policy.
//
// PARTIALITY POLICY
//   Op-declared params win: if the op declares params
//   (op.<name>.points[].args.params[]), the payload is built from them and a
//   param is optional iff `reqd === false` (this is how path/query params such
//   as {id} become required). `fromParams` is true in that case.
//
//   Otherwise the payload mirrors the entity's fields, filtered to those active
//   for the op (field.op[opname].active !== false; absent -> participates), and
//   optionality is decided per-op:
//     create -> required iff `field.req` (server-shaped required fields);
//     update -> all optional (patch);
//     load / remove -> a field named `id` is required, the rest optional
//       (best-effort key convention; degrades to all-optional if no `id`);
//     list -> all optional (filter).
//
// The generators consume `items` (each already carrying its final `optional`
// flag) and render them in the target language's struct/interface/TypedDict
// syntax; the policy itself is language-neutral and tested in isolation.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OP_SUFFIX = void 0;
exports.opTypeName = opTypeName;
exports.opParams = opParams;
exports.opRequestShape = opRequestShape;
const jostraca_1 = require("jostraca");
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
// The generated type name for an op's request payload, e.g. AdviceLoadMatch.
function opTypeName(Name, opname) {
    return Name + cap(opname) + (OP_SUFFIX[opname] || 'Match');
}
// Collect an op's params, deduped by name across all of its points.
function opParams(op) {
    const points = op && op.points ? (0, jostraca_1.each)(op.points) : [];
    const seen = {};
    const out = [];
    points.forEach((pt) => {
        const params = pt && pt.args && pt.args.params ? (0, jostraca_1.each)(pt.args.params) : [];
        params.forEach((p) => {
            if (p && null != p.name && !seen[p.name]) {
                seen[p.name] = true;
                out.push(p);
            }
        });
    });
    return out;
}
// Does a field participate in an op? Absent op-entry -> participates; only an
// explicit `active: false` excludes it.
function fieldInOp(field, opname) {
    const fop = field && field.op && field.op[opname];
    return null == fop || fop.active !== false;
}
// Decide optionality for a field in a no-params request payload, per op.
function fieldOptional(field, opname) {
    switch (opname) {
        case 'create':
            // Respect the model's required flag: required unless req === false.
            return false === field.req;
        case 'update':
            // Patch semantics — every field optional.
            return true;
        case 'load':
        case 'remove':
            // Best-effort key convention: the `id` field is required, rest optional.
            return 'id' !== field.name;
        case 'list':
        default:
            // Filter — every field optional.
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
    const params = opParams(op);
    if (0 < params.length) {
        const items = params.map((p) => ({
            name: p.name,
            type: p.type,
            optional: false === p.reqd,
        }));
        return { items, fromParams: true };
    }
    const fields = (ent.fields ? (0, jostraca_1.each)(ent.fields) : [])
        .filter((f) => f.active !== false)
        .filter((f) => fieldInOp(f, opname));
    const items = fields.map((f) => ({
        name: f.name,
        type: f.type,
        optional: fieldOptional(f, opname),
    }));
    return { items, fromParams: false };
}
//# sourceMappingURL=opShape.js.map