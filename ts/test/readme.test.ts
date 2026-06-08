
import { test, describe } from 'node:test'
import { strictEqual, ok, match } from 'node:assert'

import { Jostraca, Project, Folder, File } from 'jostraca'
import { memfs } from 'memfs'

import { ReadmeExplanation } from '../dist/sdkgen.js'


// A logger stub keeps requirePath's "optional template missing" warning
// out of the test output (the per-language ReadmeExplanation_<lang> file
// does not exist under the in-memory folder, which is expected).
const noop = () => {}
const log: any = {
  info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
  child() { return log },
}

function makeModel() {
  return {
    name: 'demo',
    main: { kit: { feature: {
      test: { active: true, name: 'test', title: 'Test mode (offline)' },
      log: { active: true, name: 'log', title: 'Structured logging' },
      retry: { active: false, name: 'retry', title: 'Retry' },
    } } },
  }
}

async function renderExplanation(langName: string): Promise<string> {
  const { fs, vol } = memfs({})
  const jostraca = Jostraca()

  await jostraca.generate(
    { fs: () => fs, folder: '/x', model: makeModel(), log },
    () => {
      Project({ folder: 'p' }, () => {
        Folder({ name: 'd' }, () => {
          File({ name: 'out.md' }, () => {
            ReadmeExplanation({ target: { name: langName } })
          })
        })
      })
    },
  )

  const json: any = vol.toJSON()
  const key = Object.keys(json).find((k) => k.endsWith('out.md'))!
  return json[key]
}


describe('ReadmeExplanation', () => {

  test('renders the shared scaffolding for every language', async () => {
    for (const lang of ['py', 'php', 'rb', 'lua', 'go', 'ts', 'js', 'java']) {
      const out = await renderExplanation(lang)
      ok(out.includes('## Explanation'), `${lang}: explanation heading`)
      ok(out.includes('### The operation pipeline'), `${lang}: pipeline heading`)
      ok(
        out.includes('PrePoint → PreSpec → PreRequest → PreResponse → PreResult → PreDone'),
        `${lang}: pipeline diagram`,
      )
      ok(out.includes('### Features and hooks'), `${lang}: features heading`)
      ok(out.includes('### Entity state'), `${lang}: entity state heading`)
      ok(out.includes('### Direct vs entity access'), `${lang}: direct heading`)
    }
  })

  test('lists active features (sorted) and omits inactive ones', async () => {
    const out = await renderExplanation('ts')
    // Sorted by key: log before test. 'retry' is inactive → excluded.
    match(out, /- \*\*LogFeature\*\*: Structured logging\n- \*\*TestFeature\*\*: Test mode \(offline\)/)
    ok(!out.includes('RetryFeature'), 'inactive feature excluded')
  })

  test('python variant', async () => {
    const out = await renderExplanation('py')
    ok(out.includes('return tuple'))
    ok(out.includes('```python'))
    ok(out.includes('A feature is a Python class'))
    ok(out.includes('moon.data_get()'))
  })

  test('php variant', async () => {
    const out = await renderExplanation('php')
    ok(out.includes('return array'))
    ok(out.includes('```php'))
    ok(out.includes('A feature is a PHP class'))
    ok(out.includes('$moon->dataGet()'))
  })

  test('ruby variant (no-paren accessors)', async () => {
    const out = await renderExplanation('rb')
    ok(out.includes('as a second return value'))
    ok(out.includes('```ruby'))
    ok(out.includes('A feature is a Ruby class'))
    ok(out.includes('# moon.data_get now returns')) // no-paren accessor
    ok(out.includes('Call `make` to create')) // no parens
  })

  test('lua variant', async () => {
    const out = await renderExplanation('lua')
    ok(out.includes('```lua'))
    ok(out.includes('A feature is a Lua table'))
    ok(out.includes('client:Moon(nil)'))
  })

  test('go variant', async () => {
    const out = await renderExplanation('go')
    ok(out.includes('An unexpected panic triggers'))
    ok(out.includes('```go'))
    ok(out.includes('map[string]any'))
    ok(out.includes('`Feature` interface'))
    ok(out.includes('moon.Data()'))
    ok(out.includes('`Direct()` gives full control'))
  })

  test('default variant (ts) and js/unknown fall back to it', async () => {
    const ts = await renderExplanation('ts')
    ok(ts.includes('An unexpected exception triggers'))
    ok(ts.includes('```ts'))
    ok(ts.includes('moon.data()'))
    ok(ts.includes('A feature is an object with a'))
    ok(ts.includes('The `direct` method gives full control'))

    // js and an unmodelled language use the same default prose as ts.
    strictEqual(await renderExplanation('js'), ts)
    const cobol = await renderExplanation('cobol')
    ok(cobol.includes('A feature is an object with a'))
    ok(cobol.includes('```ts'))
  })
})
