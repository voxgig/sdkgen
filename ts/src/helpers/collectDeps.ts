
import { targetFeatures } from './applicability'

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
  // Gated: a feature that does not apply to this target must not flow a
  // dependency into its generated manifest.
  const feature = targetFeatures(model, targetName)

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
    if (langDeps) {
      each(langDeps, (dep: any) => {
        if (dep?.active) {
          add(dep, 'feature', f.name)
        }
      })
    }

    // An inactive plugin's deps are not this SDK's deps. `true ===` rather
    // than truthiness, matching the trim: the trim drops a plugin unless it
    // is explicitly on, and the manifest must agree with the tree it
    // describes or the build asks for a crate whose files were removed.
    each(f?.plugin, (plugin: any) => {
      if (true !== plugin?.active) return
      const pluginDeps = plugin?.deps?.[targetName]
      if (!pluginDeps) return
      each(pluginDeps, (dep: any) => {
        if (dep?.active) {
          add(dep, 'feature', f.name + '.' + plugin.name)
        }
      })
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
