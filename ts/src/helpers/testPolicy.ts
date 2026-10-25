import { KIT } from '../types'

import { flowSteps } from './buildIdNames'
import { primaryPoint } from './graphqlPoint'
import { getMatchEntries } from './getMatchEntries'
import { pointFacts } from './resolved'


function liveStrict(model: any, target?: string): boolean {
  const perTarget = null == target ? undefined :
    model?.main?.[KIT]?.target?.[target]?.test?.live?.strict
  const configured = perTarget ?? model?.main?.[KIT]?.test?.live?.strict
  return false !== configured
}


// The comment a generated live test carries, in the target's own comment
// syntax, so every target states the setting and its effect alike.
function liveStrictNote(strict: boolean, prefix: string, indent = ''): string {
  return [
    `main.kit.test.live.strict is ${strict} (the default is true): a live`,
    'request that fails, or a live test missing an input it needs,',
    strict ? 'fails the test.' : 'skips the test with the reason.',
    'An account with no record for a test to read skips it either way.',
  ].map((line) => indent + prefix + ' ' + line).join('\n')
}


type LiveFlowNeeds = {
  // idmap keys the steps bind, which only the *_ENTID variable supplies live
  keys: string[]
  // match of the list that finds the existing record a create-less load reads
  discover?: Record<string, string>
  // why the flow cannot run against a live API at all
  blocked?: string
}


// What an entity flow generated from the offline fixtures needs before it
// can run live. A flow that creates its record needs nothing of the
// fixture's; one that only reads takes the first record its list finds.
function liveFlowNeeds(entity: any, flow: any): LiveFlowNeeds {
  const steps: any[] = flowSteps(flow)
  const hasCreate = steps.some((step) => 'create' === step.o)
  const bound = (map: any) => Object.entries(map || {})
    .filter(([k, v]: any) => !k.endsWith('$') && 'string' === typeof v && '' !== v)
    .map(([, v]) => v as string)

  const keys = new Set<string>()
  for (const step of steps) {
    if ('create' === step.o || 'list' === step.o) bound(step.m).forEach((k) => keys.add(k))
    if ('update' === step.o) bound(step.d).forEach((k) => keys.add(k))
  }

  const needs: LiveFlowNeeds = { keys: [...keys] }
  if (hasCreate || null == entity?.id) {
    return needs
  }

  if (steps.some((step) => 'update' === step.o)) {
    needs.blocked = 'the flow updates a ' + entity.name + ' record it did not create'
  }
  else if (steps.some((step) => 'load' === step.o)) {
    const list = steps.find((step) => 'list' === step.o)
    if (null == list) {
      needs.blocked = 'the flow loads a ' + entity.name + ' record it has no list to find'
    }
    else {
      needs.discover = Object.fromEntries(Object.entries(list.m || {})
        .filter(([k, v]: any) => !k.endsWith('$') && 'string' === typeof v && '' !== v)) as any
    }
  }

  return needs
}


// The *_ENTID key, the same in the live entity harness and every live test.
function liveIdKey(entityName: string, paramName: string): string {
  return ('id' === paramName ? entityName : paramName.replace(/_id$/, '')) + '01'
}


function scalar(value: any): string | number | boolean | undefined {
  return 'string' === typeof value || 'number' === typeof value || 'boolean' === typeof value ?
    value : undefined
}


function scalarExample(arg: any): string | number | boolean | undefined {
  return scalar(arg?.ex)
}


function liveExampleIds(entity: any): [string, string | number | boolean][] {
  const ids: Record<string, string | number | boolean> = {}
  for (const opname of ['list', 'load']) {
    const points = entity?.op?.[opname]?.points
    const point: any = null == points ? undefined : primaryPoint(points, entity.name, opname)
    for (const arg of point?.g?.params || []) {
      const key = liveIdKey(entity.name, arg.n)
      const ex = scalarExample(arg)
      if (undefined === ids[key] && undefined !== ex) ids[key] = ex
    }
  }
  return Object.keys(ids).sort().map((key) => [key, ids[key]])
}


function liveQueryExamples(point: any): [string, string | number | boolean][] {
  return (point?.g?.query || [])
    .filter((arg: any) => arg.r && undefined !== scalarExample(arg))
    .map((arg: any) => [arg.or || arg.n, scalarExample(arg)])
}


const plainPoints = (entity: any, opname: string): any[] => (entity?.op?.[opname]?.points || [])
  .filter((point: any) => false !== point.a && null == point.q?.$action)


function routeExamples(point: any, bound: string[], pathBound: boolean):
  [string, string | number | boolean][] | undefined {
  const params = pathBound ? [] : point.g?.params || []
  const args = [...params, ...(point.g?.query || []).filter((arg: any) => arg.r)]
  const fill: [string, string | number | boolean][] = []
  for (const arg of args) {
    if (bound.includes(arg.n) || fill.some(([name]) => name === arg.n)) continue
    const ex = scalarExample(arg)
    if (undefined !== ex) fill.push([arg.n, ex])
    else if (false !== arg.r) return undefined
  }
  return fill
}


