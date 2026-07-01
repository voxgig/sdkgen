import planetRoutes from './planet.routes.js';
import moonRoutes from './moon.routes.js';
export default async function routes(fastify) {
    fastify.addSchema({
        $id: 'planet',
        type: 'object',
        properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            kind: { type: 'string' },
            diameter: { type: 'number' },
            terraformState: { type: 'string' },
            forbidState: { type: 'string' },
            forbidReason: { type: 'string' },
        },
    });
    fastify.addSchema({
        $id: 'moon',
        type: 'object',
        properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            planet_id: { type: 'string' },
            kind: { type: 'string' },
            diameter: { type: 'number' },
        },
    });
    fastify.addSchema({
        $id: 'error',
        type: 'object',
        properties: {
            error: { type: 'string' },
            message: { type: 'string' },
        },
    });
    fastify.get('/debug', async (request, reply) => {
        reply.send({
            data: {
                planet: fastify.planetStore.getAll(),
                moon: fastify.moonStore.getAll(),
            },
        });
    });
    await fastify.register(planetRoutes);
    await fastify.register(moonRoutes);
}
//# sourceMappingURL=index.js.map