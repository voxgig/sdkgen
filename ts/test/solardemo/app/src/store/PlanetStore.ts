import type { Planet } from '../types.js'
import type { MoonStore } from './MoonStore.js'

export class PlanetStore {
  private planets: Map<string, Planet>
  private moonStore: MoonStore

  constructor(moonStore: MoonStore) {
    this.planets = new Map()
    this.moonStore = moonStore
  }

  getAll(): Planet[] {
    return Array.from(this.planets.values())
  }

  getById(id: string): Planet | undefined {
    return this.planets.get(id)
  }

  create(planet: Planet): Planet {
    this.planets.set(planet.id, { ...planet })
    return this.planets.get(planet.id)!
  }

  update(id: string, updates: Partial<Planet>): Planet | undefined {
    const planet = this.planets.get(id)
    if (!planet) {
      return undefined
    }

    const updated = { ...planet, ...updates, id }
    this.planets.set(id, updated)
    return updated
  }

  delete(id: string): boolean {
    const planet = this.planets.get(id)
    if (!planet) {
      return false
    }

    const moons = this.moonStore.getByPlanetId(id)
    moons.forEach((moon) => this.moonStore.delete(moon.id))

    return this.planets.delete(id)
  }
}
