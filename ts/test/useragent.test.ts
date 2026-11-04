import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual, throws } from 'node:assert'

import Path from 'node:path'
import { readdirSync } from 'node:fs'

import { memfs } from 'memfs'

import { SdkGen } from '../dist/sdkgen.js'
import { userAgent } from '../dist/helpers/useragent'

import { makeModel, makeRoot, layeredFs, makeLog, STAGE, SCAFFOLD } from './generateharness'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')

// The transports that send no default agent of their own choosing.
const NO_DEFAULT_AGENT = ['cpp', 'ocaml', 'zig']


function model(useragent?: string, version?: string): any {
  return {
    const: { Name: 'Demo' },
    main: { kit: {
      http: null == useragent ? undefined : { useragent },
      target: { ts: { publish: null == version ? {} : { version } } },
    } },
  }
}


async function generate(targets: string[], extra: string): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})
  const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
  const cwd = process.cwd()
  process.chdir(SCAFFOLD)
  try {
    const res = await sdkgen.generate({ model: makeModel(targets, undefined, extra), root: makeRoot() })
    strictEqual(res.ok, true, 'generation did not report ok')
  }
  finally {
    process.chdir(cwd)
  }
  const out: Record<string, string> = {}
  for (const [path, content] of Object.entries(vol.toJSON() as Record<string, string>)) {
    out[Path.relative(STAGE, path).split(Path.sep).join('/')] = content
  }
  return out
}


describe('main.kit.http.useragent', () => {

  test('unset, the agent is browser-shaped', () => {
    strictEqual(userAgent(model(), 'ts'), 'Mozilla/5.0 (compatible; DemoSDK/1.0)')
    strictEqual(userAgent(model(''), 'ts'), 'Mozilla/5.0 (compatible; DemoSDK/1.0)')
  })

  test('plain names the SDK and the target release', () => {
    strictEqual(userAgent(model('plain', '1.2.3'), 'ts'), 'DemoSDK/1.2.3')
    strictEqual(userAgent(model('plain'), 'ts'), 'DemoSDK/0.0.1')
  })

  test('any other value is sent as written', () => {
    strictEqual(userAgent(model('MyApp/1.0 ( me@example.com )'), 'ts'), 'MyApp/1.0 ( me@example.com )')
    strictEqual(userAgent(model('demo-sdk/1.0 (+https://x.example/?a=1#c)'), 'ts'),
      'demo-sdk/1.0 (+https://x.example/?a=1#c)')
  })

  test('a value no string literal can hold as written is refused', () => {
    for (const bad of ['a"b', "a'b", 'a\\b', 'a$b', 'a{b}', 'a`b', ' lead', 'trail ', 'a??=b', 'tab\tb', 'é']) {
      throws(() => userAgent(model(bad), 'ts'), /main\.kit\.http\.useragent/, JSON.stringify(bad))
    }
  })

  test('every target generates the declared agent, and no placeholder', async () => {
    const agent = 'DemoApp/2.0 ( dev@example.com )'
    const targets = readdirSync(TM).filter((t) => !['go-cli', 'go-mcp', 'py-data'].includes(t)).sort()
    const out = await generate(targets, `main: kit: http: useragent: '${agent}'`)

    const leaks = Object.entries(out)
      .filter(([, content]) => 'string' === typeof content && content.includes('PROJECTUSERAGENT'))
      .map(([path]) => path)
    deepStrictEqual(leaks, [], 'files that leak the agent placeholder')

    const carrying = targets.filter((t) => Object.entries(out).some(([path, content]) =>
      path.startsWith(t + '/') && 'string' === typeof content && content.includes(agent)))
    deepStrictEqual(carrying, targets.filter((t) => !NO_DEFAULT_AGENT.includes(t)),
      'targets whose transport sends the declared agent')

    const browser = Object.entries(out).filter(([, content]) =>
      'string' === typeof content && content.includes('Mozilla/5.0 (compatible;')).map(([path]) => path)
    deepStrictEqual(browser, [], 'files that still send the browser-shaped agent')
  })
})
