import { describe, test, before, after } from 'node:test';
import { strictEqual, ok } from 'node:assert';
import { build } from '../../src/server.js';
describe('Planet API Integration', () => {
    let app;
    before(async () => {
        app = await build();
    });
    after(async () => {
        await app.close();
    });
    test('GET /api/planet returns all planets', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/planet',
        });
        strictEqual(res.statusCode, 200);
        const planets = JSON.parse(res.payload);
        strictEqual(planets.length, 8);
    });
    test('GET /api/planet/:planet_id returns specific planet', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/planet/earth',
        });
        strictEqual(res.statusCode, 200);
        const planet = JSON.parse(res.payload);
        strictEqual(planet.id, 'earth');
        strictEqual(planet.name, 'Earth');
    });
    test('GET /api/planet/:planet_id returns 404 for non-existent planet', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/planet/non-existent',
        });
        strictEqual(res.statusCode, 404);
    });
    test('full planet lifecycle', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/planet',
            payload: {
                name: 'Test Planet',
                kind: 'rock',
                diameter: 5000,
            },
        });
        strictEqual(createRes.statusCode, 201);
        const created = JSON.parse(createRes.payload);
        const planetId = created.id;
        const getRes = await app.inject({
            method: 'GET',
            url: `/api/planet/${planetId}`,
        });
        strictEqual(getRes.statusCode, 200);
        const planet = JSON.parse(getRes.payload);
        strictEqual(planet.name, 'Test Planet');
        const updateRes = await app.inject({
            method: 'PUT',
            url: `/api/planet/${planetId}`,
            payload: {
                name: 'Updated Planet',
                kind: 'rock',
                diameter: 5000,
            },
        });
        strictEqual(updateRes.statusCode, 200);
        const updated = JSON.parse(updateRes.payload);
        strictEqual(updated.name, 'Updated Planet');
        const deleteRes = await app.inject({
            method: 'DELETE',
            url: `/api/planet/${planetId}`,
        });
        strictEqual(deleteRes.statusCode, 204);
        const notFoundRes = await app.inject({
            method: 'GET',
            url: `/api/planet/${planetId}`,
        });
        strictEqual(notFoundRes.statusCode, 404);
    });
    test('POST /api/planet/:planet_id/terraform starts terraforming', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/planet/mars/terraform',
            payload: { start: true },
        });
        strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.payload);
        strictEqual(body.ok, true);
        strictEqual(body.state, 'terraforming');
    });
    test('POST /api/planet/:planet_id/terraform stops terraforming', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/planet/mars/terraform',
            payload: { stop: true },
        });
        strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.payload);
        strictEqual(body.ok, true);
        strictEqual(body.state, 'idle');
    });
    test('POST /api/planet/:planet_id/forbid marks planet as forbidden', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/planet/venus/forbid',
            payload: { forbid: true, why: 'Dangerous atmosphere' },
        });
        strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.payload);
        strictEqual(body.ok, true);
        strictEqual(body.state, 'forbidden');
    });
    test('POST /api/planet/:planet_id/forbid allows planet', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/planet/venus/forbid',
            payload: { forbid: false },
        });
        strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.payload);
        strictEqual(body.ok, true);
        strictEqual(body.state, 'allowed');
    });
    test('POST /api/planet creates a planet visible in /debug', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/planet',
            payload: {
                name: 'Debug Test Planet',
                kind: 'gas',
                diameter: 9999,
            },
        });
        strictEqual(createRes.statusCode, 201);
        const created = JSON.parse(createRes.payload);
        const planetId = created.id;
        const debugRes = await app.inject({
            method: 'GET',
            url: '/debug',
        });
        strictEqual(debugRes.statusCode, 200);
        const debug = JSON.parse(debugRes.payload);
        const debugPlanet = debug.data.planet.find((p) => p.id === planetId);
        ok(debugPlanet, 'New planet should appear in debug output');
        strictEqual(debugPlanet.name, 'Debug Test Planet');
        strictEqual(debugPlanet.kind, 'gas');
        strictEqual(debugPlanet.diameter, 9999);
        // Clean up
        await app.inject({ method: 'DELETE', url: `/api/planet/${planetId}` });
    });
    test('terraform on non-existent planet returns 404', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/planet/non-existent/terraform',
            payload: { start: true },
        });
        strictEqual(res.statusCode, 404);
    });
});
//# sourceMappingURL=planet.integration.test.js.map