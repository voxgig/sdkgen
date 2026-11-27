import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { after, before, describe, test } from 'node:test';
import { bytesOf, reprOf, start, wavFile } from '../helpers.js';
const TUS = { 'tus-resumable': '1.0.0' };
describe('tus upload sessions', () => {
    let app;
    before(async () => {
        app = await start({ config: { limits: { audio: 4096, transcript: 64, sessions: 3 } } });
    });
    after(() => app.close());
    const open = (body) => app.call('/api/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ show_id: 'studio', episode_id: 'longform', ...body }),
    });
    const offsetOf = async (id) => {
        const res = await app.call(`/api/upload/${id}`, { method: 'HEAD', headers: TUS });
        strictEqual(res.status, 200);
        strictEqual(res.headers.get('tus-resumable'), '1.0.0');
        strictEqual(res.headers.get('cache-control'), 'no-store');
        return { offset: Number(res.headers.get('upload-offset')), length: res.headers.get('upload-length') };
    };
    const append = (id, offset, body, headers = {}) => app.call(`/api/upload/${id}`, {
        method: 'PATCH',
        body,
        headers: {
            ...TUS,
            'content-type': 'application/offset+octet-stream',
            'upload-offset': String(offset),
            ...headers,
        },
    });
    const close = (id) => app.call(`/api/upload/${id}`, { method: 'DELETE' });
    test('create, append in pieces, read the offset after each, complete', async () => {
        const file = wavFile(3000, 3);
        const created = await open({ size: file.length, digest: reprOf(file) });
        strictEqual(created.status, 201);
        const upload = await created.json();
        strictEqual(created.headers.get('location'), `/api/upload/${upload.id}`);
        deepStrictEqual({ slot: upload.slot, type: upload.type, offset: upload.offset, complete: upload.complete }, { slot: 'audio', type: 'audio/wav', offset: 0, complete: false });
        ok(Date.parse(upload.expires) > Date.now());
        deepStrictEqual(await offsetOf(upload.id), { offset: 0, length: '3000' });
        let at = 0;
        for (const size of [1, 999, 0, 1500, 500]) {
            const res = await append(upload.id, at, file.subarray(at, at + size));
            strictEqual(res.status, 204);
            at += size;
            strictEqual(res.headers.get('upload-offset'), String(at));
            strictEqual(res.headers.get('tus-resumable'), '1.0.0');
            strictEqual((await offsetOf(upload.id)).offset, at);
        }
        const loaded = await (await app.call(`/api/upload/${upload.id}`)).json();
        strictEqual(loaded.complete, true);
        strictEqual(loaded.offset, 3000);
        const audio = await app.call('/api/show/studio/episode/longform/audio');
        ok((await bytesOf(audio)).equals(file));
        strictEqual(audio.headers.get('repr-digest'), reprOf(file));
        strictEqual((await append(upload.id, 3000, Buffer.alloc(0))).status, 204);
        strictEqual((await append(upload.id, 3000, Buffer.alloc(1))).status, 413);
        strictEqual((await close(upload.id)).status, 204);
        strictEqual((await close(upload.id)).status, 404);
        strictEqual((await app.call(`/api/upload/${upload.id}`)).status, 404);
    });
    test('the protocol rules of the append', async () => {
        const upload = await (await open({ size: 10 })).json();
        const conflict = await append(upload.id, 5, Buffer.alloc(2));
        strictEqual(conflict.status, 409);
        strictEqual(conflict.headers.get('upload-offset'), '0');
        const noVersion = await app.call(`/api/upload/${upload.id}`, {
            method: 'PATCH',
            body: Buffer.alloc(2),
            headers: { 'content-type': 'application/offset+octet-stream', 'upload-offset': '0' },
        });
        strictEqual(noVersion.status, 412);
        strictEqual(noVersion.headers.get('tus-version'), '1.0.0');
        strictEqual((await app.call(`/api/upload/${upload.id}`, { method: 'HEAD', headers: { 'tus-resumable': '0.2.2' } })).status, 412);
        strictEqual((await append(upload.id, 0, Buffer.alloc(2), { 'content-type': 'application/octet-stream' })).status, 415);
        strictEqual((await append(upload.id, 0, Buffer.alloc(2), { 'upload-offset': '-1' })).status, 400);
        strictEqual((await append(upload.id, 0, Buffer.alloc(11))).status, 413);
        strictEqual((await offsetOf(upload.id)).offset, 0);
        strictEqual((await append('missing', 0, Buffer.alloc(1))).status, 404);
        strictEqual((await app.call('/api/upload/missing', { method: 'HEAD', headers: TUS })).status, 404);
        await close(upload.id);
    });
    test('a digest mismatch at completion restarts the session', async () => {
        const before = await (await app.call('/api/show/studio/episode/longform')).json();
        const upload = await (await open({ size: 4, digest: reprOf(Buffer.from('good')) })).json();
        const res = await append(upload.id, 0, Buffer.from('evil'));
        strictEqual(res.status, 400);
        strictEqual((await offsetOf(upload.id)).offset, 0);
        const after = await (await app.call('/api/show/studio/episode/longform')).json();
        deepStrictEqual(after.audio, before.audio);
        strictEqual((await append(upload.id, 0, Buffer.from('good'))).status, 204);
        await close(upload.id);
    });
    test('a transcript upload fills the transcript slot', async () => {
        const text = Buffer.from('WEBVTT\n\nhi\n');
        const upload = await (await open({ slot: 'transcript', size: text.length })).json();
        strictEqual(upload.type, 'text/vtt');
        strictEqual((await append(upload.id, 0, text)).status, 204);
        strictEqual(await (await app.call('/api/show/studio/episode/longform/transcript')).text(), text.toString());
        await close(upload.id);
    });
    test('create is bounded and checked', async () => {
        strictEqual((await open({ size: 4097 })).status, 413);
        strictEqual((await open({ slot: 'transcript', size: 65 })).status, 413);
        strictEqual((await open({ size: 0 })).status, 400);
        strictEqual((await open({ size: 10, type: 'image/png' })).status, 400);
        strictEqual((await open({ size: 10, digest: 'not a digest' })).status, 400);
        strictEqual((await open({ size: 10, slot: 'artwork' })).status, 400);
        strictEqual((await open({ size: 10, episode_id: 'nope' })).status, 404);
        const ids = [];
        for (let i = 0; i < 3; i++) {
            const res = await open({ size: 10 });
            strictEqual(res.status, 201);
            ids.push((await res.json()).id);
        }
        strictEqual((await open({ size: 10 })).status, 429);
        for (const id of ids)
            await close(id);
        strictEqual((await open({ size: 10, id: 'chosen', offset: 5 })).status, 201);
    });
    test('removing the episode removes its sessions', async () => {
        const form = new FormData();
        form.set('title', 'Doomed');
        form.set('audio', new Blob([new Uint8Array(wavFile(50))], { type: 'audio/wav' }), 'a.wav');
        const ep = await (await app.call('/api/show/studio/episode', { method: 'POST', body: form })).json();
        const upload = await (await open({ episode_id: ep.id, size: 10 })).json();
        strictEqual((await app.call(`/api/show/studio/episode/${ep.id}`, { method: 'DELETE' })).status, 204);
        strictEqual((await app.call(`/api/upload/${upload.id}`)).status, 404);
    });
});
//# sourceMappingURL=upload.integration.test.js.map