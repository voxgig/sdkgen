import episodeRoutes from './episode.routes.js';
import showRoutes from './show.routes.js';
import uploadRoutes from './upload.routes.js';
export default function routes(ctx) {
    return async (fastify) => {
        await fastify.register(showRoutes(ctx));
        await fastify.register(episodeRoutes(ctx));
        await fastify.register(uploadRoutes(ctx));
    };
}
//# sourceMappingURL=index.js.map