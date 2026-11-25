import { readFileSync } from 'node:fs'

import { Aontu } from 'aontu'
import { names } from 'jostraca'
import { KIT } from '@voxgig/apidef'

import { docTexts, sentinelName } from './doctext'
import { factRulesFile } from './shipped'
import { CANON_OP_ORDER } from './opShape'
import { hasPackageName, packageName, registryState, repoInfo } from './packageMeta'
import { SdkGenError } from '../utility'
import { resolvesBundled } from '../action/resolve'
import { titleFacts } from './title'
import { definitionKind } from './graphqlPoint'


// No fact rule reads these, and they are most of a large model. A model's
// facts are left out too: the rules compute every one afresh.
const UNREAD = ['entity', 'flow', 'fact']


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
  if (isMap(kit.feature)) {
    input.feature = withoutFacts(kit.feature)
  }
  input.config = { ...(isMap(kit.config) ? kit.config : {}), auth: mapOr(kit.config?.auth) }
  input.info = { ...(isMap(kit.info) ? kit.info : {}), security: mapOr(kit.info?.security) }

  const server = ruleServer(kit.info)
  const entity = Object.fromEntries(Object.keys(mapOr(kit.entity)).map((name) => [name, {}]))

  const texts = docTexts(model)
  const escape = Object.fromEntries(texts.map((t, i) => ['t' + i, { raw: t.raw, vendor: t.vendor }]))

  const path = factRulesFile()
  const src = JSON.stringify({
    name: 'string' === typeof model.name ? model.name : '',
    main: { [KIT]: input }, server: server.rule, entity, escape,
  }).slice(1, -1) + '\n' + readFileSync(path, 'utf8')

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
  serverFacts(kit.fact, server, out.server.variables)
  kit.fact.env.entid = Object.fromEntries(Object.keys(entity).map((name) =>
    [name, out.entity[name].fact.entid]))
  kit.fact.ops = entityOps(kit.entity)
  kit.fact.package = projectPackages(model)
  kit.fact.option = optionRows(kit.optspec)
  releaseTags(model)
  texts.forEach((t, i) => place(t.at, t.path, out.escape['t' + i]))
  titleFacts(kit.target)
  kit.fact.external = externalTargets(model)
  place(kit, ['definitionKind'], definitionKind(model))
  return model
}


// The active targets placed in another repository, read here because the model
// the project's Root receives, which its documents read, leaves them out.
function externalTargets(model: any): { name: string, title: string, surface: string, url: string }[] {
  const target = mapOr(model.main[KIT].target)
  return model.main[KIT].fact.active
    .filter((name: string) => 'external' === target[name].fact?.place)
    .map((name: string) => ({
      name,
      title: target[name].fact.title,
      surface: target[name].fact.surface,
      url: '' === String(target[name].output?.repo ?? '') ? '' : repoInfo(model, name).repoUrl,
    }))
}


function mapOr(value: any): any {
  return isMap(value) ? value : {}
}


function withoutFacts(items: any): any {
  return Object.fromEntries(Object.entries(items).map(([name, item]: [string, any]) =>
    [name, isMap(item) ? { ...item, fact: undefined } : item]))
}


// The URL's variables in the order serverVariables gives them: as the URL names
// them, then the declared ones it does not. A variable the URL names but the
// spec omits is declared here, empty, so the rules decide it with the rest.
const SERVER_VAR_RE = /\{([A-Za-z0-9_]+)\}/g

function ruleServer(info: any): { rule: any, order: string[], declared: any } {
  const server = info?.servers?.[0]
  const url: string = 'string' === typeof server?.url ? server.url : ''
  const declared = mapOr(server?.variables)

  const order = [...new Set([...url.matchAll(SERVER_VAR_RE)].map((m) => m[1]))]
  order.push(...Object.keys(declared).filter((name) => !order.includes(name)))

  const variables = Object.fromEntries(order.map((name) => {
    const decl = mapOr(declared[name])
    return [name, { default: 'string' === typeof decl.default ? decl.default : '' }]
  }))
  return { rule: { url, variables }, order, declared }
}


// aontu lists no map's keys, so the variables the rules decided are listed here.
function serverFacts(facts: any, server: any, decided: any): void {
  facts.server = server.order.map((name: string) => {
    const decl = mapOr(server.declared[name])
    return {
      name,
      dflt: server.rule.variables[name].default,
      required: decided[name].fact.required,
      description: 'string' === typeof decl.description ? decl.description : '',
    }
  })
  facts.env.server = Object.fromEntries(server.order.map((name: string) =>
    [name, decided[name].fact.env]))
}


// Each entity's canonical operations, in canonical order: the list aontu
// cannot build from a map. An action-only operation counts. They sit outside
// the entities, which some tests print whole into generated source.
function entityOps(entity: any): Record<string, string[]> {
  return Object.fromEntries(Object.entries(mapOr(entity))
    .filter(([, ent]) => isMap(ent))
    .map(([name, ent]: [string, any]) => [name, CANON_OP_ORDER.filter((op: string) =>
      isMap(ent.op?.[op]) && false !== ent.op[op].active)]))
}


// The JVM package of java, kotlin and scala, and the Python package py and
// py-data import. py's is jostraca's Name for the project, lower-cased, as the
// Root names it; aontu's nom splits words differently.
function projectPackages(model: any): { jvm: string, py: string } {
  const word = (s: any) => String(s ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  const project: any = {}
  names(project, String(model.name ?? ''))
  return {
    jvm: word(String(model.origin || 'voxgig-sdk').replace(/-sdk$/, '')) + '.' + word(model.name) + 'sdk',
    py: String(project.Name ?? '').toLowerCase() + '_sdk',
  }
}


// One row per client option, in the order main.kit.optspec declares them.
function optionRows(optspec: any): { name: string, type: string }[] {
  return Object.entries(mapOr(optspec)).map(([name, spec]) => ({ name, type: optionType(spec) }))
}


function optionType(spec: any): string {
  if (isMap(spec)) {
    return 'object'
  }
  if ('string' === typeof spec && spec.startsWith('`$')) {
    return sentinelName(spec)
  }
  return typeof spec
}


// The tag before a version: `<prefix>/v`, else `v` for the tree's one npm
// package or the ts SDK's, else `<target>/v`, and empty when switched off.
// Only code compares package names, so this is the pass's, not a rule's.
function releaseTags(model: any): void {
  const kit = model.main[KIT]
  const target = mapOr(kit.target)
  const npm = kit.fact.active.filter((name: string) => isMap(target[name]?.fact) &&
    'external' !== target[name].fact.place &&
    'npm' === (target[name].publish?.registry?.name || '') && hasPackageName(model, name) &&
    'inactive' !== registryState(model, name))
  // A model with no name, built by hand, has no package names to compare.
  const primary = (name: string) => npm.includes(name) && (1 === npm.length ||
    (null != model.name && packageName(model, name) === packageName(model, 'npm')))

  for (const name of Object.keys(target)) {
    if (isMap(target[name]?.fact)) {
      const tag = mapOr(target[name].publish?.tag)
      const prefix = 'string' === typeof tag.prefix ? tag.prefix : ''
      target[name].fact.tag = false === tag.active ? '' :
        '' !== prefix ? prefix + '/v' : primary(name) ? 'v' : name + '/v'
    }
  }
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
  for (const [name, decl] of Object.entries(withoutFacts(target)) as [string, any][]) {
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
