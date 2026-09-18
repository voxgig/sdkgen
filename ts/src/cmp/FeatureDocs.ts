import { featureApplies } from '../helpers/applicability'

import { each } from 'jostraca'

import { KIT, getModelPath } from '../types'



type FeatureDoc = {
  name: string
  Name: string
  title: string
  transport: string
  wraps: boolean
  options: Array<{ name: string, value: string }>

  extras: Array<{ name: string, type: string }>
}


function isWrapping(feat: any): boolean {
  return 'wrap' === feat.transport
}


// A struct.validate sentinel as a reader's word for it: '`$FUNCTION`' ->
// 'function'. A union renders its members, so netsim's latency reads
// 'number | map'. Anything unrecognised renders verbatim rather than being
// dropped — a doc table that silently omits an option is the failure this
// whole path exists to fix.
function sentinelName(v: any): string {
  if (Array.isArray(v)) {
    const members = v.slice(1).map((m: any) => sentinelName(m))
      .filter((m: string) => 'one' !== m)
    return 0 === members.length ? 'any' : members.join(' | ')
  }

  if ('string' !== typeof v) {
    return 'any'
  }

  const bare = v.replace(/[`$]/g, '').trim().toLowerCase()
  return '' === bare ? 'any' : bare
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


function featureDocs(model: any, target?: any): FeatureDoc[] {
  const feature = getModelPath(model, `main.${KIT}.feature`)

  return each(feature)
    .filter((f: any) => false !== f.active && 'base' !== f.name)
    .filter((f: any) => null == target || featureApplies(f, target))
    .map((f: any) => {
      const opts = (f.config && f.config.options) || {}
      const options = Object.keys(opts).sort().map((k) => ({
        name: k,
        value: renderValue(opts[k]),
      }))

      const extra = (f.config && f.config.optspec) || {}
      const extras = Object.keys(extra)
        .filter((k) => null == opts[k])
        .sort()
        .map((k) => ({ name: k, type: sentinelName(extra[k]) }))
      return {
        name: f.name,
        Name: f.Name || f.name,
        title: f.title || '',
        transport: f.transport || 'none',
        wraps: isWrapping(f),
        options,
        extras,
      }
    })
    .sort((a: FeatureDoc, b: FeatureDoc) => a.name.localeCompare(b.name))
}




const FIXED_ORDER_TARGETS = ['lean']

function honoursActivationOrder(target: any): boolean {
  return !FIXED_ORDER_TARGETS.includes(target?.name)
}


export {
  featureDocs,
  renderValue,
  sentinelName,
  honoursActivationOrder,
}

export type { FeatureDoc }
