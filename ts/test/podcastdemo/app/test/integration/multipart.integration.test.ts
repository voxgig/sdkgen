import { ok, strictEqual } from 'node:assert'
import { after, before, describe, test } from 'node:test'
import { bytesOf, multipart, reprOf, type Running, start, wavFile } from '../helpers.js'

const CREATE = '/api/show/quiet/episode'

const fileHeaders = (disposition: string, type = 'audio/wav') => [
  `Content-Disposition: form-data; ${disposition}`,
  `Content-Type: ${type}`,
]
const field = (name: string, value: string) => ({
  headers: [`Content-Disposition: form-data; name="${name}"`],
  body: value,
})

describe('multipart episode create', () => {
  let app: Running

  before(async () => {
    app = await start({ config: { limits: { audio: 2048 } } })
  })
  after(() => app.close())

  const post = (body: Buffer | FormData, contentType?: string) =>
    app.call(CREATE, {
      method: 'POST',
      body,
      headers: contentType ? { 'content-type': contentType } : {},
    })

  async function createdAudio(res: Response): Promise<{ episode: any; bytes: Buffer }> {
    strictEqual(res.status, 201)
    const episode = await res.json()
    const got = await app.call(`${CREATE}/${episode.id}/audio`)
    return { episode, bytes: await bytesOf(got) }
  }

  test('a record and its audio in one request', async () => {
    const file = wavFile(1500)
    const form = new FormData()
    form.set('title', 'First')
    form.set('number', '3')
    form.set('audio', new Blob([new Uint8Array(file)], { type: 'audio/wav' }), 'first.wav')
    const { episode, bytes } = await createdAudio(await post(form))
    strictEqual(episode.title, 'First')
    strictEqual(episode.number, 3)
    strictEqual(episode.show_id, 'quiet')
    strictEqual(episode.state, 'draft')
    strictEqual(episode.audio.size, 1500)
    strictEqual(episode.audio.digest, reprOf(file))
    ok(bytes.equals(file))
  })

  for (const [label, disposition] of [
    ['a traversal name', 'name="audio"; filename="../../../etc/passwd"'],
    ['an absolute name', 'name="audio"; filename="/tmp/x.wav"'],
    ['a quoted name', 'name="audio"; filename="say \\"hi\\"; now.wav"'],
    ['an encoded unicode name', `name="audio"; filename*=UTF-8''%C3%A9pisode%20%E2%9C%93.wav`],
    ['no file name', 'name="audio"'],
    ['a control character name', 'name="audio"; filename="a%00b\tc.wav"'],
  ]) {
    test(`a file part with ${label} is stored under the server's own id`, async () => {
      const file = wavFile(100, label.length)
      const { body, contentType } = multipart([
        field('title', `Awkward: "${label}"\r\nline two ✓`),
        { headers: fileHeaders(disposition), body: file },
      ])
      const { episode, bytes } = await createdAudio(await post(body, contentType))
      strictEqual(episode.title, `Awkward: "${label}"\r\nline two ✓`)
      ok(/^[A-Za-z0-9_-]{12}$/.test(episode.id))
      ok(bytes.equals(file))
    })
  }

  test('field order does not matter', async () => {
    const file = wavFile(64)
    const { body, contentType } = multipart([
      { headers: fileHeaders('name="audio"; filename="a.wav"'), body: file },
      field('title', 'Late title'),
    ])
    const { episode } = await createdAudio(await post(body, contentType))
    strictEqual(episode.title, 'Late title')
  })

  for (const [label, parts, status] of [
    ['an unknown field', [field('title', 'x'), field('../title', 'y')], 400],
    ['a repeated field', [field('title', 'x'), field('title', 'y')], 400],
    ['no audio', [field('title', 'x')], 400],
    ['no title', [{ headers: fileHeaders('name="audio"; filename="a.wav"'), body: 'RIFF' }], 400],
    ['a number that is not an integer', [field('title', 'x'), field('number', '1.5')], 400],
    [
      'a file under another name',
      [field('title', 'x'), { headers: fileHeaders('name="cover"; filename="a.wav"'), body: 'R' }],
      400,
    ],
    [
      'audio of another type',
      [field('title', 'x'), { headers: fileHeaders('name="audio"; filename="a.png"', 'image/png'), body: 'R' }],
      415,
    ],
    [
      'audio over the cap',
      [
        field('title', 'x'),
        { headers: fileHeaders('name="audio"; filename="a.wav"'), body: wavFile(2049) },
      ],
      413,
    ],
    [
      'too many parts',
      [field('title', 'x'), field('number', '1'), field('extra', '1'), field('more', '1')],
      413,
    ],
  ] as const) {
    test(`${label} is ${status} and creates nothing`, async () => {
      const count = app.ctx.episodes.ofShow('quiet').length
      const { body, contentType } = multipart(parts as any)
      const res = await post(body, contentType)
      strictEqual(res.status, status)
      const error = (await res.json()).error
      ok(error && 'FastifyError' !== error, error)
      strictEqual(app.ctx.episodes.ofShow('quiet').length, count)
    })
  }

  test('a JSON body is not a multipart create', async () => {
    const res = await post(Buffer.from('{"title":"x"}'), 'application/json')
    strictEqual(res.status, 415)
  })

  test('the show must exist', async () => {
    const form = new FormData()
    form.set('title', 'x')
    form.set('audio', new Blob([new Uint8Array(wavFile(10))], { type: 'audio/wav' }), 'a.wav')
    const res = await app.call('/api/show/nope/episode', { method: 'POST', body: form })
    strictEqual(res.status, 404)
  })
})
