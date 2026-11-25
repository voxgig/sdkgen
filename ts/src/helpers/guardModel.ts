/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */


import { KIT } from '@voxgig/apidef'

import { guardModelNames } from './modelNames'
import { guardFlowSteps } from './flowGuard'


// The changes made to a model before any fact is computed over it. It is
// idempotent, so docgen may apply it to a model generate already prepared.
function guardModel(model: any, log?: any): any {
  guardModelNames(model, log)
  const dropped = dropInactiveOps(model)
  guardFlowSteps(model, log, dropped)
  return model
}


// An inactive operation is an absent one: every reader then agrees on it. An
// active one keeps no flag, so the model reads as it did before the slot.
function dropInactiveOps(model: any): Set<string> {
  const dropped = new Set<string>()
  const entity = model?.main?.[KIT]?.entity
  if (null == entity || 'object' !== typeof entity) {
    return dropped
  }

  for (const [name, ent] of Object.entries(entity) as [string, any][]) {
    const op = ent?.op
    if (null == op || 'object' !== typeof op) {
      continue
    }
    for (const opname of Object.keys(op)) {
      if (false === op[opname]?.active) {
        delete op[opname]
        dropped.add(name + '.' + opname)
      }
      else if (null != op[opname] && 'object' === typeof op[opname]) {
        delete op[opname].active
      }
    }
  }
  return dropped
}


export {
  guardModel,
}
