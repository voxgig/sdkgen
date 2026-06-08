import Fastify from 'fastify';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { config } from './config.js';
import { PlanetStore } from './store/PlanetStore.js';
import { MoonStore } from './store/MoonStore.js';
import routes from './routes/index.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export async function build() {
    const fastify = Fastify({
        logger: config.logging,
    });
    fastify.setErrorHandler((error, request, reply) => {
        const err = error;
        if ('statusCode' in err && typeof err.statusCode === 'number') {
            reply.status(err.statusCode).send({
                error: err.name,
                message: err.message,
            });
        }
        else if ('validation' in err) {
            reply.status(400).send({
                error: 'Validation Error',
                message: err.message,
            });
        }
        else {
            request.log.error(err);
            reply.status(500).send({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });
    const dataPath = resolve(__dirname, '../../solar.data.json');
    const rawData = JSON.parse(readFileSync(dataPath, 'utf-8'));
    const moonStore = new MoonStore();
    const planetStore = new PlanetStore(moonStore);
    Object.values(rawData.planet).forEach((p) => planetStore.create(p));
    Object.values(rawData.moon).forEach((m) => moonStore.create(m));
    fastify.decorate('planetStore', planetStore);
    fastify.decorate('moonStore', moonStore);
    fastify.addHook('preParsing', async (request, _reply, payload) => {
        if (request.method === 'DELETE' &&
            request.headers['content-type']?.includes('application/json')) {
            const chunks = [];
            for await (const chunk of payload) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const body = Buffer.concat(chunks).toString().trim();
            if (body === '') {
                return Readable.from(Buffer.from('{}'));
            }
            return Readable.from(Buffer.from(body));
        }
        return payload;
    });
    await fastify.register(routes);
    return fastify;
}
export async function main() {
    const fastify = await build();
    try {
        await fastify.listen({
            host: config.server.host,
            port: config.server.port,
        });
        console.log(`Base URL: http://${config.server.host}:${config.server.port}`);
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
//# sourceMappingURL=server.js.map