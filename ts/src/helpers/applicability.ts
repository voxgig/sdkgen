
import Fs from 'node:fs'

import { Aontu } from 'aontu'
import { KIT, getModelPath } from '@voxgig/apidef'

import { definitionPathAny, migrateIncludes } from './definition'
import { scaffoldFolder } from './shipped'


function tags(val: any): string[] {
  if (Array.isArray(val)) {
    return val.filter((t: any) => 'string' === typeof t)
  }

  if (null == val || 'object' !== typeof val) {
    return []
  }

  return Object.keys(val).filter((name: string) => true === val[name])
}


// Does this feature apply to this target?
function featureApplies(feature: any, target: any): boolean {
  const needs = tags(feature && feature.needs)

  if (0 === needs.length) {
    return true
  }

  const provides = tags(target && target.provides)

  return needs.every((need: string) => provides.includes(need))
}


function targetFeatures(model: any, target: any): Record<string, any> {
  const feature = getModelPath(model, `main.${KIT}.feature`, { required: false }) || {}

  const t = 'string' === typeof target ?
    (getModelPath(model, `main.${KIT}.target`, { required: false }) || {})[target] :
    target

  // A name that names no target gates nothing: a caller that cannot say
  // which target it is generating for must not silently lose features.
  if (null == t) {
    return feature
  }

  const applies: Record<string, any> = {}
  for (const [name, f] of Object.entries(feature as Record<string, any>)) {
    if (featureApplies(f, t)) {
      applies[name] = f
    }
  }

  return applies
}


const shipped = new Map<string, string[]>()

// The tags this package's own copy of a target provides; a project's older
// copy of the same target may lack them.
function shippedProvides(origin: string): string[] {
  if (!shipped.has(origin)) {
    const path = definitionPathAny(Fs, scaffoldFolder(), 'target', origin)
    let provides: string[] = []
    if (Fs.existsSync(path)) {
      const errs: any[] = []
      const model = new Aontu().generate(migrateIncludes(Fs.readFileSync(path, 'utf8')), { path, errs })
      if (0 === errs.length) {
        provides = tags(model?.main?.[KIT]?.target?.[origin]?.provides)
      }
    }
    shipped.set(origin, provides)
  }
  return shipped.get(origin) as string[]
}


const TAGS = [
  // A vendored sekreto port lives in this target's feature container.
  'sekreto',

  'schema',
]


// The tags named by `needs`/`provides` that are not in the vocabulary.
function unknownTags(val: any): string[] {
  return tags(val).filter((t: string) => !TAGS.includes(t))
}


export {
  featureApplies,
  shippedProvides,
  targetFeatures,
  tags as featureTags,
  unknownTags,
  TAGS,
}
