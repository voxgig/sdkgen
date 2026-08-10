import type { FastifyInstance } from 'fastify'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSchema, graphql, GraphQLError, type GraphQLObjectType } from 'graphql'

import type { Planet, Moon } from '../types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// The SERVED schema is the same file apidef ingests as the GraphQL def
// (def/solardemo-1.0.0-graphql.graphql). Reading it here rather than
// duplicating the SDL inline is what keeps the two from drifting: if the
// schema changes, both the server and the generated SDK change together.
// Three levels up from the compiled dist/src/routes/ back to the app root,
// matching how server.ts locates solar.data.json.
const SDL_PATH = resolve(
  __dirname, '../../../def/solardemo-1.0.0-graphql.graphql')


// Relay page slice over an already-materialised array. The demo data is
// small and in-memory, so a cursor is just the id of the last node returned.
function connection<T extends { id: string }>(
  all: T[], first?: number, after?: string
) {
  let rows = all

  if (null != after) {
    const at = rows.findIndex((r) => r.id === after)
    // An unknown cursor means the row it referenced is gone (deleted between
    // pages). Restarting from the top would hand the client duplicates and a
    // bogus continuation, so end the walk instead.
    if (at < 0) {
      return { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }
    }
    rows = rows.slice(at + 1)
  }

  const limit = null == first ? rows.length : Math.max(0, first)
  const nodes = rows.slice(0, limit)

  return {
    nodes,
    pageInfo: {
      hasNextPage: nodes.length < rows.length,
      endCursor: 0 === nodes.length ? null : nodes[nodes.length - 1].id,
    },
  }
}


export default async function graphqlRoutes(fastify: FastifyInstance) {
  const schema = buildSchema(readFileSync(SDL_PATH, 'utf-8'))

  const planetStore = (fastify as any).planetStore
  const moonStore = (fastify as any).moonStore

  // Relation resolvers. buildSchema resolves scalars by property lookup,
  // which covers every field except the two that cross entities.
  const planetType = schema.getType('Planet') as GraphQLObjectType
  planetType.getFields().moons.resolve = (
    src: Planet, args: { first?: number, after?: string }
  ) => connection(moonStore.getByPlanetId(src.id), args.first, args.after)

  const moonType = schema.getType('Moon') as GraphQLObjectType
  moonType.getFields().planet.resolve =
    (src: Moon) => planetStore.getById(src.planet_id)

  const nextId = (prefix: string) =>
    prefix + '_' + Math.random().toString(36).slice(2, 10)

  // REST answers a missing id with 404. GraphQL has no status to carry that,
  // and a payload of { success: false } is invisible to a client reading
  // `errors` — which is exactly what the generated transport reads. Raise a
  // real GraphQL error so both faces report the same failure.
  const notFound = (kind: string, id: string) => new GraphQLError(
    kind + ' not found: ' + id, { extensions: { code: 'NOT_FOUND' } })

  // Partial update semantics: an omitted field is left alone. An explicit
  // null would otherwise overwrite a required field, after which selecting
  // the non-null field fails execution.
  const defined = (input: any) => {
    const out: Record<string, any> = {}
    for (const k of Object.keys(input ?? {})) {
      if (null != input[k]) {
        out[k] = input[k]
      }
    }
    return out
  }

  const root = {
    planet: ({ id }: { id: string }) => planetStore.getById(id) ?? null,

    planets: ({ filter, first, after }: any) => {
      let rows: Planet[] = planetStore.getAll()
      if (null != filter?.kind) {
        rows = rows.filter((p) => p.kind === filter.kind)
      }
      return connection(rows, first, after)
    },

    moon: ({ id }: { id: string }) => moonStore.getById(id) ?? null,

    moons: ({ planetId, first, after }: any) => connection(
      null == planetId ? moonStore.getAll() : moonStore.getByPlanetId(planetId),
      first, after),

    planetCreate: ({ input }: any) => ({
      success: true,
      planet: planetStore.create({ id: nextId('planet'), ...input }),
    }),

    planetUpdate: ({ id, input }: any) => {
      const planet = planetStore.update(id, defined(input))
      if (null == planet) {
        throw notFound('Planet', id)
      }
      return { success: true, planet }
    },

    planetDelete: ({ id }: { id: string }) => {
      const planet = planetStore.getById(id) ?? null
      if (null == planet) {
        throw notFound('Planet', id)
      }
      return { success: planetStore.delete(id), planet }
    },

    // The two command mutations, mirroring the REST action endpoints. Both
    // return the resulting state alongside the entity.
    planetTerraform: ({ id, start, stop }: any) => {
      const current = planetStore.getById(id)
      if (null == current) {
        throw notFound('Planet', id)
      }

      // Neither flag set leaves the state as it was, as the REST handler
      // does — forcing 'idle' would stop an in-progress terraform.
      const state = true === start ? 'terraforming' :
        true === stop ? 'idle' : (current.terraformState || 'idle')

      const planet = planetStore.update(id, { terraformState: state })
      return { success: true, state, planet: planet ?? null }
    },

    planetForbid: ({ id, forbid, why }: any) => {
      if (null == planetStore.getById(id)) {
        throw notFound('Planet', id)
      }

      const state = false === forbid ? 'allowed' : 'forbidden'
      const planet = planetStore.update(id, {
        forbidState: state,
        forbidReason: why,
      })
      return { success: true, state, planet: planet ?? null }
    },

    moonCreate: ({ input }: any) => {
      const { planetId, ...rest } = input

      // The REST create checks the parent first. Without this the store
      // holds a dangling moon whose non-null Moon.planet fails execution.
      if (null == planetStore.getById(planetId)) {
        throw notFound('Planet', planetId)
      }

      return {
        success: true,
        moon: moonStore.create({
          id: nextId('moon'), planet_id: planetId, ...rest,
        }),
      }
    },

    moonUpdate: ({ id, input }: any) => {
      const moon = moonStore.update(id, defined(input))
      if (null == moon) {
        throw notFound('Moon', id)
      }
      return { success: true, moon }
    },

    moonDelete: ({ id }: { id: string }) => {
      const moon = moonStore.getById(id) ?? null
      if (null == moon) {
        throw notFound('Moon', id)
      }
      return { success: moonStore.delete(id), moon }
    },
  }

  fastify.post('/api/graphql', async (request, reply) => {
    const { query, variables, operationName } = (request.body ?? {}) as any

    if ('string' !== typeof query) {
      // A malformed request is a GraphQL-level error, not a transport one:
      // clients read `errors`, so keep the envelope shape consistent.
      return reply.status(400).send({
        errors: [{ message: 'query must be a string' }],
      })
    }

    const result = await graphql({
      schema,
      source: query,
      rootValue: root,
      variableValues: variables ?? undefined,
      operationName: operationName ?? undefined,
    })

    // GraphQL reports execution failures in the body under HTTP 200; only a
    // request that could not be run at all gets a 4xx.
    return reply.status(null == result.data ? 400 : 200).send(result)
  })
}
