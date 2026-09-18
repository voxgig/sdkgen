
import type {
  ActionContext,
  ActionResult,
} from '../types'

import { KINDS } from './kind'

import { action_target, target_add } from './target'
import { action_feature, feature_add } from './feature'
import { action_edition, edition_add } from './edition'
import { action_doctor } from './doctor'
import { action_package, registerAdder } from './package'


type ActionFunc =
  (args: string[], actx: ActionContext) => Promise<ActionResult>


// The per-kind entry points, by kind name. A kind in the registry with no
// entry here is one nothing can install yet — reported when something asks
// for it, never silently ignored.
const KIND_ACTIONS: Record<string, ActionFunc> = Object.assign(
  Object.create(null), {
  target: action_target,
  feature: action_feature,
  edition: action_edition,
})


// The same functions, as the direct `(refs, actx)` calls `package add` loops
// over. Registered rather than imported by `package.ts`, for the cycle above.
registerAdder('target', target_add)
registerAdder('feature', feature_add)
registerAdder('edition', edition_add)


function actionMap(): Record<string, ActionFunc> {
  const map: Record<string, ActionFunc> = Object.create(null)

  for (const kind of Object.keys(KINDS)) {
    if (null != KIND_ACTIONS[kind]) {
      map[kind] = KIND_ACTIONS[kind]
    }
  }

  map.package = action_package
  map.doctor = action_doctor

  return map
}


const ACTION_MAP = actionMap()


// The verbs, for help text and for an unknown-action message that says what
// IS available rather than only what is not.
function actionNames(): string[] {
  return Object.keys(ACTION_MAP).sort()
}


function needsModel(args: string[]): boolean {
  return !('package' === args[0] && 'check' === args[1])
}


export type {
  ActionFunc,
}

export {
  ACTION_MAP,
  actionMap,
  actionNames,
  needsModel,
}
