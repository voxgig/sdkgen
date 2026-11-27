import { ok, strictEqual } from 'node:assert';
import { after, before, describe, test } from 'node:test';
import { main } from '../../src/server.js';
import { start, TOKEN } from '../helpers.js';
const ROUTES = [
    ['GET', '/api/show'],
    ['POST', '/api/show'],
    ['GET', '/api/show/studio'],
    ['PUT', '/api/show/studio'],
    ['DELETE', '/api/show/studio'],
    ['GET', '/api/show/studio/artwork'],
    ['PUT', '/api/show/studio/artwork'],
    ['GET', '/api/show/studio/feed'],
    ['GET', '/api/show/studio/episode'],
    ['POST', '/api/show/studio/episode'],
    ['GET', '/api/show/studio/episode/pilot'],
    ['PUT', '/api/show/studio/episode/pilot'],
    ['DELETE', '/api/show/studio/episode/pilot'],
    ['GET', '/api/show/studio/episode/pilot/audio'],
    ['HEAD', '/api/show/studio/episode/pilot/audio'],
    ['PUT', '/api/show/studio/episode/pilot/audio'],
    ['GET', '/api/show/studio/episode/pilot/transcript'],
    ['PUT', '/api/show/studio/episode/pilot/transcript'],
    ['POST', '/api/show/studio/episode/pilot/publish'],
    ['POST', '/api/upload'],
    ['GET', '/api/upload/x'],
    ['HEAD', '/api/upload/x'],
    ['PATCH', '/api/upload/x'],
    ['DELETE', '/api/upload/x'],
    ['GET', '/api/nowhere'],
    ['GET', '/%61pi/show'],
];
describe('bearer credential', () => {
    let app;
    before(async () => {
        app = await start();
    });
    after(() => app.close());
    for (const [method, path] of ROUTES) {
        test(`${method} ${path} without a credential is 401`, async () => {
            const res = await fetch(app.base + path, { method });
            strictEqual(res.status, 401);
            strictEqual(res.headers.get('www-authenticate'), 'Bearer realm="podcastdemo"');
        });
    }
    test('a wrong credential is 401 and changes nothing', async () => {
        for (const authorization of [
            'Bearer wrong',
            `Basic ${Buffer.from(`user:${TOKEN}`).toString('base64')}`,
            TOKEN,
            `Bearer ${TOKEN}x`,
            `Bearer ${TOKEN} extra`,
        ]) {
            const res = await fetch(`${app.base}/api/show/studio`, {
                method: 'DELETE',
                headers: { authorization },
            });
            strictEqual(res.status, 401, authorization);
        }
        strictEqual((await app.call('/api/show/studio')).status, 200);
    });
    test('the scheme name is case-insensitive', async () => {
        const res = await fetch(`${app.base}/api/show`, {
            headers: { authorization: `bearer ${TOKEN}` },
        });
        strictEqual(res.status, 200);
    });
    test('the credential comes from the environment when set', async () => {
        const other = await start({ config: { token: 'from-env' } });
        try {
            strictEqual((await other.call('/api/show')).status, 401);
            const res = await fetch(`${other.base}/api/show`, {
                headers: { authorization: 'Bearer from-env' },
            });
            strictEqual(res.status, 200);
        }
        finally {
            await other.close();
        }
    });
});
describe('listening bounds', () => {
    test('refuses a host that is not loopback', async () => {
        const saved = process.env.HOST;
        process.env.HOST = '0.0.0.0';
        try {
            let refused;
            await main().catch((err) => (refused = err));
            ok(refused instanceof Error && /loopback/.test(refused.message));
        }
        finally {
            if (undefined === saved)
                delete process.env.HOST;
            else
                process.env.HOST = saved;
        }
    });
});
//# sourceMappingURL=auth.integration.test.js.map