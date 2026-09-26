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


// What the live runner reads; see tm/<lang>/test/live-contract requestContract.
const LIVE_FACT_KEYS = ['protocol', 'requestBody', 'parameters']


// A resolved operation is a shared GRAPH; JSON.stringify writes a TREE, so a
// schema reached from many places is written once per path. Identity on the
// current path bounds that; maxDepth bounds breadth it cannot catch.
function boundedFacts(facts: any, maxDepth = 8): any {
  const path = new Set<any>()

  const bound = (node: any, depth: number): any => {
    if (null == node || 'object' !== typeof node) return node
    if (path.has(node)) return Array.isArray(node) ? [] : {}
    if (depth > maxDepth) return Array.isArray(node) ? [] : {}

    path.add(node)
    const out: any = Array.isArray(node) ? node.map((v) => bound(v, depth + 1))
      : Object.fromEntries(Object.entries(node).map(([k, v]) => [k, bound(v, depth + 1)]))
    path.delete(node)
    return out
  }

  const kept: any = {}
  for (const key of LIVE_FACT_KEYS) {
    if (undefined !== facts?.[key]) kept[key] = bound(facts[key], 0)
  }
  return kept
}



export {
  resolvedFor,
  liveHint,
  pointFacts,
  boundedFacts,
  hasLiveScenarios,
}
