import { NotFoundError, ValidationError } from '../utils/errors.js';
import Nid from 'nid';
const nid = Nid.default || Nid;
export const moonHandlers = {
    async list(request, reply) {
        const planetStore = request.server.planetStore;
        const moonStore = request.server.moonStore;
        const planet = planetStore.getById(request.params.planet_id);
        if (!planet) {
            throw new NotFoundError('Planet', request.params.planet_id);
        }
        const moons = moonStore.getByPlanetId(request.params.planet_id);
        reply.send(moons);
    },
    async get(request, reply) {
        const moonStore = request.server.moonStore;
        const moon = moonStore.getById(request.params.moon_id);
        if (!moon) {
            throw new NotFoundError('Moon', request.params.moon_id);
        }
        reply.send(moon);
    },
    async create(request, reply) {
        const planetStore = request.server.planetStore;
        const moonStore = request.server.moonStore;
        const planet = planetStore.getById(request.params.planet_id);
        if (!planet) {
            throw new NotFoundError('Planet', request.params.planet_id);
        }
        if (request.body.planet_id !== request.params.planet_id) {
            throw new ValidationError('planet_id in body must match planet_id in path');
        }
        const moon = moonStore.create({ ...request.body, id: nid(8) });
        reply.code(201).send(moon);
    },
    async update(request, reply) {
        const moonStore = request.server.moonStore;
        const moon = moonStore.update(request.params.moon_id, request.body);
        if (!moon) {
            throw new NotFoundError('Moon', request.params.moon_id);
        }
        reply.send(moon);
    },
    async delete(request, reply) {
        const moonStore = request.server.moonStore;
        const deleted = moonStore.delete(request.params.moon_id);
        if (!deleted) {
            throw new NotFoundError('Moon', request.params.moon_id);
        }
        reply.code(204).send();
    },
};
//# sourceMappingURL=moon.handlers.js.map