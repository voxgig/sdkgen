export class MoonStore {
    moons;
    constructor() {
        this.moons = new Map();
    }
    getAll() {
        return Array.from(this.moons.values());
    }
    getById(id) {
        return this.moons.get(id);
    }
    getByPlanetId(planetId) {
        return Array.from(this.moons.values()).filter((moon) => moon.planet_id === planetId);
    }
    create(moon) {
        this.moons.set(moon.id, { ...moon });
        return this.moons.get(moon.id);
    }
    update(id, updates) {
        const moon = this.moons.get(id);
        if (!moon) {
            return undefined;
        }
        const updated = { ...moon, ...updates, id };
        this.moons.set(id, updated);
        return updated;
    }
    delete(id) {
        return this.moons.delete(id);
    }
}
//# sourceMappingURL=MoonStore.js.map