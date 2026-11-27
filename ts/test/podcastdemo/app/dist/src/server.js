import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { registerBearer } from './auth.js';
import { LOOPBACK_HOSTS, loadConfig } from './config.js';
import { BufferContent } from './content/content.js';
import { generatePng, PNG_TYPE } from './content/png.js';
import { GeneratedWav } from './content/wav.js';
import { episodeSlot, makeContext, showSlot } from './context.js';
import routes from './routes/index.js';
import { OFFSET_TYPE } from './routes/upload.routes.js';
import { VTT_TYPE } from './routes/episode.routes.js';
function appRoot() {
    let dir = dirname(fileURLToPath(import.meta.url));
    while (!existsSync(resolve(dir, 'package.json')))
        dir = dirname(dir);
    return dir;
}
export const DEFAULT_DATA_PATH = resolve(appRoot(), 'podcast.data.json');
const RAW_TYPES = ['audio/wav', PNG_TYPE, VTT_TYPE, OFFSET_TYPE];
const STATUS_NAMES = {
    400: 'ValidationError',
    404: 'NotFoundError',
    413: 'ContentTooLarge',
    415: 'UnsupportedMediaType',
};
async function loadSeed(ctx, path) {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    for (const { artwork, ...show } of Object.values(data.show)) {
        ctx.shows.put(show);
        if (artwork) {
            const png = generatePng(artwork.seed, artwork.width, artwork.height);
            await ctx.slots.put(showSlot(show.id, 'artwork'), new BufferContent(png, PNG_TYPE));
        }
    }
    for (const { audio, transcript, state, ...episode } of Object.values(data.episode)) {
        ctx.episodes.put({ ...episode, state: state ?? 'draft' });
        await ctx.slots.put(episodeSlot(episode.id, 'audio'), new GeneratedWav(audio.seed, audio.size));
        if (undefined !== transcript) {
            await ctx.slots.put(episodeSlot(episode.id, 'transcript'), new BufferContent(Buffer.from(transcript, 'utf-8'), VTT_TYPE));
        }
    }
}
export async function buildApp(options = {}) {
    const base = loadConfig();
    const config = {
        ...base,
        ...options.config,
        limits: { ...base.limits, ...options.config?.limits },
    };
    const ctx = makeContext(config, options.intercept);
    await loadSeed(ctx, config.dataPath ?? DEFAULT_DATA_PATH);
    const fastify = Fastify({
        logger: { level: config.logLevel },
        exposeHeadRoutes: false,
    });
    fastify.setErrorHandler((error, request, reply) => {
        const err = error;
        if (err.headers && 'object' === typeof err.headers)
            reply.headers(err.headers);
        if (err.validation) {
            return reply.status(400).send({ error: 'ValidationError', message: err.message });
        }
        if ('number' === typeof err.statusCode && err.statusCode < 500) {
            const name = 'FastifyError' === err.name ? (STATUS_NAMES[err.statusCode] ?? err.name) : err.name;
            return reply.status(err.statusCode).send({ error: name, message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ error: 'InternalServerError', message: 'Internal error' });
    });
    fastify.setNotFoundHandler((request, reply) => reply.status(404).send({ error: 'NotFoundError', message: `No route ${request.method} ${request.url}` }));
    registerBearer(fastify, config.token);
    if (ctx.intercept.request) {
        const intercept = ctx.intercept.request;
        fastify.addHook('preHandler', async (request, reply) => {
            if (await intercept(request, reply))
                return reply;
        });
    }
    fastify.addContentTypeParser(RAW_TYPES, { parseAs: 'buffer' }, (_request, body, done) => done(null, body));
    // A DELETE that declares JSON and sends nothing is read as an empty object.
    fastify.addHook('preParsing', async (request, _reply, payload) => {
        if ('DELETE' !== request.method || !request.headers['content-type']?.includes('json')) {
            return payload;
        }
        const chunks = [];
        for await (const chunk of payload) {
            chunks.push('string' === typeof chunk ? Buffer.from(chunk) : chunk);
        }
        const body = Buffer.concat(chunks).toString().trim();
        return Readable.from(Buffer.from('' === body ? '{}' : body));
    });
    await fastify.register(multipart, {
        // A client may withhold the file name; the audio part is a file regardless.
        isPartAFile: (fieldName, contentType, fileName) => undefined !== fileName || 'audio' === fieldName || 'application/octet-stream' === contentType,
        limits: {
            fileSize: config.limits.audio,
            files: 1,
            fields: 2,
            parts: 3,
            fieldSize: 4096,
            fieldNameSize: 100,
            headerPairs: 100,
        },
    });
    await fastify.register(routes(ctx));
    return { fastify, ctx };
}
export async function build(options = {}) {
    return (await buildApp(options)).fastify;
}
export async function main() {
    const config = loadConfig();
    if (!LOOPBACK_HOSTS.has(config.host)) {
        throw new Error(`Refusing to listen on ${config.host}: only a loopback host is allowed`);
    }
    const fastify = await build({ config });
    await fastify.listen({ host: config.host, port: config.port });
    console.log(`Base URL: http://${config.host}:${config.port}`);
}
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=server.js.map