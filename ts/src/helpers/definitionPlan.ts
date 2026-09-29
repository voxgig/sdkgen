/* Copyright (c) 2026 Voxgig Ltd, MIT License */

import { KIT, nom } from '@voxgig/apidef'

import { entityCollection } from './opShape'
import { pointSegments } from './pointPath'
import { pointFacts } from './resolved'
import { isAuthSuppressed, resolveAuthIn, resolveAuthName } from '../utility'


// What a generated definition test checks an operation against: the API
// definition's own facts, never the model inferred from it. A test generated
// from the model agrees with the model, so it cannot see a wrong unwrap, a
// dropped credential or a path parameter echoed into the query.

type Credential = { in: string, name: string, scheme?: string }

type DefinitionPoint = {
  entity: string
  accessor: string
  op: string
  method: string
  path: string
  action?: string
  args: { name: string, wire: string, value: any }[]
  select: Record<string, any>
  headers: { name: string, wire: string, value: any }[]
  query: string[]
  auth: Credential[][] | null
  status: number
  sample: any
  idField: string
}


// The operations every target generates a method for. The model may hold
// others, such as a patch beside an update, which no SDK can be called with.
const GENERATED_OPS = ['load', 'list', 'create', 'update', 'remove']

const MAX_ITEMS = 3
const MAX_DEPTH = 8
const MAX_SAMPLE = 32 * 1024


function definitionPlan(ctx$: any): DefinitionPoint[] {
  const model = ctx$?.model
  const plan: DefinitionPoint[] = []
  const unchecked = false === model?.main?.[KIT]?.config?.auth?.active ||
    false === model?.main?.[KIT]?.info?.auth
  // A generated SDK sends one credential, under the scheme apidef chose for it.
  const own = model?.main?.[KIT]?.info?.security?.scheme
  // The header the SDK puts any key in, as its prepareAuth does, though the
  // definition declares no scheme: LearnWorlds declares it as a parameter.
  const ownHeader = !isAuthSuppressed(model) && 'header' === resolveAuthIn(model) ?
    resolveAuthName(model).toLowerCase() : null

  for (const entity of Object.values(entityCollection(model)) as any[]) {
    if (false === entity.active) continue

    for (const [op, operation] of Object.entries(entity.op || {}) as any[]) {
      // An inactive operation stays in the model but gets no method.
      if (false === operation?.active || !GENERATED_OPS.includes(op)) continue

      const points = (operation?.points || []).filter((p: any) => false !== p.a)

      for (const point of points) {
        if ('graphql' === point.k) continue

        const facts = pointFacts(ctx$, point)
        if ('http' !== facts?.protocol) continue

        // Points the SDK cannot tell apart are selected by order, not input.
        const select = point.q || {}
        const same = points.filter((p: any) =>
          JSON.stringify(p.q || {}) === JSON.stringify(select))
        if (1 !== same.length) continue

        const params: any[] = Array.isArray(facts.parameters) ? facts.parameters : []
        const placed = pathPlaceholders(point)
        const args = (point.g?.params || []).map((arg: any, i: number) => {
          const wire = placed[arg.n] ?? (arg.or || arg.n)
          const def = params.find((p: any) => 'path' === p?.in && wire === p?.name)
          return { name: arg.n, wire, value: scalar(def?.example ?? def?.schema?.example) ?? 'p' + (i + 1) }
        })

        // A header argument is sent too, and must arrive as a header under
        // the definition's name, never in the query.
        const headers = (point.g?.header || [])
          .filter((arg: any) => false !== arg.a &&
            ![ownHeader, 'content-type'].includes(String(arg.or || arg.n).toLowerCase()))
          .map((arg: any, i: number) => {
            const wire = String(arg.or || arg.n)
            const def = params.find((p: any) => 'header' === p?.in &&
              wire.toLowerCase() === String(p?.name).toLowerCase())
            return { name: arg.n, wire, value: scalar(arg.ex ?? def?.example ?? def?.schema?.example) ?? 'h' + (i + 1) }
          })

        const selected: Record<string, any> = {}
        for (const key of select.exist || []) {
          if (args.some((a: any) => a.name === key) || headers.some((h: any) => h.name === key)) continue
          const def = params.find((p: any) => key === p?.name)
          selected[key] = scalar(def?.example ?? def?.schema?.example) ?? 'v1'
        }

        // Every query argument is sent too, so a name that goes out in the
        // model's spelling fails even where no point selects on it. One that
        // another point selects on would move the SDK to that point.
        const elsewhere = new Set(points.filter((p: any) => p !== point)
          .flatMap((p: any) => p.q?.exist || []))
        for (const arg of point.g?.query || []) {
          if (false === arg.a || undefined !== selected[arg.n] || elsewhere.has(arg.n)) continue
          const def = params.find((p: any) => 'query' === p?.in && (arg.or || arg.n) === p?.name)
          selected[arg.n] = scalar(arg.ex ?? def?.example ?? def?.schema?.example) ?? 'v1'
        }

        const success = successResponse(facts.responses)
        const media = null == success ? undefined : jsonMedia(success.response)

        plan.push({
          entity: entity.name,
          accessor: nom(entity, 'Name'),
          op,
          method: String(point.m).toUpperCase(),
          path: point.o,
          ...(null == select.$action ? {} : { action: select.$action }),
          args,
          select: selected,
          headers,
          query: params.filter((p: any) => 'query' === p?.in).map((p: any) => p.name),
          auth: unchecked ? null : credentialSets(facts, own),
          status: success?.status ?? 200,
          sample: null == media ? null : boundedSample(fitting(sampleOf(media), media.schema)),
          idField: entity.id?.field || 'id',
        })
      }
    }
  }

  return plan
}


