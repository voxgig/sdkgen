import { ok, strictEqual } from 'node:assert';
import { after, before, describe, test } from 'node:test';
import { inflateSync } from 'node:zlib';
import { generatePng, PNG_SIGNATURE } from '../../src/content/png.js';
import { bytesOf, reprOf, start } from '../helpers.js';
const ART = '/api/show/studio/artwork';
const VTT = '/api/show/studio/episode/pilot/transcript';
describe('artwork and transcript', () => {
    let app;
    before(async () => {
        app = await start({ config: { limits: { artwork: 256, transcript: 128 } } });
    });
    after(() => app.close());
    test('artwork is a generated PNG with validators', async () => {
        const res = await app.call(ART);
        strictEqual(res.status, 200);
        strictEqual(res.headers.get('content-type'), 'image/png');
        const png = await bytesOf(res);
        ok(png.subarray(0, 8).equals(PNG_SIGNATURE));
        ok(png.equals(generatePng(7, 32, 32)));
        strictEqual(res.headers.get('repr-digest'), reprOf(png));
        strictEqual(res.headers.get('content-length'), String(png.length));
        strictEqual(res.headers.get('accept-ranges'), null);
        const idat = png.indexOf('IDAT');
        ok(inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4))).length > 0);
        const again = await app.call(ART, { headers: { 'if-none-match': res.headers.get('etag') } });
        strictEqual(again.status, 304);
    });
    test('a show without artwork answers 404', async () => {
        strictEqual((await app.call('/api/show/quiet/artwork')).status, 404);
    });
    test('artwork PUT replaces it, guarded and bounded', async () => {
        const png = generatePng(1, 2, 2);
        const put = (body, headers = {}) => app.call('/api/show/quiet/artwork', {
            method: 'PUT',
            body,
            headers: { 'content-type': 'image/png', ...headers },
        });
        strictEqual((await put(png, { 'if-match': '*' })).status, 412);
        const res = await put(png);
        strictEqual(res.status, 200);
        const show = await res.json();
        strictEqual(show.artwork.size, png.length);
        strictEqual(show.artwork.type, 'image/png');
        ok((await bytesOf(await app.call('/api/show/quiet/artwork'))).equals(png));
        strictEqual((await put(png, { 'if-match': show.artwork.etag })).status, 200);
        strictEqual((await put(Buffer.alloc(257))).status, 413);
        strictEqual((await app.call('/api/show/quiet/artwork', {
            method: 'PUT',
            body: png,
            headers: { 'content-type': 'audio/wav' },
        })).status, 415);
    });
    test('transcript is text, read and replaced whole', async () => {
        const res = await app.call(VTT);
        strictEqual(res.status, 200);
        strictEqual(res.headers.get('content-type'), 'text/vtt; charset=utf-8');
        ok((await res.text()).startsWith('WEBVTT'));
        const text = 'WEBVTT\n\n00:00.000 --> 00:01.000\nÉté ✓\n';
        const put = await app.call(VTT, {
            method: 'PUT',
            body: text,
            headers: { 'content-type': 'text/vtt; charset=utf-8' },
        });
        strictEqual(put.status, 200);
        const episode = await put.json();
        strictEqual(episode.transcript.size, Buffer.byteLength(text));
        strictEqual(await (await app.call(VTT)).text(), text);
        strictEqual((await app.call(VTT, {
            method: 'PUT',
            body: 'x'.repeat(129),
            headers: { 'content-type': 'text/vtt' },
        })).status, 413);
        strictEqual((await app.call(VTT, { method: 'PUT', body: text, headers: { 'content-type': 'text/plain' } })).status, 415);
        strictEqual((await app.call('/api/show/studio/episode/longform/transcript')).status, 404);
    });
});
describe('the download seam', () => {
    test('an intercept sees and can alter a download', async () => {
        const seen = [];
        const app = await start({
            intercept: {
                download(event) {
                    seen.push(`${event.request.method} ${event.download.status}`);
                    event.download.headers['x-seen'] = 'yes';
                    return event;
                },
                async request(request, reply) {
                    if ('teapot' !== request.headers['x-answer'])
                        return false;
                    reply.code(418).send({ error: 'Teapot', message: 'answered early' });
                    return true;
                },
            },
        });
        try {
            const res = await app.call(ART);
            strictEqual(res.headers.get('x-seen'), 'yes');
            await bytesOf(res);
            strictEqual((await app.call(ART, { headers: { 'x-answer': 'teapot' } })).status, 418);
            strictEqual(seen.join(','), 'GET 200');
        }
        finally {
            await app.close();
        }
    });
});
//# sourceMappingURL=files.integration.test.js.map