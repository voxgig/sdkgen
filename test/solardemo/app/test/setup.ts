import type { Planet, Moon } from '../src/types.js'

export function createTestPlanet(overrides?: Partial<Planet>): Planet {
  return {
    id: 'test-planet',
    name: 'Test Planet',
    kind: 'rock',
    diameter: 5000,
    ...overrides,
  }
}

export function createTestMoon(overrides?: Partial<Moon>): Moon {
  return {
    id: 'test-moon',
    name: 'Test Moon',
    planet_id: 'test-planet',
    kind: 'rock',
    diameter: 1000,
    ...overrides,
  }
}