// The definition's name for each path parameter, keyed by the model's. The
// model may rename a placeholder, but it keeps the placeholder's place in the
// path, so position pairs each with its model name whatever `or` holds.
function pathPlaceholders(point: any): Record<string, string> {
  const orig = String(point.o || '').split('/').filter((part) => '' !== part)
  const segments = pointSegments(point)
  const out: Record<string, string> = {}
  if (orig.length !== segments.length) return out
  segments.forEach((seg: any, i: number) => {
    const m = /^\{([^}]+)\}$/.exec(orig[i])
    if (null != seg.var && null != m) out[seg.var] = m[1]
  })
  return out
}


function scalar(value: any): any {
  return 'string' === typeof value || 'number' === typeof value ? value : undefined
}


function successResponse(responses: any): { status: number, response: any } | undefined {
  if (null == responses || 'object' !== typeof responses) return undefined
  const code = Object.keys(responses).filter((c) => /^2\d\d$/.test(c)).sort()[0] ??
    (null != responses['2XX'] ? '2XX' : undefined)
  return null == code ? undefined :
    { status: '2XX' === code ? 200 : Number(code), response: responses[code] }
}


function jsonMedia(response: any): any {
  const content = response?.content
  if (null != content && 'object' === typeof content) {
    const type = Object.keys(content).find((t) => /json/i.test(t) || '*/*' === t)
    return null == type ? undefined : content[type]
  }
  // Swagger puts the schema and examples on the response itself.
  if (null != response?.schema || null != response?.examples) {
    return { schema: response.schema, example: response.examples?.['application/json'] }
  }
  return undefined
}


function sampleOf(media: any): any {
  if (undefined !== media.example) return media.example
  const named = Object.values(media.examples || {}).find((e: any) => undefined !== e?.value) as any
  if (null != named) return named.value
  if (undefined !== media.schema?.example) return media.schema.example
  return synthesize(media.schema, 0)
}


// An example whose top level contradicts its own schema proves nothing, such
// as GitHub's page of deployment rule apps written as a list of its halves.
function fitting(sample: any, schema: any): any {
  const type = Array.isArray(schema?.type) ?
    schema.type.find((t: string) => 'null' !== t) : schema?.type
  const object = 'object' === type || (null == type && null != schema?.properties)
  const array = 'array' === type || (null == type && null != schema?.items)
  if (object && (Array.isArray(sample) || null == sample || 'object' !== typeof sample)) {
    return undefined
  }
  return array && !Array.isArray(sample) ? undefined : sample
}


