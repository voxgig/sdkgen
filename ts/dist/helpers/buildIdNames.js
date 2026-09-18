"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildIdNames = buildIdNames;
const COUNT = 3; // 3 ids per name: <name>01, <name>02, <name>03
function buildIdNames(entity, flow) {
    const idnames = [];
    const seen = new Set();
    const push = (n) => {
        if (!seen.has(n)) {
            seen.add(n);
            idnames.push(n);
        }
    };
    for (let i = 1; i <= COUNT; i++)
        push(`${entity.name}0${i}`);
    const ancestors = (entity.relations?.ancestors || []).flat();
    for (const anc of ancestors) {
        for (let i = 1; i <= COUNT; i++)
            push(`${anc}0${i}`);
    }
    const steps = Array.isArray(flow?.step)
        ? flow.step
        : Object.values(flow?.step || {});
    for (const step of steps) {
        if (step?.match) {
            for (const v of Object.values(step.match)) {
                if (typeof v === 'string' && v && !v.endsWith('$'))
                    push(v);
            }
        }
        // step.data values can also be aliased via setup (e.g. update step.data
        // = {data_type_id: 'data_type01'} → setup adds idmap[data_type_id] =
        // idmap[data_type01]). The right-hand side `data_type01` must be in the
        // idmap or the alias resolves to undefined.
        if (step?.data) {
            for (const v of Object.values(step.data)) {
                if (typeof v === 'string' && v && !v.endsWith('$'))
                    push(v);
            }
        }
    }
    return idnames;
}
//# sourceMappingURL=buildIdNames.js.map