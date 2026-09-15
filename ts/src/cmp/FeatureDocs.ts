import { featureApplies } from '../helpers/applicability'

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

  // Options the feature accepts but does not default: callbacks, injected
  // clocks, values the caller either supplies or does not. Declared in
  // `config.optspec` because a DEFAULTS map cannot describe an option that
  // has no default — which is why the tables built from `config.options`
  // alone were incomplete, and had to say so.
  extras: Array<{ name: string, type: string }>
}


// `transport` says how a feature attaches, and that is the whole of the
// ordering story:
//   wrap  wraps the transport chain — activation order IS nesting order
//   base  installs the base transport others wrap (test)
//   none  pipeline hooks only; order does not affect it
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


// Every feature the model declares active, in a stable order, with its
// options and their defaults.
// With a target, also drops features that do not APPLY to it: a target
// README must not document a feature that target has no implementation
// for. Without one (the repo-level README) every active feature is listed.
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
        // A name in both is documented by its DEFAULT; `config.optspec`
        // only sharpened its type (netsim's `latency`, a number that is
        // also a { min, max } map), and a reader wants the default.
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




// Targets that compose transport features in a FIXED catalog order rather
// than the order the caller activates them in.
//
// Every other target derives `__derived__.featureorder` from the options and
// adds features in that order, so an ordered activation list is what fixes
// nesting. lean has no featureorder at all — SdkFeatures.featureNames is a
// fixed array — and its resolveFeatureOpts accepts only a map, silently
// replacing a list with an empty one. Telling a lean reader to activate
// features as an ordered list would therefore disable every feature they
// asked for.
//
// Verify with: grep -rl featureorder tm/<target>
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
