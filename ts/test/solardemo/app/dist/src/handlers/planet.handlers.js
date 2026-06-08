import { NotFoundError } from '../utils/errors.js';
import Nid from 'nid';
const nid = Nid.default || Nid;
export const planetHandlers = {
    async list(request, reply) {
        const planetStore = request.server.planetStore;
        const planets = planetStore.getAll();
        reply.send(planets);
    },
    async get(request, reply) {
        const planetStore = request.server.planetStore;
        const planet = planetStore.getById(request.params.planet_id);
        if (!planet) {
            throw new NotFoundError('Planet', request.params.planet_id);
        }
        reply.send(planet);
    },
    async create(request, reply) {
        const planetStore = request.server.planetStore;
        const planet = planetStore.create({ ...request.body, id: nid(8) });
        reply.code(201).send(planet);
    },
    async update(request, reply) {
        const planetStore = request.server.planetStore;
        const planet = planetStore.update(request.params.planet_id, request.body);
        if (!planet) {
            throw new NotFoundError('Planet', request.params.planet_id);
        }
        reply.send(planet);
    },
    async delete(request, reply) {
        const planetStore = request.server.planetStore;
        const deleted = planetStore.delete(request.params.planet_id);
        if (!deleted) {
            throw new NotFoundError('Planet', request.params.planet_id);
        }
        reply.code(204).send();
    },
    async terraform(request, reply) {
        const planetStore = request.server.planetStore;
        const planet = planetStore.getById(request.params.planet_id);
        if (!planet) {
            throw new NotFoundError('Planet', request.params.planet_id);
        }
        const { start, stop } = request.body;
        let state = planet.terraformState || 'idle';
        if (start) {
            state = 'terraforming';
        }
        else if (stop) {
            state = 'idle';
        }
        planetStore.update(request.params.planet_id, { terraformState: state });
        reply.send({ ok: true, state });
    },
    async forbid(request, reply) {
        const planetStore = request.server.planetStore;
        const planet = planetStore.getById(request.params.planet_id);
        if (!planet) {
            throw new NotFoundError('Planet', request.params.planet_id);
        }
        const { forbid, why } = request.body;
        const forbidState = forbid ? 'forbidden' : 'allowed';
        planetStore.update(request.params.planet_id, {
            forbidState,
            forbidReason: forbid ? why : undefined,
        });
        reply.send({ ok: true, state: forbidState });
    },
};
//# sourceMappingURL=planet.handlers.js.map