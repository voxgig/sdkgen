import type { Planet } from '../types.js';
import type { MoonStore } from './MoonStore.js';
export declare class PlanetStore {
    private planets;
    private moonStore;
    constructor(moonStore: MoonStore);
    getAll(): Planet[];
    getById(id: string): Planet | undefined;
    create(planet: Planet): Planet;
    update(id: string, updates: Partial<Planet>): Planet | undefined;
    delete(id: string): boolean;
}
