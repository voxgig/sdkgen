"use strict";
/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardModel = guardModel;
const modelNames_1 = require("./modelNames");
const flowGuard_1 = require("./flowGuard");
// The changes made to a model before any fact is computed over it. It is
// idempotent, so docgen may apply it to a model generate already prepared.
function guardModel(model, log) {
    (0, modelNames_1.guardModelNames)(model, log);
    (0, flowGuard_1.guardFlowSteps)(model, log);
    return model;
}
//# sourceMappingURL=guardModel.js.map