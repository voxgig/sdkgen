import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import episodeRoutes from './episode.routes.js'
import showRoutes from './show.routes.js'
import uploadRoutes from './upload.routes.js'

export default function routes(ctx: AppContext) {
  return async (fastify: FastifyInstance) => {
    await fastify.register(showRoutes(ctx))
    await fastify.register(episodeRoutes(ctx))
    await fastify.register(uploadRoutes(ctx))
  }
}
