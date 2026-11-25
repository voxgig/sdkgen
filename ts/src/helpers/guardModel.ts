/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */


import { guardModelNames } from './modelNames'
import { guardFlowSteps } from './flowGuard'


// The changes made to a model before any fact is computed over it. It is
// idempotent, so docgen may apply it to a model generate already prepared.
function guardModel(model: any, log?: any): any {
  guardModelNames(model, log)
  guardFlowSteps(model, log)
  return model
}


export {
  guardModel,
}
