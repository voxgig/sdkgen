"use strict";
/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardFlowSteps = guardFlowSteps;
const apidef_1 = require("@voxgig/apidef");
const opShape_1 = require("./opShape");
// Ops whose generated call names the record it acts on.
const BY_ID = ['load', 'update', 'remove'];
// Ops after which the entity instance holds a record for later steps to read.
const STORES = ['create', 'load', 'update'];
// A generated flow test calls each step's op with the step's own match and
// data, the record's id where the op acts on one, and whatever the entity
// instance already holds. A step whose call can reach no route of its op is
// switched off, as the runtime would refuse it.
function guardFlowSteps(model, log) {
    const kit = model?.main?.[apidef_1.KIT];
    const flows = kit?.flow;
    const entities = kit?.entity;
    if (null == flows || 'object' !== typeof flows || null == entities) {
        return [];
    }
    const out = [];
    for (const name of Object.keys(flows).sort()) {
        const flow = flows[name];
        const ent = entities[flow?.entity];
        if (null == ent || null == flow?.step || 'object' !== typeof flow.step) {
            continue;
        }
        const fields = Object.values(ent.fields || {}).map((f) => f?.n).filter(Boolean);
        const held = [];
        let stored = false;
        Object.values(flow.step).forEach((step, index) => {
            if (null == step || false === step.a) {
                return;
            }
            // A create sends the test's new record, which has no id yet.
            const own = [...Object.keys(step.m || {}), ...Object.keys(step.d || {})];
            const given = [
                ...own,
                ...(BY_ID.includes(step.o) ? ['id'] : []),
                ...(stored ? [...fields, ...held] : []),
                ...('create' === step.o ? fields.filter((f) => 'id' !== f) : []),
            ];
            const op = ent.op?.[step.o];
            if (null != op && !(0, opShape_1.opReachable)(op, given)) {
                step.a = false;
                out.push({ flow: name, step: index, op: step.o });
                return;
            }
            held.push(...own);
            stored = stored || STORES.includes(step.o);
        });
    }
    if (0 < out.length && log?.warn) {
        log.warn({
            point: 'flow-step-unreachable',
            steps: out.map((s) => s.flow + '.' + s.step + ':' + s.op),
            note: 'flow step(s) ' + out.map((s) => s.flow + '#' + s.step + ' (' + s.op + ')').join(', ') +
                ' switched off: the call they make reaches no route of the operation. ' +
                'Every route needs an action, or a path parameter the step does not give.',
        });
    }
    return out;
}
//# sourceMappingURL=flowGuard.js.map