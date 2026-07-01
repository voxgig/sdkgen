import type { FastifyInstance } from 'fastify'
import { planetHandlers } from '../handlers/planet.handlers.js'
import { planetSchemas } from '../schemas/planet.schemas.js'

export default async function planetRoutes(fastify: FastifyInstance) {
  fastify.get('/api/planet', { schema: planetSchemas.list }, planetHandlers.list)

  fastify.get(
    '/api/planet/:planet_id',
    { schema: planetSchemas.get },
    planetHandlers.get
  )

  fastify.post(
    '/api/planet',
    { schema: planetSchemas.create },
    planetHandlers.create
  )

  fastify.put(
    '/api/planet/:planet_id',
    { schema: planetSchemas.update },
    planetHandlers.update
  )

  fastify.delete(
    '/api/planet/:planet_id',
    { schema: planetSchemas.delete },
    planetHandlers.delete
  )

  fastify.post(
    '/api/planet/:planet_id/terraform',
    { schema: planetSchemas.terraform },
    planetHandlers.terraform
  )

  fastify.post(
    '/api/planet/:planet_id/forbid',
    { schema: planetSchemas.forbid },
    planetHandlers.forbid
  )
}
