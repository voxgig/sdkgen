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
  log?: any,
): DepEntry[] {
  const out: DepEntry[] = []
  const feature = getModelPath(model, `main.${KIT}.feature`)

  // Deduplicate by package name. Two features can require the same package
  // (or a feature and the target itself can), and every Package_<lang>.ts
  // renders one manifest line per entry — a duplicate key is a hard parse
  // error in go.mod and Cargo.toml, and silently last-wins in package.json.
  // FIRST occurrence wins, so the deterministic (sorted-key) feature order
  // decides; a conflicting version is reported rather than silently dropped.
  const seen: Record<string, DepEntry> = {}

  const add = (dep: any, source: 'feature' | 'target', owner: string) => {
    const name = dep.key$
    if (null == name) return

    const prev = seen[name]
    if (null != prev) {
      if (log?.warn && prev.version !== dep.version) {
        log.warn({
          point: 'dep-version-conflict', target: targetName, dep: name,
          kept: prev.version, dropped: dep.version, from: owner,
          note: `${targetName}: dependency ${name} declared twice with ` +
            `different versions — keeping ${prev.version} (${prev.source}), ` +
            `ignoring ${dep.version} (${source} ${owner})`,
        })
      }
      return
    }

    const entry: DepEntry = {
      name,
      version: dep.version,
      source,
      raw: dep,
    }
    seen[name] = entry
    out.push(entry)
  }

  each(feature, (f: any) => {
    const langDeps = f?.deps?.[targetName]
    if (!langDeps) return
    each(langDeps, (dep: any) => {
      if (dep?.active) {
        add(dep, 'feature', f.name)
      }
    })
  })

  if (targetDeps) {
    each(targetDeps, (dep: any) => {
      if (dep?.active !== false) {
        add(dep, 'target', targetName)
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
