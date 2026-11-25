import { test, describe } from 'node:test'
import { ok, strictEqual } from 'node:assert'

import Path from 'node:path'

import { memfs } from 'memfs'

import { SdkGen } from '../dist/sdkgen.js'
import { STAGE, SCAFFOLD, makeModel, makeRoot, layeredFs, makeLog } from './generateharness'


async function generate(targets: string[], features: string[], extra = ''): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})
  const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog([]) })
  const cwd = process.cwd()
  process.chdir(SCAFFOLD)
  try {
    const res = await sdkgen.generate({
      model: makeModel(targets, undefined, extra, features), root: makeRoot(),
    })
    strictEqual(res.ok, true, 'generation did not report ok')
  }
  finally {
    process.chdir(cwd)
  }
  const out: Record<string, string> = {}
  for (const [p, c] of Object.entries(vol.toJSON() as Record<string, string>)) {
    if (null != c) out[Path.relative(STAGE, p).split(Path.sep).join('/')] = c
  }
  return out
}

// One line, with no blockquote markers.
const flat = (s: string): string => s.replace(/^> ?/gm, '').replace(/\s+/g, ' ')

function section(doc: string, heading: string): string {
  const start = doc.indexOf(heading)
  ok(0 <= start, 'no section ' + heading)
  const next = doc.indexOf('\n#', start + heading.length)
  return doc.slice(start, next < 0 ? undefined : next)
}

const station = (on: boolean) => `
main: kit: feature: station: {
  name: key()
  title: "Station control surface binding"
  active: true
  transport: 'wrap'
  config: options: { active: ${on}, url: '', instance: '', register: true }
  hook: PostConstruct: active: true
  deps: ts: { '@voxgig/station': { active: true, version: '>=0.0.1', kind: peer } }
}
main: kit: target: ts: phase: feature: active: false
`


describe('feature defaults', () => {
  test('the documents name `log` as on by default, and only the others as off', async () => {
    const out = await generate(['ts', 'go'], ['test', 'log', 'retry'])

    for (const t of ['ts', 'go']) {
      const readme = flat(section(out[t + '/README.md'], '## Features'))
      ok(readme.includes('This SDK ships 3 optional features.'), t + ': count')
      ok(readme.includes('`log` is **on by default** and runs until you switch it off.'), t + ': log on')
      ok(readme.includes('The others are **inactive until you switch them on**.'), t + ': the others off')
      ok(!readme.includes('Each is **inactive'), t + ': no blanket claim')

      const ref = out[t + '/REFERENCE.md']
      ok(flat(ref).includes('`log` is active by default; every other feature is inactive until switched on.'),
        t + ': reference lead')
      const log = flat(section(ref, '#### `log`'))
      ok(log.includes('Active by default: set `feature.log.active` to false to switch it off.'), t + ': log on')
      ok(!log.includes('Inactive by default'), t + ': log is not inactive by default')
      ok(flat(section(ref, '#### `retry`')).includes('Inactive by default'), t + ': retry off')
    }

    const root = flat(out['README.md'])
    ok(root.includes('— configured per client. `log` runs by default; the rest are opt-in, ' +
      'inactive until switched on.'), 'root line')
    ok(!root.includes('— opt-in,'), 'no blanket opt-in')
  })

  test('with every feature off, the lead-in names none on, and no retries or cache', async () => {
    const out = await generate(['ts'], ['test'])
    const readme = flat(section(out['ts/README.md'], '## Features'))
    ok(readme.includes('This SDK ships 1 optional feature. It is **inactive until you switch it on**'),
      'a lone feature')
    ok(!/retries|cache|logging/.test(readme), 'names no feature the model lacks')
    ok(flat(out['ts/REFERENCE.md']).includes('Each feature is inactive until switched on'), 'reference lead')
    ok(flat(out['README.md']).includes('`test` — opt-in, inactive until switched on'), 'root line')
  })

  test('station says what its default is', async () => {
    for (const on of [false, true]) {
      const out = await generate(['ts'], ['test', 'log'], station(on))
      const readme = flat(out['ts/README.md'])
      const agents = flat(out['AGENTS.md'])
      ok(readme.includes(on ? 'The feature is present and **on by default**.' :
        'The feature is present but **off by default** — nothing changes until you bind.'), 'readme ' + on)
      ok(agents.includes('`station` feature, ' + (on ? 'on' : 'off') + ' by default'), 'agent guide ' + on)
    }
  })
})
