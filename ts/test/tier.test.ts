
import { test, describe, before, after } from 'node:test'
import { ok, deepStrictEqual, strictEqual } from 'node:assert'

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'
import { KIT } from '@voxgig/apidef'

import { SdkGen, CODECS, CODEC_DIR, CODEC_TIERS, atTier, bodyNote, codecTier } from '../dist/sdkgen'

import { STAGE, layeredFs, makeLog, makeModel, makeRoot } from './generateharness'
import { CODEC_MODEL } from './codeccases'


// Each target declares, in its model, how far it has come in moving bodies
// that are not JSON (`codec.tier`). What a tier claims is checked here: a
// target at `encoded` ships a source per codec and a suite that drives them,
// and has a lane that runs that suite; a target below it ships neither, and
// its reference says it does not encode yet.

const SDK = Path.resolve(__dirname, '..', 'project', '.sdk')
const TM = Path.join(SDK, 'tm')

const SUITE = /^(test_?codec|codec[._-]?test)(\.[^/.]+)+$/i


function allTargets(): string[] {
  return readdirSync(Path.join(SDK, 'model', 'target'))
    .filter((f: string) => f.endsWith('.aontu') && 'target-index.aontu' !== f)
    .map((f: string) => f.replace(/\.aontu$/, ''))
    .sort()
}

const MODEL = makeModel(allTargets(), undefined, '', [])
const TARGETS: Record<string, any> = MODEL.main[KIT].target

// The SDK targets: a consumer wraps another target's codecs.
const SDK_TARGETS = Object.keys(TARGETS).filter((t) => '' === TARGETS[t].consumes).sort()


function walk(dir: string, rel = ''): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).sort().flatMap((name: string) => {
    const abs = Path.join(dir, name)
    const sub = '' === rel ? name : rel + '/' + name
    return statSync(abs).isDirectory() ? walk(abs, sub) : [sub]
  })
}


// The codec sources and the suite a target's templates hold.
function shipped(target: string): { codecs: string[], suites: string[] } {
  const files = walk(Path.join(TM, target))
  const codecs = files.filter((f) => f.split('/').slice(0, -1).includes(CODEC_DIR))
    .map((f) => f.split('/').pop()!.replace(/(\.[^.]+)+$/, '').toLowerCase()
      .replace(/[_-]?codec$/, ''))
  const suites = files.filter((f) => !f.split('/').includes(CODEC_DIR) &&
    SUITE.test(f.split('/').pop()!))
  return { codecs: [...new Set(codecs)].sort(), suites }
}


// The targets with a row in the codec lane of the compile suite.
function laneTargets(): string[] {
  const src = readFileSync(Path.resolve(__dirname, '..', 'test', 'generatedcompile.test.ts'), 'utf8')
  const start = src.indexOf('const CODEC_LANES')
  ok(0 <= start, 'the compile suite has no CODEC_LANES')
  const block = src.slice(start, src.indexOf('\n]\n', start))
  return [...block.matchAll(/^\s{4}target: '([\w-]+)'/gm)].map((m) => m[1]).sort()
}


const MULTIPART_OP = {
  points: [{ rb: { kind: 'multipart', media: 'multipart/form-data',
    fields: [{ name: 'file', binary: true }] } }],
}


describe('codec tier', () => {

  test('every target declares a tier the table knows', () => {
    for (const t of Object.keys(TARGETS)) {
      const tier = TARGETS[t].codec?.tier
      ok(CODEC_TIERS.includes(tier), t + ': codec.tier is ' + JSON.stringify(tier))
    }
  })

  test('the tier table: ts and js encode; the others do not yet', () => {
    const table = Object.fromEntries(SDK_TARGETS.map((t) => [t, codecTier(TARGETS[t])]))
    const encoded = SDK_TARGETS.filter((t) => atTier(TARGETS[t], 'encoded'))
    deepStrictEqual(encoded, ['clojure', 'csharp', 'elixir', 'go', 'java', 'js', 'kotlin', 'lua', 'ocaml', 'perl', 'php', 'py', 'rb', 'rust', 'scala', 'swift', 'ts', 'zig'], JSON.stringify(table))
  })

  for (const t of SDK_TARGETS) {
    test(t + ': ships what its tier claims, and claims what it ships', () => {
      const { codecs, suites } = shipped(t)
      const lane = laneTargets().includes(t)
      if (atTier(TARGETS[t], 'encoded')) {
        deepStrictEqual(codecs, [...CODECS].sort(), t + ': a codec source is missing')
        strictEqual(suites.length, 1, t + ': no codec suite, or more than one: ' + suites)
        ok(lane, t + ': no codec lane in generatedcompile.test.ts')
        ok(!bodyNote(MULTIPART_OP, { values: 'x', tier: codecTier(TARGETS[t]) })
          .includes('does not encode yet'), t + ': the reference still says it does not encode')
      }
      else {
        deepStrictEqual(codecs, [], t + ': ships codec source below the encoded tier')
        deepStrictEqual(suites, [], t + ': ships a codec suite below the encoded tier')
        ok(!lane, t + ': has a codec lane below the encoded tier')
        ok(bodyNote(MULTIPART_OP, { values: 'x', tier: codecTier(TARGETS[t]) })
          .includes('does not encode yet'), t + ': the reference must say it does not encode yet')
      }
    })
  }
})


describe('codec tier: the generated reference reads it', () => {

  let cwd = ''

  before(() => {
    cwd = process.cwd()
    process.chdir(SDK)
  })

  after(() => {
    if ('' !== cwd) process.chdir(cwd)
  })

  for (const t of ['ts', 'js', 'go']) {
    test(t + ': the multipart create is documented by its tier', async () => {
      const { fs, vol } = memfs({})
      const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
      const res = await sdkgen.generate({ model: makeModel([t], undefined, CODEC_MODEL),
        root: makeRoot() })
      strictEqual(res.ok, true)
      const files = vol.toJSON() as Record<string, string>
      const ref = Object.keys(files).find((p) => p.endsWith('/' + t + '/REFERENCE.md'))
      ok(null != ref, t + ': no REFERENCE.md')
      const text = String(files[ref!])
      if (atTier(TARGETS[t], 'encoded')) {
        ok(!text.includes('does not encode yet'), t + ': ' + ref)
        ok(text.includes('as multipart parts, as `multipart/form-data`'), t + ': ' + ref)
      }
      else {
        ok(text.includes('`multipart/form-data` body, which this SDK does not encode yet'), t + ': ' + ref)
      }
    })
  }
})
