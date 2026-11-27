import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpError } from './errors.js';
const digestOf = (text) => createHash('sha256').update(text).digest();
export function bearerMatches(header, token) {
    const m = /^Bearer[ ]+(\S+)\s*$/i.exec(header ?? '');
    return null != m && timingSafeEqual(digestOf(m[1]), digestOf(token));
}
export function registerBearer(fastify, token) {
    fastify.addHook('onRequest', async (request) => {
        // The matched route decides, not the raw URL, so an encoded path cannot
        // slip past; an unmatched request is challenged too.
        const route = request.routeOptions.url;
        if (undefined != route && !route.startsWith('/api/'))
            return;
        if (!bearerMatches(request.headers.authorization, token)) {
            throw new HttpError(401, 'Unauthorized', 'A valid bearer credential is required', {
                'www-authenticate': 'Bearer realm="podcastdemo"',
            });
        }
    });
}
//# sourceMappingURL=auth.js.map