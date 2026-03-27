import type { Moon } from '../types.js';
export declare class MoonStore {
    private moons;
    constructor();
    getAll(): Moon[];
    getById(id: string): Moon | undefined;
    getByPlanetId(planetId: string): Moon[];
    create(moon: Moon): Moon;
    update(id: string, updates: Partial<Moon>): Moon | undefined;
    delete(id: string): boolean;
}
