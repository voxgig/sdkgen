/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */

import type { ResolvedSpec } from '@voxgig/apidef'


// The resolved definition apidef published for this build, as a
// component sees it.
function resolvedFor(ctx$: any): ResolvedSpec | undefined {
  return ctx$?.meta?.apidef
}





// A point's live-scenario hint. apidef sets `point.live` from the guide; a
// model built before it did carries the hint only inside the contract.
function liveHint(point: any): any {
  if (null == point) return undefined
  if (undefined !== point.live) return point.live
  if (null == point.contract?.json) return undefined
  try { return JSON.parse(point.contract.json).live } catch { return undefined }
}


function hasLiveScenarios(model: any): boolean {
  return Object.values(model?.main?.kit?.entity || {}).some((e: any) =>
    Object.values(e.op || {}).some((o: any) =>
      (o.points || []).some((p: any) => liveHint(p))))
}


// A point's resolved specification facts. Prefers the capability apidef
// publishes; falls back to the contract for a model built before it, or a
// generation not driven through a model build.
function pointFacts(ctx$: any, point: any): any {
  const resolved = resolvedFor(ctx$)
  const facts = resolved?.operation(point?.method, point?.orig)
  if (null != facts) return facts
  if (null == point?.contract?.json) return {}
  try { return JSON.parse(point.contract.json) } catch { return {} }
}


export {
  resolvedFor,
  liveHint,
  pointFacts,
  hasLiveScenarios,
}
