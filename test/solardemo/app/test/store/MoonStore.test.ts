import { describe, test } from 'node:test'
import { strictEqual, deepStrictEqual } from 'node:assert'
import { MoonStore } from '../../src/store/MoonStore.js'
import { createTestMoon } from '../setup.js'

describe('MoonStore', () => {
  test('create adds moon to store', () => {
    const store = new MoonStore()

    const moon = createTestMoon()
    const created = store.create(moon)

    deepStrictEqual(created, moon)

    const retrieved = store.getById('test-moon')
    deepStrictEqual(retrieved, moon)
  })

  test('getAll returns all moons', () => {
    const store = new MoonStore()

    const moon1 = createTestMoon({ id: 'm1', name: 'Moon 1' })
    const moon2 = createTestMoon({ id: 'm2', name: 'Moon 2' })

    store.create(moon1)
    store.create(moon2)

    const all = store.getAll()
    strictEqual(all.length, 2)
  })

  test('getById returns undefined for non-existent moon', () => {
    const store = new MoonStore()

    const result = store.getById('non-existent')
    strictEqual(result, undefined)
  })

  test('getByPlanetId returns moons for specific planet', () => {
    const store = new MoonStore()

    const moon1 = createTestMoon({ id: 'm1', planet_id: 'p1' })
    const moon2 = createTestMoon({ id: 'm2', planet_id: 'p1' })
    const moon3 = createTestMoon({ id: 'm3', planet_id: 'p2' })

    store.create(moon1)
    store.create(moon2)
    store.create(moon3)

    const p1Moons = store.getByPlanetId('p1')
    strictEqual(p1Moons.length, 2)

    const p2Moons = store.getByPlanetId('p2')
    strictEqual(p2Moons.length, 1)
  })

  test('getByPlanetId returns empty array when no moons exist', () => {
    const store = new MoonStore()

    const moons = store.getByPlanetId('non-existent')
    strictEqual(moons.length, 0)
  })

  test('update modifies existing moon', () => {
    const store = new MoonStore()

    const moon = createTestMoon()
    store.create(moon)

    const updated = store.update('test-moon', { name: 'Updated Moon' })
    strictEqual(updated?.name, 'Updated Moon')
    strictEqual(updated?.diameter, 1000)
  })

  test('update returns undefined for non-existent moon', () => {
    const store = new MoonStore()

    const result = store.update('non-existent', { name: 'Test' })
    strictEqual(result, undefined)
  })

  test('delete removes moon from store', () => {
    const store = new MoonStore()

    const moon = createTestMoon()
    store.create(moon)

    const deleted = store.delete('test-moon')
    strictEqual(deleted, true)
    strictEqual(store.getById('test-moon'), undefined)
  })

  test('delete returns false for non-existent moon', () => {
    const store = new MoonStore()

    const deleted = store.delete('non-existent')
    strictEqual(deleted, false)
  })
})