// The live entity harness's route: the first whose required parameters are
// all bound or exemplified. A load of a known record binds its own path.
function liveRouteExamples(entity: any, opname: string, bound: string[], pathBound = false):
  [string, string | number | boolean][] {
  for (const point of plainPoints(entity, opname)) {
    const fill = routeExamples(point, bound, pathBound)
    if (null != fill) return fill
  }
  return []
}


function liveStepExamples(entity: any, step: any): [string, string | number | boolean][] {
  if ('list' !== step?.o && 'load' !== step?.o) return []
  const bound = getMatchEntries(step).map(([name]) => name)
  const known = 'load' === step.o && null != entity?.id
  const route = known ? flowLoadRoute(entity, step) : undefined
  return null == route ? liveRouteExamples(entity, step.o, bound, known) :
    routeExamples(route.point, bound, true) ?? []
}


const SCALAR_FIELD = ['`$STRING`', '`$INTEGER`', '`$NUMBER`', '`$BOOLEAN`']

type FlowRouteArg = { name: string, field?: string, idmap: string[] }

type FlowLoadRoute = { route: string, point: any, args: FlowRouteArg[] }


// The scalar field of the record a route parameter reads: the entity id's
// mapping for it, else its namesake; a dotted mapping reads into an object.
function recordField(entity: any, name: string): string | undefined {
  const field = entity?.id?.from?.[name] ?? name
  if ('string' !== typeof field || field.includes('.')) return undefined
  const def: any = Object.values(entity?.fields || {}).find((f: any) => f?.n === field)
  return SCALAR_FIELD.includes(def?.t) ? field : undefined
}


// The route a flow's load of a known record takes: the first the runtime
// tries that takes the id and whose other path parameters the record holds
// or the step binds, read from the record first. Undefined keeps the match.
function flowLoadRoute(entity: any, step: any): FlowLoadRoute | undefined {
  if ('load' !== step?.o || null == entity?.id) return undefined
  const bound = new Map(getMatchEntries(step)
    .filter(([, binding]) => 'string' === typeof binding) as [string, string][])
  const order = [...bound.keys()]
  const rank = (arg: FlowRouteArg) => order.includes(arg.name) ? order.indexOf(arg.name) : order.length
  for (const point of plainPoints(entity, 'load')) {
    const names = [...new Set<string>((point.g?.params || []).map((arg: any) => arg.n))]
    if (!names.includes('id')) continue
    const args: FlowRouteArg[] = names.filter((name) => 'id' !== name).map((name) => {
      const binding = bound.get(name)
      return {
        name, field: recordField(entity, name),
        idmap: null == binding || binding === name ? [name] : [name, binding],
      }
    })
    if (args.every((arg) => null != arg.field || bound.has(arg.name))) {
      return { route: routeOf(point), point, args: args.sort((a, b) => rank(a) - rank(b)) }
    }
  }
  return undefined
}


// The flow, each load of a known record naming its route and record fields.
function liveFlowRoutes(entity: any, flow: any): any {
  if (!Array.isArray(flow?.step)) return flow
  const step = flow.step.map((step: any) => {
    const route = flowLoadRoute(entity, step)
    return null == route ? step : {
      ...step, route: route.route,
      record: Object.fromEntries(route.args.filter((arg) => null != arg.field)
        .map((arg) => [arg.name, arg.field])),
    }
  })
  return { ...flow, step }
}


// The first value a parameter's enum allows; apidef already takes a schema
// default as the example.
function enumExample(facts: any, arg: any): string | number | boolean | undefined {
  const where = 'param' === arg.k ? 'path' : arg.k
  const def = (Array.isArray(facts?.parameters) ? facts.parameters : [])
    .find((param: any) => param?.name === (arg.or ?? arg.n) && (null == param.in || param.in === where))
  const values = (def?.schema ?? def)?.enum
  return Array.isArray(values) ? scalar(values[0]) : undefined
}


// The entity as a live test reads it: a required parameter with no example
// takes the first value its definition's enum allows.
function liveEntity(ctx$: any, entity: any): any {
  let filled = false
  const op: any = {}
  for (const [name, operation] of Object.entries(entity?.op || {}) as [string, any][]) {
    op[name] = !Array.isArray(operation?.points) ? operation : {
      ...operation,
      points: operation.points.map((point: any) => {
        if (null == point?.g) return point
        const facts = pointFacts(ctx$, point)
        const g = { ...point.g }
        for (const kind of ['params', 'query'].filter((kind) => Array.isArray(g[kind]))) {
          g[kind] = g[kind].map((arg: any) => {
            const ex = !arg?.r || undefined !== scalarExample(arg) ? undefined : enumExample(facts, arg)
            if (undefined === ex) return arg
            filled = true
            return { ...arg, ex }
          })
        }
        return { ...point, g }
      }),
    }
  }
  return filled ? { ...entity, op } : entity
}


// Set by the GET-only guard of a read-only live run.
const LIVE_GETONLY_ENV = 'VOXGIG_GETONLY_GUARD'

