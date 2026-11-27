import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import { createHash } from 'node:crypto'
import { describe, test } from 'node:test'
import { inflateSync } from 'node:zlib'
import { BufferContent, collect } from '../../src/content/content.js'
import { checkDigest, etagOf, parseDigestField, reprDigest } from '../../src/content/digest.js'
import { generatePng, PNG_SIGNATURE } from '../../src/content/png.js'
import { GeneratedWav, WAV_HEADER_SIZE, wavBytes } from '../../src/content/wav.js'

describe('GeneratedWav', () => {
  test('header describes a PCM WAV of the requested size', async () => {
    const wav = new GeneratedWav(3, 1000)
    const head = await collect(wav.read(0, WAV_HEADER_SIZE))
    strictEqual(head.toString('ascii', 0, 4), 'RIFF')
    strictEqual(head.readUInt32LE(4), 992)
    strictEqual(head.toString('ascii', 8, 16), 'WAVEfmt ')
    strictEqual(head.readUInt16LE(20), 1)
    strictEqual(head.toString('ascii', 36, 40), 'data')
    strictEqual(head.readUInt32LE(40), 1000 - WAV_HEADER_SIZE)
  })

  test('any range equals the same slice of the whole', async () => {
    const wav = new GeneratedWav(5, 200_001)
    const whole = await collect(wav.read(0, wav.size))
    strictEqual(whole.length, 200_001)
    for (const [start, end] of [
      [0, 1],
      [10, 60],
      [43, 45],
      [44, 45],
      [65_535, 131_073],
      [199_999, 200_001],
    ]) {
      deepStrictEqual(await collect(wav.read(start, end)), whole.subarray(start, end))
      deepStrictEqual(wavBytes(5, 200_001, start, end), whole.subarray(start, end))
    }
  })

  test('is deterministic per seed and differs between seeds', async () => {
    const a = await collect(new GeneratedWav(1, 5000).read(0, 5000))
    const b = await collect(new GeneratedWav(1, 5000).read(0, 5000))
    const c = await collect(new GeneratedWav(2, 5000).read(0, 5000))
    deepStrictEqual(a, b)
    ok(!a.subarray(WAV_HEADER_SIZE).equals(c.subarray(WAV_HEADER_SIZE)))
  })

  test('digest is the SHA-256 of the bytes it serves', async () => {
    const wav = new GeneratedWav(9, 70_001)
    const whole = await collect(wav.read(0, wav.size))
    deepStrictEqual(await wav.sha256(), createHash('sha256').update(whole).digest())
  })

  test('refuses a size that cannot hold a header', () => {
    throws(() => new GeneratedWav(1, WAV_HEADER_SIZE - 1))
    throws(() => new GeneratedWav(1.5, 100))
  })
})

describe('generatePng', () => {
  test('is a PNG whose image data inflates to the declared size', () => {
    const png = generatePng(7, 4, 3)
    ok(png.subarray(0, 8).equals(PNG_SIGNATURE))
    strictEqual(png.toString('ascii', 12, 16), 'IHDR')
    strictEqual(png.readUInt32BE(16), 4)
    strictEqual(png.readUInt32BE(20), 3)
    const idatAt = png.indexOf('IDAT')
    const length = png.readUInt32BE(idatAt - 4)
    const raw = inflateSync(png.subarray(idatAt + 4, idatAt + 4 + length))
    strictEqual(raw.length, (1 + 4 * 3) * 3)
    ok(png.subarray(-8, -4).equals(Buffer.from('IEND')))
  })
})

describe('digest', () => {
  const bytes = Buffer.from('hello')
  const sha = createHash('sha256').update(bytes).digest()
  const sha512 = createHash('sha512').update(bytes).digest()

  test('formats RFC 9530 and a strong etag', () => {
    strictEqual(reprDigest(sha), `sha-256=:${sha.toString('base64')}:`)
    ok(/^"[A-Za-z0-9_-]+"$/.test(etagOf(sha)))
  })

  test('parses a dictionary and rejects a malformed one', () => {
    const field = parseDigestField(`sha-256=:${sha.toString('base64')}:, md5=:AAAA:`)!
    deepStrictEqual([...field.keys()], ['sha-256', 'md5'])
    strictEqual(parseDigestField('sha-256=abc'), null)
    strictEqual(parseDigestField(''), null)
  })

  test('checks the algorithms it knows and ignores the rest', () => {
    strictEqual(checkDigest(reprDigest(sha), bytes), 'ok')
    strictEqual(checkDigest(`sha-512=:${sha512.toString('base64')}:`, bytes), 'ok')
    strictEqual(checkDigest(reprDigest(sha), Buffer.from('other')), 'mismatch')
    strictEqual(checkDigest('md5=:XUFAKrxLKna5cZ2REBfFkg==:', bytes), 'unsupported')
    strictEqual(checkDigest('nonsense', bytes), 'malformed')
  })

  test('BufferContent hashes and slices its bytes', async () => {
    const content = new BufferContent(bytes, 'text/plain')
    deepStrictEqual(await content.sha256(), sha)
    strictEqual((await collect(content.read(1, 3))).toString(), 'el')
  })
})
