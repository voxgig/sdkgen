import { KIT } from '@voxgig/apidef'

import { fact } from './facts'
import { surfaceOf } from './surface'
import { SdkGenError } from '../utility'


// What every SDK target's generated suite and test mode need.
const REQUIRED_FEATURE = 'test'


type BrokenTarget = {
  target: string
  problem: 'untested' | 'entityless'
  note: string
}


function activeTargets(model: any): [string, any][] {
  const kit = model.main[KIT]
  return (fact(kit, 'active') as string[]).map((name: string) => [name, kit.target[name]])
}


// An SDK, by its declared surface or by running an SDK's other phases,
// whose entity phase is off. A target that switches every phase off is a
// consumer, and one with a surface other than `sdk` says what it is.
function entityless(target: any): boolean {
  const phase = fact(target, 'phase')
  if (false !== phase.entity) {
    return false
  }
  const surface = fact(target, 'surface')
  return 'sdk' === surface ||
    ('' === surface && (phase.feature || phase.readme || phase.agentguide || phase.test))
}


function untestedTargets(model: any): BrokenTarget[] {
  if (true === model.main[KIT].feature?.[REQUIRED_FEATURE]?.active) {
    return []
  }
  return activeTargets(model)
    .filter(([, target]: [string, any]) => 'sdk' === surfaceOf(target))
    .map(([name]: [string, any]) => ({
      target: name, problem: 'untested',
      note: 'Target "' + name + '" is an SDK, and the model has no active `' +
        REQUIRED_FEATURE + '` feature, which its generated tests and test mode need. ' +
        'Run `voxgig-sdkgen target add ' + name + '`, which installs it.',
    }))
}


function entitylessTargets(model: any): BrokenTarget[] {
  return activeTargets(model)
    .filter(([, target]: [string, any]) => entityless(target))
    .map(([name]: [string, any]) => ({
      target: name, problem: 'entityless',
      note: entitylessNote(name),
    }))
}


function entitylessNote(name: string): string {
  return 'Target "' + name + '" is an SDK with its entity phase off: its main ' +
    'module and documents name the entity classes that phase writes, so the SDK ' +
    'does not build. Remove `phase: entity: active: false` from its model or, ' +
    'for a target that is not an SDK, declare its `surface`.'
}


function refuseBrokenTargets(model: any): void {
  const broken = [...untestedTargets(model), ...entitylessTargets(model)]
  if (0 < broken.length) {
    throw new SdkGenError(broken.map((b: BrokenTarget) => b.note).join('\n'))
  }
}


export type {
  BrokenTarget,
}

export {
  REQUIRED_FEATURE,
  entityless,
  untestedTargets,
  entitylessTargets,
  entitylessNote,
  refuseBrokenTargets,
}
