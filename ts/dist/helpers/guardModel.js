"use strict";
/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardModel = guardModel;
const apidef_1 = require("@voxgig/apidef");
const modelNames_1 = require("./modelNames");
const flowGuard_1 = require("./flowGuard");
// The changes made to a model before any fact is computed over it. It is
// idempotent, so docgen may apply it to a model generate already prepared.
function guardModel(model, log) {
    (0, modelNames_1.guardModelNames)(model, log);
    const dropped = dropInactiveOps(model);
    (0, flowGuard_1.guardFlowSteps)(model, log, dropped);
    return model;
}
// An inactive operation is an absent one: every reader then agrees on it. An
// active one keeps no flag, so the model reads as it did before the slot.
function dropInactiveOps(model) {
    const dropped = new Set();
    const entity = model?.main?.[apidef_1.KIT]?.entity;
    if (null == entity || 'object' !== typeof entity) {
        return dropped;
    }
    for (const [name, ent] of Object.entries(entity)) {
        const op = ent?.op;
        if (null == op || 'object' !== typeof op) {
            continue;
        }
        for (const opname of Object.keys(op)) {
            if (false === op[opname]?.active) {
                delete op[opname];
                dropped.add(name + '.' + opname);
            }
            else if (null != op[opname] && 'object' === typeof op[opname]) {
                delete op[opname].active;
            }
        }
    }
    return dropped;
}
//# sourceMappingURL=guardModel.js.map