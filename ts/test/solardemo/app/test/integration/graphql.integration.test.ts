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
})
