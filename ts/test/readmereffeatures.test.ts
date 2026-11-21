
import { test, describe } from 'node:test'
import { ok } from 'node:assert'

import { Jostraca, Project, Folder, File } from 'jostraca'
import { memfs } from 'memfs'

import { ReadmeRefFeatures } from '../dist/cmp/ReadmeRefFeatures'


// The slice of each feature model the REFERENCE notes read: transport and hooks.
const FEATURES: Record<string, any> = {
  test: { transport: 'base', hook: { PreRequest: { active: true } } },
  retry: { transport: 'wrap' },
  cache: { transport: 'wrap' },
  cost: { transport: 'wrap', hook: { PrePoint: { active: true }, PreDone: { active: true } } },
  log: { hook: { PrePoint: { active: true } } },
  audit: { hook: { PreDone: { active: true } } },
}

async function render(names: string[]): Promise<string> {
  const feature: any = {}
  for (const n of names) {
    feature[n] = { name: n, title: n + ' feature', active: true, ...FEATURES[n] }
  }
  const model = { name: 'demo', main: { kit: { feature, target: { ts: { name: 'ts' } } } } }
  const quiet: any = { info() {}, debug() {}, warn() {}, error() {}, trace() {}, fatal() {} }
  quiet.child = () => quiet
  const { fs, vol } = memfs({})
  await Jostraca().generate({ fs: () => fs, folder: '/x', model, log: quiet }, () => {
    Project({ folder: 'p' }, () => Folder({ name: 'd' }, () => File({ name: 'out.md' }, () => {
      ReadmeRefFeatures({ target: { name: 'ts' } })
    })))
  })
  const json: any = vol.toJSON()
  return json[Object.keys(json).find((k) => k.endsWith('out.md'))!]
}

function section(out: string, name: string): string {
  const at = out.indexOf('#### `' + name + '`')
  const next = out.indexOf('\n#### ', at + 1)
  return out.slice(at, next < 0 ? undefined : next)
}


describe('REFERENCE feature notes', () => {

  test('the base transport is in no hooked list, and never said to skip the transport', async () => {
    const out = await render(['test', 'retry', 'cache', 'log', 'audit'])
    ok(out.includes('`log`, `audit` attach to pipeline hooks') ||
      out.includes('`audit`, `log` attach to pipeline hooks'), out)
    ok(!/`test`[^\n]*attach/.test(out), 'test listed as hooked')
    ok(!section(out, 'test').includes('not the transport'), section(out, 'test'))
    ok(section(out, 'test').includes('Installs the BASE transport'))
  })

  test('one wrapping feature makes no nesting claim', async () => {
    const out = await render(['retry', 'log'])
    ok(!out.includes('#### Ordering'))
    ok(!out.includes('order they nest'))
    ok(section(out, 'retry').includes('- Wraps the transport.\n'))
  })

  test('with no hooked feature there is no hooked sentence', async () => {
    const out = await render(['retry', 'cache'])
    ok(!/^ ?attach/m.test(out), out)
    ok(!out.includes('attach to pipeline hooks\nrather'))
  })

  test('the short-circuit example names a cache only where there is one', async () => {
    ok(!(await render(['retry', 'cost'])).includes('such as a cache'))
    ok((await render(['retry', 'cache'])).includes('such as a cache serving a hit'))
  })

  test('two wrapping features nest: the order sentence, in a code span, and the note', async () => {
    const out = await render(['retry', 'cache', 'log'])
    ok(out.includes('The array form of `feature` is significant'), out)
    ok(!out.includes('\\`'), 'an escaped backtick')
    ok(out.includes('#### Ordering'))
    ok(out.includes('`log` attaches to pipeline hooks'))
  })

  test('a wrapping feature that also hooks says so', async () => {
    const out = await render(['cost', 'retry'])
    ok(section(out, 'cost').includes('- Also attaches to pipeline hooks.'))
    ok(!section(out, 'retry').includes('Also attaches'))
  })
})
