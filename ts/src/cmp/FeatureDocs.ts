import { each } from 'jostraca'

import { KIT, getModelPath } from '../types'


// Shared feature facts, derived from the model, for the three doc surfaces
// that describe features: the root README summary, the per-target README
// section, and REFERENCE.md.
//
// ONE SOURCE. The feature set, its defaults and its ordering constraints all
// come from `main.kit.feature`, so a feature added to the model documents
// itself everywhere rather than in whichever file someone remembered.

type FeatureDoc = {
  name: string
  Name: string
  title: string
  transport: string
  wraps: boolean
  options: Array<{ name: string, value: string }>
}


// `transport` says how a feature attaches, and that is the whole of the
// ordering story:
//   wrap  wraps the transport chain — activation order IS nesting order
//   base  installs the base transport others wrap (test)
//   none  pipeline hooks only; order does not affect it
function isWrapping(feat: any): boolean {
  return 'wrap' === feat.transport
}


function renderValue(v: any): string {
  if (null == v) { return '' }
  if (Array.isArray(v)) { return '[' + v.map((x) => renderValue(x)).join(', ') + ']' }
  if ('object' === typeof v) {
    const keys = Object.keys(v)
    return 0 === keys.length ? '{}' :
      '{' + keys.map((k) => k + ': ' + renderValue(v[k])).join(', ') + '}'
  }
  if ('string' === typeof v) { return `'${v}'` }
  return String(v)
}


// Every feature the model declares active, in a stable order, with its
// options and their defaults.
function featureDocs(model: any): FeatureDoc[] {
  const feature = getModelPath(model, `main.${KIT}.feature`)

  return each(feature)
    .filter((f: any) => false !== f.active && 'base' !== f.name)
    .map((f: any) => {
      const opts = (f.config && f.config.options) || {}
      const options = Object.keys(opts).sort().map((k) => ({
        name: k,
        value: renderValue(opts[k]),
      }))
      return {
        name: f.name,
        Name: f.Name || f.name,
        title: f.title || '',
        transport: f.transport || 'none',
        wraps: isWrapping(f),
        options,
      }
    })
    .sort((a: FeatureDoc, b: FeatureDoc) => a.name.localeCompare(b.name))
}


export {
  featureDocs,
  renderValue,
}

export type { FeatureDoc }
