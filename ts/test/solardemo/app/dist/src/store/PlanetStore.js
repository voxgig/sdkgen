export class PlanetStore {
    planets;
    moonStore;
    constructor(moonStore) {
        this.planets = new Map();
        this.moonStore = moonStore;
    }
    getAll() {
        return Array.from(this.planets.values());
    }
    getById(id) {
        return this.planets.get(id);
    }
    create(planet) {
        this.planets.set(planet.id, { ...planet });
        return this.planets.get(planet.id);
    }
    update(id, updates) {
        const planet = this.planets.get(id);
        if (!planet) {
            return undefined;
        }
        const updated = { ...planet, ...updates, id };
        this.planets.set(id, updated);
        return updated;
    }
    delete(id) {
        const planet = this.planets.get(id);
        if (!planet) {
            return false;
        }
        const moons = this.moonStore.getByPlanetId(id);
        moons.forEach((moon) => this.moonStore.delete(moon.id));
        return this.planets.delete(id);
    }
}
//# sourceMappingURL=PlanetStore.js.map