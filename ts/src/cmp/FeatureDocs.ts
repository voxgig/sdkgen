import { featureApplies } from '../helpers/applicability'
import { fact } from '../helpers/facts'

import { camelify, each } from 'jostraca'

import { KIT, getModelPath } from '../types'



type FeatureDoc = {
  name: string
  Name: string
  version: string
  title: string
  titleCell: string
  transport: string
  wraps: boolean
  on: boolean
  // Active hooks, which a wrapping feature such as cost may also declare.
  hooks: string[]
  options: Array<{ name: string, code: string }>

  extras: Array<{ name: string, type: string }>
}


function isWrapping(feat: any): boolean {
  return 'wrap' === feat.transport
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
        code: fact(f, 'option')[k].value.codecell,
      }))

      const extra = (f.config && f.config.optspec) || {}
      const extras = Object.keys(extra)
        .filter((k) => null == opts[k])
        .sort()
        .map((k) => ({ name: k, type: fact(f, 'option')[k].type.cell }))
      return {
        name: f.name,
        Name: f.Name || camelify(f.name),
        version: String(f.version ?? ''),
        title: fact(f, 'title').inline,
        titleCell: fact(f, 'title').cell,
        transport: f.transport || 'none',
        wraps: isWrapping(f),
        on: true === fact(f, 'on'),
        hooks: Object.keys(f.hook || {}).filter((h: string) => true === f.hook[h]?.active).sort(),
        options,
        extras,
      }
    })
    .sort((a: FeatureDoc, b: FeatureDoc) => a.name.localeCompare(b.name))
}




// `a`, `a` and `b`, `a`, `b` and `c`.
function codeList(names: string[]): string {
  const code = names.map((n: string) => '`' + n + '`')
  return code.length < 2 ? code.join('') :
    code.slice(0, -1).join(', ') + ' and ' + code[code.length - 1]
}


const FIXED_ORDER_TARGETS = ['lean']

function honoursActivationOrder(target: any): boolean {
  return !FIXED_ORDER_TARGETS.includes(target?.name)
}


export {
  featureDocs,
  codeList,
  honoursActivationOrder,
}

export type { FeatureDoc }
