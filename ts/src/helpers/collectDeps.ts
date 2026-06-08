// Collect target-language dependencies from features and from the target's
// own `deps` block, applying the active-flag semantics that every Package_*.ts
// template was hand-rolling identically:
//
//   - feature deps  : included when `dep.active === true`  (default off)
//   - target  deps  : included when `dep.active !== false` (default on)
//
// The two sources are kept distinct via the `source` field so callers can
// apply their own version defaults / formatting (e.g. go uses `v0.0.0`,
// python `0.0`). The original dep object is exposed as `raw` for callers that
// need extra fields like `dep.replace` (go module replace directives) or
// `dep.kind` (prod/dev/peer).

import { each } from 'jostraca'
import { KIT, getModelPath } from '@voxgig/apidef'

import type { SdkModel, ModelDep } from '../types'

type DepEntry = {
  name: string
  version: string
  source: 'feature' | 'target'
  raw: ModelDep
}

function collectDeps(
  model: SdkModel,
  targetName: string,
  targetDeps: Record<string, ModelDep> | undefined,
): DepEntry[] {
  const out: DepEntry[] = []
  const feature = getModelPath(model, `main.${KIT}.feature`)

  each(feature, (f: any) => {
    const langDeps = f?.deps?.[targetName]
    if (!langDeps) return
    each(langDeps, (dep: any) => {
      if (dep?.active) {
        out.push({
          name: dep.key$,
          version: dep.version,
          source: 'feature',
          raw: dep,
        })
      }
    })
  })

  if (targetDeps) {
    each(targetDeps, (dep: any) => {
      if (dep?.active !== false) {
        out.push({
          name: dep.key$,
          version: dep.version,
          source: 'target',
          raw: dep,
        })
      }
    })
  }

  return out
}


export type {
  DepEntry,
}

export {
  collectDeps,
}
