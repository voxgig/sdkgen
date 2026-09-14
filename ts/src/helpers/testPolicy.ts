import { KIT } from '../types'

// Live requests assert success by default. This never enables fail-fast:
// independent tests continue and their framework aggregates the failures.
// An explicit false preserves the legacy exploratory policy for callers
// migrating a fleet; it must not be confused with full live verification.
function liveStrict(model: any, target?: string): boolean {
  const perTarget = null == target ? undefined :
    model?.main?.[KIT]?.target?.[target]?.test?.live?.strict
  const configured = perTarget ?? model?.main?.[KIT]?.test?.live?.strict
  return false !== configured
}

export { liveStrict }
