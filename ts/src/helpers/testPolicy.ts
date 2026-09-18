import { KIT } from '../types'

function liveStrict(model: any, target?: string): boolean {
  const perTarget = null == target ? undefined :
    model?.main?.[KIT]?.target?.[target]?.test?.live?.strict
  const configured = perTarget ?? model?.main?.[KIT]?.test?.live?.strict
  return false !== configured
}

export { liveStrict }