type LiveExcluded = { id: string, reason: string }

type LiveGetOnly = {
  excluded: LiveExcluded[]
  // the steps left to run, as a flow
  flow: any
}


// The steps of a flow the live harness runs, as its step ids count them.
function liveFlowSteps(flow: any): any[] {
  return Object.values(flow?.step || {})
    .filter((step: any) => false !== step?.a || true === step?.unreachable)
}


function liveStepId(entity: any, step: any, index: number): string {
  return entity.name + '.' + step.o + '.' + index
}


const GETONLY = 'GET-only live run: '

const isGet = (point: any) => 'GET' === String(point?.m).toUpperCase()

const routeOf = (point: any) => String(point?.m).toUpperCase() + ' ' + point?.o


function writeRoute(entity: any, opname: string): string | undefined {
  const points: any[] = (entity?.op?.[opname]?.points || []).filter((point: any) => false !== point.a)
  return 0 === points.length || points.some(isGet) ? undefined : routeOf(points[0])
}


// Why a GET-only live run sends no request to a route: undefined for a GET.
function liveGetOnlyReason(point: any): string | undefined {
  return isGet(point) ? undefined : GETONLY + 'needs ' + routeOf(point)
}


// What a GET-only live run leaves out of a flow: each step no GET route
// reaches, and each step that acts on a record only such a step gives.
// Undefined when every step can run.
function liveGetOnly(entity: any, flow: any): LiveGetOnly | undefined {
  const steps = liveFlowSteps(flow)
  const reasons = new Map<any, string>()
  for (const step of steps) {
    const route = writeRoute(entity, step.o)
    if (null != route) reasons.set(step, 'needs ' + route)
  }
  if (0 === reasons.size) return undefined

  const id = (step: any) => liveStepId(entity, step, steps.indexOf(step))
  const left = () => steps.filter((step) => !reasons.has(step))
  const create = steps.find((step) => 'create' === step.o && reasons.has(step))
  const sources = steps.filter((step) => ['create', 'list'].includes(step.o) && reasons.has(step))
  if (null != entity?.id && 0 < sources.length) {
    for (const step of null == create ? [] : left()) {
      if (['update', 'remove'].includes(step.o)) {
        reasons.set(step, 'acts on the record ' + id(create) + ' makes')
      }
      else if ('list' === step.o && (step.v || []).some((v: any) => 'ItemNotExists' === v?.apply)) {
        reasons.set(step, 'checks a removal this run does not make')
      }
    }
    if (!left().some((step) => 'list' === step.o)) {
      for (const step of left().filter((step) => 'load' === step.o)) {
        reasons.set(step, 'reads a record only ' + sources.map(id).join(', ') + ' gives')
      }
    }
  }

  return {
    excluded: steps.filter((step) => reasons.has(step))
      .map((step) => ({ id: id(step), reason: GETONLY + reasons.get(step) })),
    flow: { ...flow, step: left() },
  }
}


type LiveKeyExcluded = LiveExcluded & { key: string }


// The ids a live direct test needs that a GET-only run cannot get, unless
// *_ENTID gives them: of a record only a non-GET create makes, no GET list finds.
function liveDirectGetOnly(model: any, entity: any, test: string, keys: string[]): LiveKeyExcluded[] {
  const entities = model?.main?.[KIT]?.entity || {}
  const out: LiveKeyExcluded[] = []
  for (const key of keys) {
    const owner = liveIdKey(entity.name, 'id') === key ? entity : entities[key.replace(/01$/, '')]
    const make = null == owner ? undefined : writeRoute(owner, 'create')
    const listed = (owner?.op?.list?.points || []).some((point: any) => false !== point.a && isGet(point))
    if (null != make && !listed) {
      out.push({ key, id: test, reason: GETONLY + 'needs ' + key + ', which only ' + make + ' gives' })
    }
  }
  return out
}


// The lines the live harness prints for the steps a run leaves out.
function liveExcludedLines(plan: { excluded: LiveExcluded[] }): string[] {
  return plan.excluded.map(({ id, reason }) =>
    'LIVE STEP ' + JSON.stringify({ id, state: 'excluded', attempted: false, reason }))
}


// Why a test whose every step is left out skips, as the live harness says it.
function liveExcludedSummary(plan: { excluded: LiveExcluded[] }): string {
  return 'Live coverage incomplete: ' +
    plan.excluded.map(({ id, reason }) => id + ' excluded (' + reason + ')').join('; ')
}


export type { LiveFlowNeeds, LiveExcluded, LiveGetOnly, LiveKeyExcluded, FlowRouteArg, FlowLoadRoute }

export {
  liveStrict, liveStrictNote, liveFlowNeeds,
  liveIdKey, liveExampleIds, liveQueryExamples, liveRouteExamples, liveStepExamples,
  flowLoadRoute, liveFlowRoutes,
  liveEntity, LIVE_GETONLY_ENV, liveFlowSteps, liveStepId, liveGetOnly, liveGetOnlyReason,
  liveDirectGetOnly, liveExcludedLines, liveExcludedSummary,
}
