/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */

import type { ResolvedSpec } from '@voxgig/apidef'


// The resolved definition apidef published for this build, as a
// component sees it.
function resolvedFor(ctx$: any): ResolvedSpec | undefined {
  return ctx$?.meta?.apidef
}





function liveHint(point: any): any {
  return point?.li
}


function hasLiveScenarios(model: any): boolean {
  return Object.values(model?.main?.kit?.entity || {}).some((e: any) =>
    Object.values(e.op || {}).some((o: any) =>
      (o.points || []).some((p: any) => liveHint(p))))
}


function pointFacts(ctx$: any, point: any): any {
  return resolvedFor(ctx$)?.operation(point?.m, point?.o) || {}
}



export {
  resolvedFor,
  liveHint,
  pointFacts,
  hasLiveScenarios,
}
