import { readFileSync } from 'node:fs'

import { Aontu } from 'aontu'
import { KIT } from '@voxgig/apidef'

import { docTexts } from './doctext'
import { factRulesFile } from './shipped'
import { SdkGenError } from '../utility'
import { resolvesBundled } from '../action/resolve'
import { titleFacts } from './title'
import { definitionKind } from './graphqlPoint'


// No fact rule reads these, and they are most of a large model.
const UNREAD = ['entity', 'flow']


function isMap(v: any): boolean {
  return null != v && 'object' === typeof v && !Array.isArray(v)
}


function copyFacts(from: any, to: any): void {
  for (const [key, val] of Object.entries(from)) {
    if ('fact' === key) {
      if (isMap(val) && 0 < Object.keys(val as object).length) {
        to.fact = val
      }
    }
    else if (isMap(val) && isMap(to[key])) {
      copyFacts(val, to[key])
    }
  }
}


// Computes every fact once and writes it into the model beside what it
// describes, as `fact`. Templates read facts with `fact`; none computes one.
function applyFacts(model: any): any {
  const kit = model?.main?.[KIT]
  if (!isMap(kit)) {
    return model
  }

  const input: any = {}
  for (const [key, val] of Object.entries(kit)) {
    if (!UNREAD.includes(key)) {
      input[key] = val
    }
  }
  if (isMap(kit.target)) {
    input.target = ruleTargets(kit.target)
  }

  const texts = docTexts(model)
  const escape = Object.fromEntries(texts.map((t, i) => ['t' + i, { raw: t.raw, vendor: t.vendor }]))

  const path = factRulesFile()
  const src = JSON.stringify({ main: { [KIT]: input }, escape }).slice(1, -1) +
    '\n' + readFileSync(path, 'utf8')

  const errs: any[] = []
  const out = new Aontu().generate(src, { path, errs })
  if (0 < errs.length || null == out?.main?.[KIT]) {
    throw new Error('sdkgen facts: the fact rules did not evaluate: ' +
      errs.map((e: any) => `[${e.why}] ${e.msg}`).join(' | '))
  }

  copyFacts(out.main[KIT], kit)
  linkConsumers(kit.target, out.main[KIT].target)
  kit.fact = isMap(kit.fact) ? kit.fact : {}
  kit.fact.active = activeNames(kit.target)
  texts.forEach((t, i) => place(t.at, t.path, out.escape['t' + i]))
  titleFacts(kit.target)
  place(kit, ['definitionKind'], definitionKind(model))
  return model
}


// aontu lists no map's keys, so the active targets are named here.
function activeNames(target: any): string[] {
  return !isMap(target) ? [] : Object.keys(target).sort()
    .filter((name: string) => isMap(target[name]) && false !== target[name].active)
}


// A hand-built model may lack the slots the rules read, and only code can say
// whether a target's provenance leads to the bundled scaffold.
function ruleTargets(target: any): any {
  const out: any = {}
  for (const [name, t] of Object.entries(target)) {
    const decl: any = t
    out[name] = !isMap(decl) ? decl : {
      ...decl,
      name: null == decl.name ? name : decl.name,
      origname: null == decl.origname ? '' : decl.origname,
      surface: null == decl.surface ? '' : decl.surface,
      consumes: null == decl.consumes ? '' : decl.consumes,
      scaffold: resolvesBundled(decl, name),
    }
  }
  return out
}


// The rules name the origin a target builds on; only the installed keys can
// say which target that is, and which targets build on each one.
function linkConsumers(target: any, derived: any): void {
  if (!isMap(target) || !isMap(derived)) {
    return
  }

  const names = Object.keys(target).sort().filter((name: string) => isMap(target[name]?.fact))
  for (const name of names) {
    target[name].fact.consumes = consumed(target, name, derived[name]?.derive?.wraps)
  }
  for (const name of names) {
    target[name].fact.consumers = names.filter((other: string) =>
      false !== target[other].active && name === target[other].fact.consumes)
  }
}


function consumed(target: any, name: string, wraps: any): string {
  if ('string' !== typeof wraps || '' === wraps) {
    return ''
  }
  if (isMap(target[wraps])) {
    return wraps
  }

  const found = Object.keys(target).sort().filter((other: string) =>
    other !== name && wraps === target[other]?.fact?.origin)
  if (1 < found.length) {
    throw new SdkGenError('Target "' + name + '" builds on ' + wraps + ', and ' +
      found.length + ' installed targets come from it: ' + found.join(', ') +
      '. Name one in its own model, as `consumes: \'<target>\'`.')
  }
  return found[0] ?? ''
}


function place(at: any, path: string[], forms: any): void {
  let node = at.fact = isMap(at.fact) ? at.fact : {}
  for (const key of path.slice(0, -1)) {
    node = node[key] = isMap(node[key]) ? node[key] : {}
  }
  node[path[path.length - 1]] = forms
}


function fact(node: any, name: string): any {
  const facts = node?.fact
  if (!isMap(facts) || !(name in facts)) {
    throw new Error(`sdkgen facts: '${node?.name ?? '?'}' has no fact '${name}': ` +
      'the model did not pass through applyFacts, or lacks what the fact reads')
  }
  return facts[name]
}


// A plan no Root can write: several targets claiming the project root, or a
// target there beside the root documents, which would overwrite its own.
// `external` names the targets this run writes elsewhere; a target with no
// `output` claims no place at all.
function refuseRootPlan(model: any, external: string[] = []): void {
  const kit = model.main[KIT]
  const target = kit.target || {}
  const atRoot = Object.keys(target).sort().filter((name: string) =>
    !external.includes(name) && false !== target[name].active &&
    null != target[name].output && 'root' === fact(target[name], 'place'))

  if (1 < atRoot.length) {
    throw new SdkGenError(
      'Only one target can be generated at the project root, and ' +
      atRoot.length + ' declare `output: root: true`: ' + atRoot.join(', ') + '.')
  }

  if (1 === atRoot.length && fact(kit, 'top')) {
    throw new SdkGenError(
      'Target "' + atRoot[0] + '" is generated at the project root, where the ' +
      'SDK repository files (README, LICENSE, Makefile, workflows) would ' +
      'overwrite its own. Declare `main: kit: phase: top: active: false` in ' +
      'model/project.aontu.')
  }
}


export {
  applyFacts,
  fact,
  refuseRootPlan,
}