// Schema-shaped data where the definition gives no example: every property,
// one item per array, the first branch of a union.
function synthesize(schema: any, depth: number): any {
  if (null == schema || 'object' !== typeof schema || depth > 6) return undefined
  if (undefined !== schema.example) return schema.example
  if (Array.isArray(schema.enum) && 0 < schema.enum.length) return schema.enum[0]

  if (Array.isArray(schema.allOf)) {
    const parts = schema.allOf.map((s: any) => synthesize(s, depth + 1))
      .filter((v: any) => null != v && 'object' === typeof v && !Array.isArray(v))
    return Object.assign({}, ...parts)
  }

  const union = schema.oneOf ?? schema.anyOf
  if (Array.isArray(union) && 0 < union.length) return synthesize(union[0], depth + 1)

  const type = Array.isArray(schema.type) ?
    schema.type.find((t: string) => 'null' !== t) : schema.type

  if ('array' === type || null != schema.items) {
    const item = synthesize(schema.items, depth + 1)
    return undefined === item ? [] : [item]
  }
  if ('object' === type || null != schema.properties) {
    const out: any = {}
    for (const [key, prop] of Object.entries(schema.properties || {})) {
      const value = synthesize(prop, depth + 1)
      if (undefined !== value) out[key] = value
    }
    return out
  }
  if ('integer' === type || 'number' === type) return 1
  if ('boolean' === type) return true
  if ('string' === type) {
    return 'date-time' === schema.format ? '2026-01-01T00:00:00Z' :
      'date' === schema.format ? '2026-01-01' : 'x'
  }
  return undefined
}


function boundedSample(sample: any): any {
  const bound = (node: any, depth: number): any => {
    if (null == node || 'object' !== typeof node) return node
    if (depth > MAX_DEPTH) return null
    if (Array.isArray(node)) return node.slice(0, MAX_ITEMS).map((v) => bound(v, depth + 1))
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, bound(v, depth + 1)]))
  }
  const out = bound(sample, 0)
  return undefined === out || MAX_SAMPLE < JSON.stringify(out).length ? null : out
}


// Alternatives of credentials, every one of a set needed together. Empty is a
// public operation; null is one whose schemes no SDK option can express. Only
// those the SDK's one scheme meets count, so Petstore's OAuth pets are null.
function credentialSets(facts: any, own?: string): Credential[][] | null {
  const security = facts.security
  if (!Array.isArray(security) || 0 === security.length) return []
  if (security.some((req: any) => null == req || 0 === Object.keys(req).length)) return []

  const reqs = 'string' === typeof own && '' !== own ?
    security.filter((req: any) => Object.keys(req).every((name) => name === own)) : security
  const schemes = facts.securitySchemes || {}
  const sets: Credential[][] = []
  for (const req of reqs) {
    const set = Object.keys(req).map((name) => credentialOf(schemes[name]))
    if (set.every((c) => null != c)) sets.push(set as Credential[])
  }
  return 0 === sets.length ? null : sets
}


function credentialOf(scheme: any): Credential | undefined {
  const type = String(scheme?.type || '').toLowerCase()
  const http = String(scheme?.scheme || '').toLowerCase()

  if (('http' === type && 'basic' === http) || 'basic' === type) {
    return { in: 'header', name: 'authorization', scheme: 'basic' }
  }
  if (('http' === type && 'bearer' === http) || 'oauth2' === type || 'openidconnect' === type) {
    return { in: 'header', name: 'authorization', scheme: 'bearer' }
  }
  if ('apikey' === type && 'string' === typeof scheme.name &&
    ['header', 'query', 'cookie'].includes(scheme.in)) {
    return { in: scheme.in, name: 'header' === scheme.in ? scheme.name.toLowerCase() : scheme.name }
  }
  return undefined
}


export type {
  DefinitionPoint,
}

export {
  definitionPlan,
}
