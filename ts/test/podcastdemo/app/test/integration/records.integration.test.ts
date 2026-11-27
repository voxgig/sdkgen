import { deepStrictEqual, notStrictEqual, ok, strictEqual } from 'node:assert'
import { after, before, describe, test } from 'node:test'
import { type Running, start } from '../helpers.js'

const json = (body: unknown, method = 'POST') => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

describe('records over a socket', () => {
  let app: Running

  before(async () => {
    app = await start()
  })
  after(() => app.close())

  test('lists the seeded shows with artwork metadata, never bytes', async () => {
    const res = await app.call('/api/show')
    strictEqual(res.status, 200)
    const shows = await res.json()
    deepStrictEqual(
      shows.map((s: any) => s.id),
      ['studio', 'quiet'],
    )
    deepStrictEqual(Object.keys(shows[0].artwork).sort(), [
      'digest',
      'etag',
      'modified',
      'size',
      'type',
    ])
    strictEqual(shows[1].artwork, undefined)
  })

  test('show lifecycle with a generated id', async () => {
    const created = await app.call('/api/show', json({ id: '../../etc', name: 'New', author: 'Me' }))
    strictEqual(created.status, 201)
    const show = await created.json()
    notStrictEqual(show.id, '../../etc')
    ok(/^[A-Za-z0-9_-]{12}$/.test(show.id))

    const updated = await app.call(`/api/show/${show.id}`, json({ name: 'Renamed' }, 'PUT'))
    strictEqual(updated.status, 200)
    deepStrictEqual(await updated.json(), { id: show.id, name: 'Renamed', author: 'Me' })

    strictEqual((await app.call(`/api/show/${show.id}`)).status, 200)
    strictEqual((await app.call(`/api/show/${show.id}`, { method: 'DELETE' })).status, 204)
    strictEqual((await app.call(`/api/show/${show.id}`)).status, 404)
    strictEqual((await app.call(`/api/show/${show.id}`, { method: 'DELETE' })).status, 404)
    strictEqual((await app.call(`/api/show/${show.id}`, json({ name: 'x' }, 'PUT'))).status, 404)
  })

  test('a create without its required fields is refused', async () => {
    const res = await app.call('/api/show', json({ name: 'No author' }))
    strictEqual(res.status, 400)
    strictEqual((await res.json()).error, 'ValidationError')
  })

  test('a DELETE that declares JSON with no body is accepted', async () => {
    const show = await (await app.call('/api/show', json({ name: 'D', author: 'E' }))).json()
    const res = await app.call(`/api/show/${show.id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
    })
    strictEqual(res.status, 204)
  })

  test('episodes are reached only beneath their own show', async () => {
    const list = await app.call('/api/show/studio/episode')
    strictEqual(list.status, 200)
    deepStrictEqual(
      (await list.json()).map((e: any) => e.id),
      ['pilot', 'longform'],
    )
    strictEqual((await app.call('/api/show/quiet/episode/pilot')).status, 404)
    strictEqual((await app.call('/api/show/nope/episode')).status, 404)
    const pilot = await (await app.call('/api/show/studio/episode/pilot')).json()
    strictEqual(pilot.audio.size, 1048620)
    strictEqual(pilot.transcript.type, 'text/vtt')
    strictEqual(pilot.state, 'published')
  })

  test('episode update ignores read-only fields and checks show_id', async () => {
    const res = await app.call(
      '/api/show/studio/episode/longform',
      json({ title: 'Longer', state: 'published', audio: { size: 1 } }, 'PUT'),
    )
    strictEqual(res.status, 200)
    const episode = await res.json()
    strictEqual(episode.title, 'Longer')
    strictEqual(episode.state, 'draft')
    strictEqual(episode.audio.size, 16777260)

    const wrong = await app.call(
      '/api/show/studio/episode/longform',
      json({ show_id: 'quiet', title: 'x' }, 'PUT'),
    )
    strictEqual(wrong.status, 400)
  })

  test('publish moves an episode into the feed and back out', async () => {
    const feedHas = async (id: string) => {
      const res = await app.call('/api/show/studio/feed')
      strictEqual(res.status, 200)
      strictEqual(res.headers.get('content-type'), 'application/rss+xml')
      return (await res.text()).includes(`<guid isPermaLink="false">${id}</guid>`)
    }
    strictEqual(await feedHas('longform'), false)

    const res = await app.call(
      '/api/show/studio/episode/longform/publish',
      json({ publish: true, why: 'ready' }),
    )
    strictEqual(res.status, 200)
    deepStrictEqual(await res.json(), { ok: true, state: 'published' })
    strictEqual(await feedHas('longform'), true)

    await app.call('/api/show/studio/episode/longform/publish', json({ publish: false }))
    strictEqual(await feedHas('longform'), false)

    strictEqual(
      (await app.call('/api/show/studio/episode/longform/publish', json({ why: 'x' }))).status,
      400,
    )
    strictEqual((await app.call('/api/show/nope/feed')).status, 404)
  })

  test('deleting a show removes its episodes and their files', async () => {
    const show = await (await app.call('/api/show', json({ name: 'Gone', author: 'A' }))).json()
    const form = new FormData()
    form.set('title', 'Ep')
    form.set('audio', new Blob([new Uint8Array(Buffer.alloc(64, 1))], { type: 'audio/wav' }), 'a.wav')
    const ep = await (
      await app.call(`/api/show/${show.id}/episode`, { method: 'POST', body: form })
    ).json()
    const before = app.ctx.slots.count
    strictEqual((await app.call(`/api/show/${show.id}`, { method: 'DELETE' })).status, 204)
    strictEqual(app.ctx.slots.count, before - 1)
    strictEqual(app.ctx.episodes.get(show.id, ep.id), undefined)
  })
})
