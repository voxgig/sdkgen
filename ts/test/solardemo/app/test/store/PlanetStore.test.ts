import { describe, test } from 'node:test'
import { strictEqual, deepStrictEqual } from 'node:assert'
import { PlanetStore } from '../../src/store/PlanetStore.js'
import { MoonStore } from '../../src/store/MoonStore.js'
import { createTestPlanet, createTestMoon } from '../setup.js'

describe('PlanetStore', () => {
  test('create adds planet to store', () => {
    const moonStore = new MoonStore()
    const store = new PlanetStore(moonStore)

    const planet = createTestPlanet()
    const created = store.create(planet)

    deepStrictEqual(created, planet)

    const retrieved = store.getById('test-planet')
    deepStrictEqual(retrieved, planet)
  })

  test('getAll returns all planets', () => {
    const moonStore = new MoonStore()
    const store = new PlanetStore(moonStore)

    const planet1 = createTestPlanet({ id: 'p1', name: 'Planet 1' })
    const planet2 = createTestPlanet({ id: 'p2', name: 'Planet 2' })

    store.create(planet1)
    store.create(planet2)

    const all = store.getAll()
    strictEqual(all.length, 2)
  })

  test('getById returns undefined for non-existent planet', () => {
    const moonStore = new MoonStore()
    const store = new PlanetStore(moonStore)

    const result = store.getById('non-existent')
    strictEqual(result, undefined)
  })

  test('update modifies existing planet', () => {
    const moonStore = new MoonStore()
    const store = new PlanetStore(moonStore)

    const planet = createTestPlanet()
    store.create(planet)

    const updated = store.update('test-planet', { name: 'Updated Planet' })
    strictEqual(updated?.name, 'Updated Planet')
    strictEqual(updated?.diameter, 5000)
  })

  test('update returns undefined for non-existent planet', () => {
    const moonStore = new MoonStore()
    const store = new PlanetStore(moonStore)

    const result = store.update('non-existent', { name: 'Test' })
    strictEqual(result, undefined)
  })

  test('delete removes planet and cascades to moons', () => {
    const moonStore = new MoonStore()
    const store = new PlanetStore(moonStore)

    const planet = createTestPlanet({ id: 'p1' })
    const moon1 = createTestMoon({ id: 'm1', planet_id: 'p1' })
    const moon2 = createTestMoon({ id: 'm2', planet_id: 'p1' })

    store.create(planet)
    moonStore.create(moon1)
    moonStore.create(moon2)

    const deleted = store.delete('p1')
    strictEqual(deleted, true)
    strictEqual(store.getById('p1'), undefined)
    strictEqual(moonStore.getById('m1'), undefined)
    strictEqual(moonStore.getById('m2'), undefined)
  })

  test('delete returns false for non-existent planet', () => {
    const moonStore = new MoonStore()
    const store = new PlanetStore(moonStore)

    const deleted = store.delete('non-existent')
    strictEqual(deleted, false)
  })
})
