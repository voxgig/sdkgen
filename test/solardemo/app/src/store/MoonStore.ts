import type { Moon } from '../types.js'

export class MoonStore {
  private moons: Map<string, Moon>

  constructor() {
    this.moons = new Map()
  }

  getAll(): Moon[] {
    return Array.from(this.moons.values())
  }

  getById(id: string): Moon | undefined {
    return this.moons.get(id)
  }

  getByPlanetId(planetId: string): Moon[] {
    return Array.from(this.moons.values()).filter(
      (moon) => moon.planet_id === planetId
    )
  }

  create(moon: Moon): Moon {
    this.moons.set(moon.id, { ...moon })
    return this.moons.get(moon.id)!
  }

  update(id: string, updates: Partial<Moon>): Moon | undefined {
    const moon = this.moons.get(id)
    if (!moon) {
      return undefined
    }

    const updated = { ...moon, ...updates, id }
    this.moons.set(id, updated)
    return updated
  }

  delete(id: string): boolean {
    return this.moons.delete(id)
  }
}
