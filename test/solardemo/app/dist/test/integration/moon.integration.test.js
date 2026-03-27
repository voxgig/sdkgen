import { describe, test, before, after } from 'node:test';
import { strictEqual } from 'node:assert';
import { build } from '../../src/server.js';
describe('Moon API Integration', () => {
    let app;
    before(async () => {
        app = await build();
    });
    after(async () => {
        await app.close();
    });
    test('GET /api/planet/:planet_id/moon returns moons for planet', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/planet/earth/moon',
        });
        strictEqual(res.statusCode, 200);
        const moons = JSON.parse(res.payload);
        strictEqual(moons.length, 1);
        strictEqual(moons[0].name, 'Luna');
    });
    test('GET /api/planet/:planet_id/moon returns 404 for non-existent planet', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/planet/non-existent/moon',
        });
        strictEqual(res.statusCode, 404);
    });
    test('GET /api/planet/:planet_id/moon/:moon_id returns specific moon', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/planet/earth/moon/luna',
        });
        strictEqual(res.statusCode, 200);
        const moon = JSON.parse(res.payload);
        strictEqual(moon.id, 'luna');
        strictEqual(moon.name, 'Luna');
        strictEqual(moon.planet_id, 'earth');
    });
    test('GET /api/planet/:planet_id/moon/:moon_id returns 404 for non-existent moon', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/planet/earth/moon/non-existent',
        });
        strictEqual(res.statusCode, 404);
    });
    test('full moon lifecycle', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/planet/earth/moon',
            payload: {
                name: 'Test Moon',
                planet_id: 'earth',
                kind: 'rock',
                diameter: 1000,
            },
        });
        strictEqual(createRes.statusCode, 201);
        const created = JSON.parse(createRes.payload);
        const moonId = created.id;
        const getRes = await app.inject({
            method: 'GET',
            url: `/api/planet/earth/moon/${moonId}`,
        });
        strictEqual(getRes.statusCode, 200);
        const moon = JSON.parse(getRes.payload);
        strictEqual(moon.name, 'Test Moon');
        const updateRes = await app.inject({
            method: 'PUT',
            url: `/api/planet/earth/moon/${moonId}`,
            payload: {
                name: 'Updated Moon',
                planet_id: 'earth',
                kind: 'rock',
                diameter: 1000,
            },
        });
        strictEqual(updateRes.statusCode, 200);
        const updated = JSON.parse(updateRes.payload);
        strictEqual(updated.name, 'Updated Moon');
        const deleteRes = await app.inject({
            method: 'DELETE',
            url: `/api/planet/earth/moon/${moonId}`,
        });
        strictEqual(deleteRes.statusCode, 204);
        const notFoundRes = await app.inject({
            method: 'GET',
            url: `/api/planet/earth/moon/${moonId}`,
        });
        strictEqual(notFoundRes.statusCode, 404);
    });
    test('POST /api/planet/:planet_id/moon returns 404 for non-existent planet', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/planet/non-existent/moon',
            payload: {
                name: 'Test Moon',
                planet_id: 'non-existent',
                kind: 'rock',
                diameter: 1000,
            },
        });
        strictEqual(res.statusCode, 404);
    });
    test('POST /api/planet/:planet_id/moon validates planet_id match', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/planet/earth/moon',
            payload: {
                name: 'Test Moon',
                planet_id: 'mars',
                kind: 'rock',
                diameter: 1000,
            },
        });
        strictEqual(res.statusCode, 400);
    });
    test('filtering moons by planet_id', async () => {
        const jupiterRes = await app.inject({
            method: 'GET',
            url: '/api/planet/jupiter/moon',
        });
        strictEqual(jupiterRes.statusCode, 200);
        const jupiterMoons = JSON.parse(jupiterRes.payload);
        strictEqual(jupiterMoons.length, 4);
        const saturnRes = await app.inject({
            method: 'GET',
            url: '/api/planet/saturn/moon',
        });
        strictEqual(saturnRes.statusCode, 200);
        const saturnMoons = JSON.parse(saturnRes.payload);
        strictEqual(saturnMoons.length, 6);
    });
});
//# sourceMappingURL=moon.integration.test.js.map