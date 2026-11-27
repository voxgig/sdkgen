import { BufferContent } from '../content/content.js';
import { matches } from '../content/conditional.js';
import { PNG_TYPE } from '../content/png.js';
import { episodeView, findShow, removeShow, showSlot, showView, } from '../context.js';
import { notFound, preconditionFailed, requireType } from '../errors.js';
import { FEED_TYPE, renderFeed } from '../feed.js';
import { newId } from '../store/RecordStore.js';
import { sendDownload } from '../transfer.js';
const showFields = {
    name: { type: 'string', minLength: 1 },
    author: { type: 'string', minLength: 1 },
    language: { type: 'string' },
};
const createBody = {
    type: 'object',
    required: ['name', 'author'],
    properties: showFields,
    additionalProperties: false,
};
const updateBody = {
    type: 'object',
    properties: showFields,
    additionalProperties: false,
};
export default function showRoutes(ctx) {
    return async (fastify) => {
        fastify.get('/api/show', async () => ctx.shows.all().map((s) => showView(ctx, s)));
        fastify.post('/api/show', { schema: { body: createBody } }, async (request, reply) => {
            const show = ctx.shows.put({ ...request.body, id: newId() });
            return reply.code(201).send(showView(ctx, show));
        });
        fastify.get('/api/show/:show_id', async (request) => showView(ctx, findShow(ctx, request.params.show_id)));
        fastify.put('/api/show/:show_id', { schema: { body: updateBody } }, async (request) => {
            const show = ctx.shows.update(request.params.show_id, request.body);
            if (!show)
                throw notFound('Show', request.params.show_id);
            return showView(ctx, show);
        });
        fastify.delete('/api/show/:show_id', async (request, reply) => {
            removeShow(ctx, findShow(ctx, request.params.show_id));
            return reply.code(204).send();
        });
        fastify.get('/api/show/:show_id/artwork', async (request, reply) => {
            const show = findShow(ctx, request.params.show_id);
            const slot = ctx.slots.get(showSlot(show.id, 'artwork'));
            if (!slot)
                throw notFound('Artwork of show', show.id);
            return sendDownload(request, reply, slot, { ranges: false, conditional: true }, ctx.intercept);
        });
        fastify.put('/api/show/:show_id/artwork', { bodyLimit: ctx.config.limits.artwork }, async (request) => {
            const show = findShow(ctx, request.params.show_id);
            requireType(request.headers['content-type'], PNG_TYPE);
            const key = showSlot(show.id, 'artwork');
            if (!matches(request.headers['if-match'], ctx.slots.info(key)?.etag)) {
                throw preconditionFailed('If-Match does not match the current artwork');
            }
            await ctx.slots.put(key, new BufferContent(request.body, PNG_TYPE));
            return showView(ctx, show);
        });
        fastify.get('/api/show/:show_id/feed', async (request, reply) => {
            const show = findShow(ctx, request.params.show_id);
            const base = `${request.protocol}://${request.host}`;
            const episodes = ctx.episodes.ofShow(show.id).map((e) => episodeView(ctx, e));
            return reply.type(FEED_TYPE).send(renderFeed(base, showView(ctx, show), episodes));
        });
    };
}
//# sourceMappingURL=show.routes.js.map