import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { request as httpRequest } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { collect } from '../../src/content/content.js';
import { GeneratedWav } from '../../src/content/wav.js';
import { bytesOf, reprOf, sha256, start, wavFile } from '../helpers.js';
const PILOT = '/api/show/studio/episode/pilot/audio';
const LONG = '/api/show/studio/episode/longform/audio';
describe('episode audio', () => {
    let app;
    let pilot;
    before(async () => {
        app = await start({ config: { limits: { audio: 4096 } } });
        pilot = await collect(new GeneratedWav(1, 1048620).read(0, 1048620));
    });
    after(() => app.close());
    test('GET serves the whole file with its validators and digest', async () => {
        const res = await app.call(PILOT);
        strictEqual(res.status, 200);
        const body = await bytesOf(res);
        ok(body.equals(pilot));
        strictEqual(res.headers.get('content-type'), 'audio/wav');
        strictEqual(res.headers.get('content-length'), '1048620');
        strictEqual(res.headers.get('accept-ranges'), 'bytes');
        strictEqual(res.headers.get('repr-digest'), reprOf(body));
        strictEqual(res.headers.get('content-disposition'), 'attachment; filename="pilot.wav"');
        ok(/^"[A-Za-z0-9_-]+"$/.test(res.headers.get('etag')));
        strictEqual(res.headers.get('content-encoding'), null);
    });
    test('a generated slot of any size streams and digests', async () => {
        const res = await app.call(LONG);
        strictEqual(res.status, 200);
        const body = await bytesOf(res);
        strictEqual(body.length, 16777260);
        strictEqual(res.headers.get('repr-digest'), reprOf(body));
        strictEqual(body.toString('ascii', 0, 4), 'RIFF');
    });
    for (const [range, start, end] of [
        ['bytes=0-99', 0, 99],
        ['bytes=1048600-', 1048600, 1048619],
        ['bytes=-20', 1048600, 1048619],
        ['bytes=500000-500000', 500000, 500000],
        ['bytes=1048000-99999999', 1048000, 1048619],
    ]) {
        test(`Range ${range} is a 206 of exactly those bytes`, async () => {
            const res = await app.call(PILOT, { headers: { range } });
            strictEqual(res.status, 206);
            strictEqual(res.headers.get('content-range'), `bytes ${start}-${end}/1048620`);
            strictEqual(res.headers.get('content-length'), String(end - start + 1));
            strictEqual(res.headers.get('repr-digest'), reprOf(pilot));
            ok((await bytesOf(res)).equals(pilot.subarray(start, end + 1)));
        });
    }
    test('an unsatisfiable range is 416 with the size', async () => {
        for (const range of ['bytes=1048620-', 'bytes=-0']) {
            const res = await app.call(PILOT, { headers: { range } });
            strictEqual(res.status, 416);
            strictEqual(res.headers.get('content-range'), 'bytes */1048620');
            strictEqual((await res.json()).error, 'RangeNotSatisfiable');
        }
    });
    test('a range this server does not serve is ignored, not refused', async () => {
        for (const range of ['bytes=0-1,5-6', 'bytes=9-0', 'lines=1-2']) {
            const res = await app.call(PILOT, { headers: { range } });
            strictEqual(res.status, 200, range);
            strictEqual((await bytesOf(res)).length, 1048620);
        }
    });
    test('If-Range honours the range only for the current strong tag', async () => {
        const etag = (await app.call(PILOT, { method: 'HEAD' })).headers.get('etag');
        const same = await app.call(PILOT, { headers: { range: 'bytes=0-9', 'if-range': etag } });
        strictEqual(same.status, 206);
        ok((await bytesOf(same)).equals(pilot.subarray(0, 10)));
        for (const ifRange of [`W/${etag}`, '"other"', 'Fri, 27 Nov 2026 00:00:00 GMT']) {
            const res = await app.call(PILOT, { headers: { range: 'bytes=0-9', 'if-range': ifRange } });
            strictEqual(res.status, 200, ifRange);
            strictEqual((await bytesOf(res)).length, 1048620);
        }
    });
    test('If-None-Match answers 304 for the current tag, weak or strong', async () => {
        const etag = (await app.call(PILOT, { method: 'HEAD' })).headers.get('etag');
        for (const inm of [etag, `W/${etag}`, `"x", ${etag}`, '*']) {
            const res = await app.call(PILOT, { headers: { 'if-none-match': inm } });
            strictEqual(res.status, 304, inm);
            strictEqual(res.headers.get('etag'), etag);
            strictEqual((await bytesOf(res)).length, 0);
        }
        strictEqual((await app.call(PILOT, { headers: { 'if-none-match': '"x"' } })).status, 200);
        strictEqual((await app.call(PILOT, { method: 'HEAD', headers: { 'if-none-match': etag } })).status, 304);
    });
    test('HEAD sends the GET headers, the length, and no body', async () => {
        const got = await new Promise((ok, fail) => {
            const url = new URL(app.base + PILOT);
            const req = httpRequest(url, { method: 'HEAD', headers: { authorization: 'Bearer podcastdemo-local-token' } }, (res) => {
                const chunks = [];
                res.on('data', (c) => chunks.push(c));
                res.on('end', () => ok({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
            });
            req.on('error', fail);
            req.end();
        });
        strictEqual(got.status, 200);
        strictEqual(got.headers['content-length'], '1048620');
        strictEqual(got.headers['repr-digest'], reprOf(pilot));
        strictEqual(got.headers['accept-ranges'], 'bytes');
        strictEqual(got.body.length, 0);
        strictEqual((await app.call(PILOT.replace('pilot', 'nope'), { method: 'HEAD' })).status, 404);
    });
    test('PUT replaces the audio, guarded by If-Match and Repr-Digest', async () => {
        const path = '/api/show/studio/episode/longform/audio';
        const before = await app.call(path, { method: 'HEAD' });
        const etag = before.headers.get('etag');
        const put = (body, headers = {}) => app.call(path, { method: 'PUT', body, headers: { 'content-type': 'audio/wav', ...headers } });
        const file = wavFile(1000);
        strictEqual((await put(file, { 'if-match': '"stale"' })).status, 412);
        strictEqual((await put(file, { 'repr-digest': reprOf(Buffer.from('x')) })).status, 400);
        strictEqual((await put(file, { 'repr-digest': 'sha-256=nope' })).status, 400);
        const res = await put(file, { 'if-match': etag, 'repr-digest': reprOf(file) });
        strictEqual(res.status, 200);
        const episode = await res.json();
        strictEqual(episode.audio.size, 1000);
        strictEqual(episode.audio.digest, reprOf(file));
        ok(episode.audio.etag !== etag);
        const got = await app.call(path);
        ok((await bytesOf(got)).equals(file));
        strictEqual(got.headers.get('etag'), episode.audio.etag);
        deepStrictEqual(sha256(file), Buffer.from(reprOf(file).slice(9, -1), 'base64'));
        strictEqual((await put(wavFile(10), { 'if-match': '*', 'repr-digest': 'md5=:AAAA:' })).status, 200);
        strictEqual((await put(wavFile(10), { 'if-match': etag })).status, 412);
    });
    test('PUT refuses another media type and a body over the cap', async () => {
        const res = await app.call(PILOT, {
            method: 'PUT',
            body: Buffer.alloc(10),
            headers: { 'content-type': 'image/png' },
        });
        strictEqual(res.status, 415);
        strictEqual((await app.call(PILOT, {
            method: 'PUT',
            body: Buffer.alloc(10),
            headers: { 'content-type': 'application/octet-stream' },
        })).status, 415);
        const big = await app.call(PILOT, {
            method: 'PUT',
            body: Buffer.alloc(4097),
            headers: { 'content-type': 'audio/wav' },
        });
        strictEqual(big.status, 413);
        strictEqual((await big.json()).error, 'ContentTooLarge');
        strictEqual((await app.call(PILOT)).headers.get('content-length'), '1048620');
    });
});
//# sourceMappingURL=audio.integration.test.js.map