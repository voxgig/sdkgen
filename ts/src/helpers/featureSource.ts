
import Path from 'node:path'

import { KIT, getModelPath } from '@voxgig/apidef'

import { definitionNames } from './definition'

import { isJunk } from './junk'


type FeatureSource = {
  name: string

  path: string

  folder: boolean
}


type FeatureEntry = FeatureSource & {
  shaped: boolean
}


const FEATURE_DIR = 'feature'


// The always-present foundation every other feature builds on. It has no
// model file, so it is in no catalogue, and it must never be trimmed or
// reported as an unrecognised stray — every target ships one.
const BASE_FEATURE = 'base'


function featureOf(entry: string, folder: boolean): string {
  if (folder) {
    return entry.toLowerCase()
  }

  // Only the final extension goes; `feature.test.ts` style names keep the
  // rest so they cannot collide with a bare feature name.
  const stem = entry.replace(/\.[^.]+$/, '')

  return stem
    .replace(/_feature$/i, '')
    .replace(/Feature$/, '')
    .toLowerCase()
}


function availableFeatures(fs: any, sdkfolder: string): string[] {
  return definitionNames(fs, sdkfolder, 'feature')
    .map((n: string) => n.toLowerCase())
    .sort()
}


function featureShaped(entry: string, folder: boolean): boolean {
  if (folder) {
    return true
  }

  const stem = entry.replace(/\.[^.]+$/, '')

  return /_feature$/i.test(stem) || /Feature$/.test(stem)
}


function findFeatureEntries(
  fs: any, tmfolder: string, known: Set<string>,
): FeatureEntry[] {
  const found: FeatureEntry[] = []

  if (!fs.existsSync(tmfolder)) {
    return found
  }

  const walk = (rel: string) => {
    const abs = '' === rel ? tmfolder : Path.join(tmfolder, rel)
    const entries = fs.readdirSync(abs).sort()

    for (const entry of entries) {
      // A `__pycache__` inside `src/feature/` is not a feature — but every
      // rule here derives a feature NAME from an entry name, so without this
      // it becomes one: reported by `package check` as an unknown feature, and
      // trimmed (or not) as if it were source. See helpers/junk.
      if (isJunk(entry)) {
        continue
      }

      const entryrel = '' === rel ? entry : rel + '/' + entry
      const folder = fs.statSync(Path.join(tmfolder, entryrel)).isDirectory()

      // Inside a feature container every entry is a candidate, and a
      // candidate directory is the whole feature — do not descend into it
      // looking for more.
      if (FEATURE_DIR === Path.basename(rel)) {
        const name = featureOf(entry, folder)

        found.push({
          name, path: entryrel, folder, shaped: featureShaped(entry, folder),
        })

        if (known.has(name)) {
          continue
        }
      }

      if (folder) {
        walk(entryrel)
      }
    }
  }

  walk('')

  return found
}


function findFeatureSources(fs: any, tmfolder: string, available: string[]): FeatureSource[] {
  const known = new Set(available)

  return findFeatureEntries(fs, tmfolder, known)
    .filter((e: FeatureEntry) => known.has(e.name))
    .map(({ name, path, folder }: FeatureEntry) => ({ name, path, folder }))
}


function featureExcludes(sources: FeatureSource[]): RegExp[] {
  return sources.map((s) => new RegExp(
    '(^|/)' + s.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (s.folder ? '/' : '$')
  ))
}


function fullsetExcludes(paths: string[]): RegExp[] {
  return (paths || []).map((p) => new RegExp(
    '(^|/)' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'
  ))
}


function srcFeatureExcludes(model: any): RegExp[] {
  const all = getModelPath(model, `main.${KIT}.feature`,
    { required: false, only_active: false }) || {}
  const active = getModelPath(model, `main.${KIT}.feature`,
    { required: false }) || {}

  return Object.keys(all)
    .filter((name: string) => null == active[name])
    .map((name: string) => new RegExp(
      '(^|/)src/feature/' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/'
    ))
}


function pluginExcludesFor(model: any, fname: string): RegExp[] {
  if (null == model || null == fname) {
    return []
  }

  const plugins = getModelPath(model,
    `main.${KIT}.feature.${fname}.plugin`,
    { required: false, only_active: false }) || {}

  const out: RegExp[] = []
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  for (const pname of Object.keys(plugins).sort()) {
    const plugin = plugins[pname]
    if (false !== plugin?.active) continue

    const declared = plugin.path || []

    if (0 < declared.length) {
      for (const one of declared) {
        const rel = String(one).replace(
          new RegExp('^src/feature/' + esc(fname) + '/'), '')
        const pat = esc(rel)
        out.push(new RegExp('(^|/)' + pat.replace(/\\\/$/, '') +
          (/\/$/.test(rel) ? '/' : '$')))
      }
      continue
    }

    out.push(new RegExp('(^|/)plugin/' + esc(pname) + '/'))
  }

  return out
}


function pluginExcludes(model: any): RegExp[] {
  const active = getModelPath(model, `main.${KIT}.feature`,
    { required: false }) || {}

  const out: RegExp[] = []
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  for (const fname of Object.keys(active)) {
    const all = getModelPath(model,
      `main.${KIT}.feature.${fname}.plugin`,
      { required: false, only_active: false }) || {}
    const on = getModelPath(model,
      `main.${KIT}.feature.${fname}.plugin`,
      { required: false }) || {}

    for (const pname of Object.keys(all)) {
      if (null != on[pname]) continue

      // DECLARED paths first. A plugin's files are often not free to
      // move — sekreto's provider modules are vendored, and both the
      // vendoring guard and their own relative imports pin them at
      // upstream's directory depth — so a plugin says which paths it
      // owns rather than being assumed to own a directory.
      const declared = all[pname].path || []

      if (0 < declared.length) {
        for (const one of declared) {
          const pat = esc(String(one))
          // A trailing slash means a folder and everything under it;
          // anything else matches that path exactly, as featureExcludes
          // does for a file source.
          out.push(new RegExp('(^|/)' + pat.replace(/\\\/$/, '') +
            (/\/$/.test(String(one)) ? '/' : '$')))
        }
        continue
      }

      out.push(new RegExp(
        '(^|/)src/feature/' + esc(fname) + '/plugin/' + esc(pname) + '/'))
    }
  }

  return out
}


export type {
  FeatureSource,
  FeatureEntry,
}

export {
  BASE_FEATURE,
  featureOf,
  featureShaped,
  availableFeatures,
  findFeatureEntries,
  findFeatureSources,
  featureExcludes,
  fullsetExcludes,
  srcFeatureExcludes,
  pluginExcludes,
  pluginExcludesFor,
}
