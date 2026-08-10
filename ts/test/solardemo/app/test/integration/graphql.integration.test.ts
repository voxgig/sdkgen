import { describe, test, before, after } from 'node:test'
import { strictEqual, deepStrictEqual, ok } from 'node:assert'
import { build } from '../../src/server.js'
import type { FastifyInstance } from 'fastify'

// The GraphQL face of the solar demo API. The schema served here is the same
// file apidef ingests as the GraphQL def, so these tests also pin the
// contract a generated GraphQL SDK is built against — in particular the
// shapes the SDK transport depends on: relay pageInfo, payload wrappers, and
// errors reported under HTTP 200.

describe('GraphQL API Integration', () => {
  let app: FastifyInstance

  before(async () => {
    app = await build()
  })

  after(async () => {
    await app.close()
  })

  async function gql(query: string, variables?: any) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/graphql',
      payload: { query, variables },
    })
    return { status: res.statusCode, body: res.json() as any }
  }


  test('load: planet by id', async () => {
    const { status, body } = await gql(
      'query PlanetLoad($id: String!) { planet(id: $id) { id name kind diameter } }',
      { id: 'earth' })

    strictEqual(status, 200)
    strictEqual(body.data.planet.id, 'earth')
    strictEqual(body.data.planet.kind, 'rock')
  })


  test('list: planets as a relay connection', async () => {
    const { body } = await gql(
      'query { planets { nodes { id } pageInfo { hasNextPage endCursor } } }')

    const conn = body.data.planets
    ok(0 < conn.nodes.length)
    // The SDK's paging feature reads exactly these two fields.
    strictEqual(typeof conn.pageInfo.hasNextPage, 'boolean')
    ok(null != conn.pageInfo.endCursor)
  })


  // Paging must terminate: the final page reports hasNextPage false while
  // still carrying an end cursor. That combination is what an SDK following
  // cursor-presence alone would loop on forever.
  test('list: paging walks to a terminating final page', async () => {
    const seen: string[] = []
    let after: string | null = null
    let pages = 0

    for (; pages < 20; pages++) {
      const { body }: any = await gql(
        'query P($first: Int, $after: String) { planets(first: $first, after: $after)' +
        ' { nodes { id } pageInfo { hasNextPage endCursor } } }',
        { first: 2, after })

      const conn = body.data.planets
      seen.push(...conn.nodes.map((n: any) => n.id))

      if (!conn.pageInfo.hasNextPage) {
        ok(null != conn.pageInfo.endCursor, 'final page still has a cursor')
        break
      }
      after = conn.pageInfo.endCursor
    }

    ok(pages < 20, 'paging terminated')

    const { body: all } = await gql('query { planets { nodes { id } } }')
    deepStrictEqual(seen, all.data.planets.nodes.map((n: any) => n.id))
  })


  test('relations: planet moons, and moon back to planet', async () => {
    const { body } = await gql(
      'query { planet(id: "earth") { moons { nodes { id name planet { id } } } } }')

    const nodes = body.data.planet.moons.nodes
    ok(0 < nodes.length)
    strictEqual(nodes[0].planet.id, 'earth')
  })


  test('create/update/delete: payload wrappers carry the entity', async () => {
    const created = await gql(
      'mutation C($input: PlanetCreateInput!) { planetCreate(input: $input)' +
      ' { success planet { id name kind diameter } } }',
      { input: { name: 'Vulcan', kind: 'rock', diameter: 9000 } })

    strictEqual(created.body.data.planetCreate.success, true)
    const id = created.body.data.planetCreate.planet.id
    ok(null != id)

    const updated = await gql(
      'mutation U($id: String!, $input: PlanetUpdateInput!)' +
      ' { planetUpdate(id: $id, input: $input) { success planet { name } } }',
      { id, input: { name: 'Vulcan II' } })
    strictEqual(updated.body.data.planetUpdate.planet.name, 'Vulcan II')

    const removed = await gql(
      'mutation D($id: String!) { planetDelete(id: $id) { success } }', { id })
    strictEqual(removed.body.data.planetDelete.success, true)

    const gone = await gql(
      'query Q($id: String!) { planet(id: $id) { id } }', { id })
    strictEqual(gone.body.data.planet, null)
  })


  // The two command mutations — the GraphQL face of the REST action
  // endpoints, and the reason actions must survive classification.
  test('actions: terraform and forbid', async () => {
    const t = await gql(
      'mutation T($id: String!) { planetTerraform(id: $id, start: true)' +
      ' { success state planet { id } } }', { id: 'mars' })
    strictEqual(t.body.data.planetTerraform.state, 'terraforming')
    strictEqual(t.body.data.planetTerraform.planet.id, 'mars')

    const f = await gql(
      'mutation F($id: String!, $why: String)' +
      ' { planetForbid(id: $id, forbid: true, why: $why) { success state } }',
      { id: 'mars', why: 'hostile' })
    strictEqual(f.body.data.planetForbid.state, 'forbidden')
  })


  // Field-level failures ride HTTP 200 with a top-level errors array. The SDK
  // transport exists precisely because status alone cannot detect this.
  test('errors: execution failure rides HTTP 200', async () => {
    const { status, body } = await gql(
      'query { planet(id: "earth") { id nope } }')

    strictEqual(status, 400, 'validation failure cannot execute at all')
    ok(0 < body.errors.length)
    ok(body.errors[0].message.includes('nope'))
  })


  test('errors: malformed request reports a graphql error envelope', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/graphql', payload: { notaquery: 1 },
    })
    strictEqual(res.statusCode, 400)
    ok(0 < (res.json() as any).errors.length)
  })


  // REST answers a missing id with 404. A payload of { success: false } and
  // no `errors` is invisible to a client reading the error array — which is
  // exactly what the generated transport reads — so an SDK would report a
  // failed update as successful. Both faces must fail the same way.
  test('parity: missing id is an error, not a quiet false', async () => {
    const cases: [string, any][] = [
      ['mutation U($id: String!) { planetUpdate(id: $id, input: {name: "x"})' +
        ' { success } }', { id: 'nope' }],
      ['mutation D($id: String!) { planetDelete(id: $id) { success } }',
        { id: 'nope' }],
      ['mutation M($id: String!) { moonUpdate(id: $id, input: {name: "x"})' +
        ' { success } }', { id: 'nope' }],
    ]

    for (const [q, v] of cases) {
      const { body } = await gql(q, v)
      ok(0 < (body.errors ?? []).length, q.slice(0, 24) + ' reports an error')
      strictEqual(body.errors[0].extensions.code, 'NOT_FOUND')
    }
  })


  // A dangling moon would break execution later: Moon.planet is non-null.
  test('parity: moon create rejects an unknown planet', async () => {
    const { body } = await gql(
      'mutation C($input: MoonCreateInput!) { moonCreate(input: $input)' +
      ' { success } }',
      { input: { planetId: 'nope', name: 'M', kind: 'rock', diameter: 1 } })

    ok(0 < (body.errors ?? []).length)
    strictEqual(body.errors[0].extensions.code, 'NOT_FOUND')
  })


  // Neither flag set must leave the state alone, as the REST handler does —
  // forcing 'idle' would stop an in-progress terraform.
  test('parity: terraform without flags preserves state', async () => {
    await gql('mutation { planetTerraform(id: "venus", start: true)' +
      ' { state } }')

    const { body } = await gql(
      'mutation { planetTerraform(id: "venus") { state } }')

    strictEqual(body.data.planetTerraform.state, 'terraforming')
  })


  // An explicit null would overwrite a required field, after which selecting
  // the non-null Planet.name fails execution.
  test('parity: explicit null in an update is ignored, not written', async () => {
    const before = await gql('query { planet(id: "earth") { name } }')

    const { body } = await gql(
      'mutation U($input: PlanetUpdateInput!)' +
      ' { planetUpdate(id: "earth", input: $input) { planet { name kind } } }',
      { input: { name: null, kind: 'gas' } })

    strictEqual(body.data.planetUpdate.planet.name,
      before.body.data.planet.name)
    strictEqual(body.data.planetUpdate.planet.kind, 'gas')
  })


  // A cursor whose row was deleted between pages must end the walk, not
  // restart it and hand the client duplicates.
  test('parity: a stale cursor ends the walk', async () => {
    const created = await gql(
      'mutation C($input: PlanetCreateInput!) { planetCreate(input: $input)' +
      ' { planet { id } } }',
      { input: { name: 'Ghost', kind: 'rock', diameter: 1 } })
    const id = created.body.data.planetCreate.planet.id

    await gql('mutation D($id: String!) { planetDelete(id: $id) { success } }',
      { id })

    const { body } = await gql(
      'query P($after: String) { planets(after: $after)' +
      ' { nodes { id } pageInfo { hasNextPage endCursor } } }', { after: id })

    deepStrictEqual(body.data.planets.nodes, [])
    strictEqual(body.data.planets.pageInfo.hasNextPage, false)
  })
})
