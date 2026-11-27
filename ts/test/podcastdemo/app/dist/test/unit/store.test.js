import { deepStrictEqual, notStrictEqual, ok, strictEqual } from 'node:assert';
import { describe, test } from 'node:test';
import { BufferContent } from '../../src/content/content.js';
import { escapeXml, renderFeed } from '../../src/feed.js';
import { EpisodeStore, newId, ShowStore } from '../../src/store/RecordStore.js';
import { SlotStore, slotKey } from '../../src/store/SlotStore.js';
import { UploadStore } from '../../src/store/UploadStore.js';
describe('SlotStore', () => {
    test('records metadata beside the bytes and deletes by prefix', async () => {
        const slots = new SlotStore();
        const when = new Date('2026-01-02T03:04:05.000Z');
        const info = await slots.put(slotKey('episode', 'e1', 'audio'), new BufferContent(Buffer.from('abc'), 'audio/wav'), when);
        deepStrictEqual(Object.keys(info).sort(), ['digest', 'etag', 'modified', 'size', 'type']);
        strictEqual(info.size, 3);
        strictEqual(info.modified, when.toISOString());
        strictEqual(info.digest, 'sha-256=:ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=:');
        await slots.put(slotKey('episode', 'e1', 'transcript'), new BufferContent(Buffer.from(''), 'text/vtt'));
        await slots.put(slotKey('episode', 'e10', 'audio'), new BufferContent(Buffer.from('x'), 'audio/wav'));
        strictEqual(slots.deletePrefix(slotKey('episode', 'e1', '')), 2);
        strictEqual(slots.count, 1);
        ok(slots.info(slotKey('episode', 'e10', 'audio')));
    });
});
describe('records', () => {
    test('identifiers are generated and distinct', () => {
        const ids = new Set(Array.from({ length: 50 }, newId));
        strictEqual(ids.size, 50);
        for (const id of ids)
            ok(/^[A-Za-z0-9_-]{12}$/.test(id));
    });
    test('shows update in place and keep their id', () => {
        const shows = new ShowStore();
        shows.put({ id: 's', name: 'A', author: 'B' });
        deepStrictEqual(shows.update('s', { name: 'C' }), { id: 's', name: 'C', author: 'B' });
        strictEqual(shows.update('nope', { name: 'C' }), undefined);
        ok(shows.delete('s'));
        strictEqual(shows.all().length, 0);
    });
    test('an episode is found only beneath its own show', () => {
        const episodes = new EpisodeStore();
        episodes.put({ id: 'e', show_id: 's1', title: 'T', state: 'draft' });
        ok(episodes.get('s1', 'e'));
        strictEqual(episodes.get('s2', 'e'), undefined);
        strictEqual(episodes.delete('s2', 'e'), false);
        strictEqual(episodes.update('s1', 'e', { title: 'U' })?.show_id, 's1');
    });
});
describe('UploadStore', () => {
    const spec = {
        show_id: 's',
        episode_id: 'e',
        slot: 'audio',
        size: 10,
        type: 'audio/wav',
    };
    test('appends in pieces at the current offset and completes', () => {
        const uploads = new UploadStore(60_000);
        const u = uploads.create(spec);
        strictEqual(u.offset, 0);
        strictEqual(u.complete, false);
        ok(!('chunks' in u));
        deepStrictEqual(uploads.append(u.id, 0, Buffer.from('0123')), {
            kind: 'appended',
            upload: { ...u, offset: 4 },
        });
        deepStrictEqual(uploads.append(u.id, 0, Buffer.from('x')), { kind: 'conflict', offset: 4 });
        deepStrictEqual(uploads.append(u.id, 4, Buffer.from('4567890')), { kind: 'too-large' });
        const done = uploads.append(u.id, 4, Buffer.from('456789'));
        strictEqual(done.kind, 'complete');
        if ('complete' === done.kind) {
            strictEqual(done.bytes.toString(), '0123456789');
            strictEqual(done.upload.complete, true);
        }
        strictEqual(uploads.append('missing', 0, Buffer.alloc(0)), undefined);
    });
    test('restart returns to offset zero', () => {
        const uploads = new UploadStore(60_000);
        const u = uploads.create(spec);
        uploads.append(u.id, 0, Buffer.from('0123456789'));
        uploads.restart(u.id);
        deepStrictEqual(uploads.get(u.id)?.offset, 0);
        strictEqual(uploads.get(u.id)?.complete, false);
    });
    test('an expired session is gone', () => {
        const uploads = new UploadStore(1000);
        const u = uploads.create(spec, 0);
        notStrictEqual(uploads.get(u.id, 999), undefined);
        strictEqual(uploads.get(u.id, 1000), undefined);
        strictEqual(uploads.count(1000), 0);
    });
});
describe('feed', () => {
    test('escapes markup and lists only published episodes', () => {
        strictEqual(escapeXml(`<a href="x">&'\u0001`), '&lt;a href=&quot;x&quot;&gt;&amp;&apos;');
        const info = { size: 9, type: 'audio/wav', etag: '"t"', digest: 'd', modified: 'm' };
        const xml = renderFeed('http://h', { id: 's', name: 'S & T', author: '<A>' }, [
            { id: 'b', show_id: 's', title: 'Two', number: 2, state: 'published', audio: info },
            { id: 'a', show_id: 's', title: 'One', number: 1, state: 'published', audio: info },
            { id: 'c', show_id: 's', title: 'Hidden', state: 'draft', audio: info },
        ]);
        ok(xml.includes('<title>S &amp; T</title>'));
        ok(xml.includes('S &amp; T, by &lt;A&gt;'));
        ok(xml.indexOf('One') < xml.indexOf('Two'));
        ok(!xml.includes('Hidden'));
        ok(xml.includes('url="http://h/api/show/s/episode/a/audio" length="9" type="audio/wav"'));
    });
});
//# sourceMappingURL=store.test.js.map