// THE CLIENT OPTION SPEC, assembled from the model.
//
// One schema, not twenty. `main.kit.optspec` (model/sdkgen.aon) declares the
// standard SDK options; each active feature's own `config.options` declares
// its own. Both are already struct.validate specs in the by-example sense — a
// concrete value is the type AND the default — so assembling them is a merge,
// not a translation. The `Spec` component writes the result into the SDK and
// makeOptions validates the caller's options against it.
//
// WHAT THIS REPLACES. Every language's make_options template carried its own
// literal copy of the standard options (cpp and scala as JSON string
// constants), and the feature half did not exist at all: the shipped spec was
//
//   feature: { `$CHILD`: { `$OPEN`: true, active: false } }
//
// so a feature's options were never checked and a typo in one was silently
// ignored — `{ feature: { cache: { ttl: '5s' } } }` configured nothing and
// said nothing. Meanwhile the README's option tables came from a THIRD place
// (`target.options`, `feature.config.options`), which is how a documented
// option and a validated option could be different sets.

import { each } from 'jostraca'
import { KIT, getModelPath } from '@voxgig/apidef'

import { targetFeatures } from './applicability'
import { byExampleSpec, entitySpecs, optionalSpec, sentinel } from './canonSpec'


const S_CHILD = sentinel('CHILD')
const S_OPEN = sentinel('OPEN')
const S_ONE = sentinel('ONE')
const S_NIL = sentinel('NIL')


// A feature entry the caller may omit.
//
// WHY NOT A BARE MAP. A spec value is also the value validate INSERTS when
// the key is absent, so naming every feature with a bare map would put an
// entry for every feature the model declares into `options.feature` — and
// `makeOptions` derives the feature ADD ORDER from that map's keys. The
// `$ONE`/`$NIL` union keeps an absent feature absent and validates a supplied
// one, which is the behaviour `$CHILD` had and the behaviour callers have.
function optional(spec: any): any[] {
  return [S_ONE, spec, S_NIL]
}


// The spec for one feature's options.
//
// TWO DECLARATIONS, ONE SPEC:
//   `config.options` — options WITH a default. Also the docs table.
//   `config.optspec` — options with NO sensible default: callbacks (`sink`,
//                      `now`, `idgen`), injected objects (`logger`), values
//                      that only make sense when supplied. Declared as bare
//                      sentinels, so they type-check without inventing a
//                      default the feature would then have to ignore.
//
// OPEN BY DEFAULT. A feature may read an option neither list names — the
// shipped set still does, which is why this is open rather than closed — and
// rejecting those would break working clients on upgrade. `config.strict:
// true` closes one feature's spec once its options are fully declared.
function featureOptionSpec(feat: any): Record<string, any> {
  const config = (feat && feat.config) || {}
  const spec: Record<string, any> = {}

  if (true !== config.strict) {
    spec[S_OPEN] = true
  }

  // Every feature takes `active`, whatever else it declares. Stated rather
  // than assumed: a feature whose model omits `config.options` entirely
  // (nothing stops one) must still validate the one option it certainly has.
  spec.active = optionalSpec(byExampleSpec(false))

  // EVERY FEATURE OPTION IS OPTIONAL, and that is not a policy choice here —
  // it is what a caller does. `{ feature: { cost: { active: true, unit:
  // 0.002 } } }` names two of cost's nine options and means the defaults for
  // the other seven, which the feature's own code applies. A spec naming a
  // key requires it, so without this widening cost's own corpus case failed
  // its own feature's spec for the seven it did not mention.
  //
  // Widened to their KIND as well — see byExampleSpec.
  for (const [name, val] of Object.entries(config.options || {})) {
    spec[name] = optionalSpec(byExampleSpec(val))
  }

  // Type-only declarations win: a name in both is one the author gave a
  // default AND a type, and the type is the more specific statement. Written
  // as sentinels already, so they are widened for absence but not for kind.
  for (const [name, val] of Object.entries(config.optspec || {})) {
    spec[name] = optionalSpec(val)
  }

  return spec
}


// The assembled option spec for a target.
//
// `targetname` gates the feature half exactly as `configDefinition` does: a
// target must not validate against — or document — a feature it has no
// implementation for. Without a name every active feature is included.
function optionSpec(model: any, targetname?: string): Record<string, any> {
  // `only_active: false` IS THE WHOLE SPEC. getModelPath filters out any
  // child whose `active` is false, and a spec is full of them: `test: {
  // active: false }`, the `$CHILD` entity template, every feature default.
  // Filtered, the spec silently lost its `test` entry and validate then
  // rejected a perfectly ordinary `{ test: { active: true } }` with
  // "Unexpected keys at field <root>: test". This is a SCHEMA, not a set of
  // things to emit — `active: false` here is a default value, not a switch.
  const base = getModelPath(model, `main.${KIT}.optspec`,
    { required: false, only_active: false }) || {}

  // Cloned, because the model is shared across every target in one build and
  // a spec assembled for `ts` must not be the object `js` then extends.
  const spec: Record<string, any> = JSON.parse(JSON.stringify(base))

  // The generic entry, kept from the shipped spec: a feature supplied at
  // construction through `extend` (the station adopt path) is not in the
  // model, so its options must still pass. Named entries below are checked
  // against their own spec; anything else gets `active` checked and the rest
  // waved through.
  const feature: Record<string, any> = {
    [S_CHILD]: {
      [S_OPEN]: true,
      active: false,
    },
  }

  const feats = targetFeatures(model, null == targetname ? undefined : targetname)
  each(feats).forEach((f: any) => {
    if (null == f || null == f.name || false === f.active) {
      return
    }
    feature[f.name] = optional(featureOptionSpec(f))
  })

  spec.feature = feature

  return spec
}


// The per-entity data/request specs a target needs, or null when it needs
// none.
//
// GATED ON THE FEATURE, and that gate is the whole reason this returns null
// rather than an empty map. The specs are derived data: every one of them can
// be rebuilt from `fields[].type`, which the generated config already
// carries. Emitting them unconditionally would grow every existing project's
// generated source — and, above the config size threshold, flip targets from
// the literal representation to the parsed-JSON one — to carry a spec nothing
// reads. A project that turns `validate` on pays for it; nobody else does.
function entitySpecMap(model: any, targetname?: string): Record<string, any> | null {
  const feats = targetFeatures(model, null == targetname ? undefined : targetname)
  const validate = (feats as any).validate

  if (null == validate || false === validate.active) {
    return null
  }

  const entity = getModelPath(model, `main.${KIT}.entity`, { required: false }) || {}

  const specs: Record<string, any> = {}
  each(entity).forEach((ent: any) => {
    if (null == ent || null == ent.name) {
      return
    }
    specs[ent.name] = entitySpecs(ent)
  })

  return specs
}


export {
  optionSpec,
  featureOptionSpec,
  entitySpecMap,
}
