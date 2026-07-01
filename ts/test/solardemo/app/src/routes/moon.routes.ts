import type { FastifyInstance } from 'fastify'
import { moonHandlers } from '../handlers/moon.handlers.js'
import { moonSchemas } from '../schemas/moon.schemas.js'

export default async function moonRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/planet/:planet_id/moon',
    { schema: moonSchemas.list },
    moonHandlers.list
  )

  fastify.get(
    '/api/planet/:planet_id/moon/:moon_id',
    { schema: moonSchemas.get },
    moonHandlers.get
  )

  fastify.post(
    '/api/planet/:planet_id/moon',
    { schema: moonSchemas.create },
    moonHandlers.create
  )

  fastify.put(
    '/api/planet/:planet_id/moon/:moon_id',
    { schema: moonSchemas.update },
    moonHandlers.update
  )

  fastify.delete(
    '/api/planet/:planet_id/moon/:moon_id',
    { schema: moonSchemas.delete },
    moonHandlers.delete
  )
}
