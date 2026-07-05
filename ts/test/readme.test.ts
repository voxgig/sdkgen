
import { test, describe } from 'node:test'
import { strictEqual, ok, match } from 'node:assert'

import { Jostraca, Project, Folder, File } from 'jostraca'
import { memfs } from 'memfs'

import { ReadmeExplanation, ReadmeErrors } from '../dist/sdkgen.js'


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
    main: { kit: {
      entity: {
        // An id-bearing entity: the id-like key drives the load-example match
        // (`{ id: ... }` / `map[string]any{"id": ...}`). An entity with no id
        // field would instead degrade to a no-argument load (entityIdField ->
        // null), which is exercised end-to-end by the id-less SDK targets.
        moon: { active: true, name: 'moon', fields: { id: { name: 'id' } } },
      },
      feature: {
        test: { active: true, name: 'test', title: 'Test mode (offline)' },
        log: { active: true, name: 'log', title: 'Structured logging' },
        retry: { active: false, name: 'retry', title: 'Retry' },
      },
    } },
  }
}

async function render(comp: any, langName: string): Promise<string> {
  const { fs, vol } = memfs({})
  const jostraca = Jostraca()

  await jostraca.generate(
    { fs: () => fs, folder: '/x', model: makeModel(), log },
    () => {
      Project({ folder: 'p' }, () => {
        Folder({ name: 'd' }, () => {
          File({ name: 'out.md' }, () => {
            comp({ target: { name: langName } })
          })
        })
      })
    },
  )

  const json: any = vol.toJSON()
  const key = Object.keys(json).find((k) => k.endsWith('out.md'))!
  return json[key]
}

const renderExplanation = (langName: string) => render(ReadmeExplanation, langName)
const renderErrors = (langName: string) => render(ReadmeErrors, langName)


describe('ReadmeExplanation', () => {

  test('renders the shared scaffolding for every language', async () => {
    for (const lang of ['py', 'php', 'rb', 'lua', 'go', 'ts', 'js', 'java']) {
      const out = await renderExplanation(lang)
      // The pipeline + feature hooks are demoted to an advanced/internal
      // section, no longer a prominent "Explanation".
      ok(out.includes('## Advanced'), `${lang}: advanced heading`)
      ok(!out.includes('## Explanation'), `${lang}: no explanation heading`)
      ok(out.includes('### The operation pipeline'), `${lang}: pipeline heading`)
      ok(
        out.includes('PrePoint → PreSpec → PreRequest → PreResponse → PreResult → PreDone'),
        `${lang}: pipeline diagram`,
      )
      ok(out.includes('### Features and hooks'), `${lang}: features heading`)
      ok(out.includes('### Entity state'), `${lang}: entity state heading`)
      ok(out.includes('### Direct vs entity access'), `${lang}: direct heading`)
      // Error-handling detail now lives in its own section; the pipeline
      // only cross-links to it.
      ok(out.includes('[Error handling](#error-handling)'), `${lang}: error cross-ref`)
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
    ok(out.includes('```python'))
    ok(out.includes('A feature is a Python class'))
    ok(out.includes('moon.data_get()'))
  })

  test('php variant', async () => {
    const out = await renderExplanation('php')
    ok(out.includes('```php'))
    ok(out.includes('A feature is a PHP class'))
    ok(out.includes('$moon->data_get()')) // snake_case matches generated PHP
  })

  test('ruby variant (no-paren accessors)', async () => {
    const out = await renderExplanation('rb')
    ok(out.includes('```ruby'))
    ok(out.includes('A feature is a Ruby class'))
    ok(out.includes('# moon.data_get now returns')) // no-paren accessor
    ok(out.includes('Call `make` to create')) // no parens
  })

  test('lua variant', async () => {
    const out = await renderExplanation('lua')
    ok(out.includes('```lua'))
    ok(out.includes('A feature is a Lua table'))
    ok(out.includes('client:Moon()')) // capitalised entity accessor
  })

  test('go variant', async () => {
    const out = await renderExplanation('go')
    ok(out.includes('```go'))
    ok(out.includes('map[string]any'))
    ok(out.includes('`Feature` interface'))
    ok(out.includes('moon.Data()'))
    ok(out.includes('`Direct()` gives full control'))
  })

  test('default variant (ts) and js/unknown fall back to it', async () => {
    const ts = await renderExplanation('ts')
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


describe('ReadmeErrors', () => {

  test('renders an Error handling section for every language', async () => {
    for (const lang of ['py', 'php', 'rb', 'lua', 'go', 'ts', 'js', 'java']) {
      const out = await renderErrors(lang)
      ok(out.includes('## Error handling'), `${lang}: error handling heading`)
      // The example uses the real model entity, never a phantom one.
      ok(/[Mm]oon/.test(out), `${lang}: references the example entity`)
    }
  })

  test('throwing languages show try/catch on the entity op', async () => {
    ok((await renderErrors('ts')).includes('} catch (err) {'))
    ok((await renderErrors('py')).includes('except Exception as err:'))
    ok((await renderErrors('php')).includes('} catch (\\Throwable $err) {'))
    ok((await renderErrors('rb')).includes('rescue => err'))
  })

  test('value-return languages check err instead of throwing', async () => {
    const go = await renderErrors('go')
    ok(go.includes('(value, error)'))
    ok(go.includes('if err != nil {'))
    ok(go.includes('client.Moon(nil).Load'))

    const lua = await renderErrors('lua')
    ok(lua.includes('(value, err)'))
    ok(lua.includes('if err then error(err) end'))
    ok(lua.includes('client:Moon():load'))
  })

  test('direct() convention is documented per language', async () => {
    // ts/js: direct() returns the value or an Error. py: returns the result
    // envelope — branch on `ok`, read `err` on failure (never index a
    // failure-only key on the success shape).
    ok((await renderErrors('ts')).includes('result instanceof Error'))
    ok((await renderErrors('py')).includes('if not result["ok"]'))
    ok((await renderErrors('py')).includes('result.get("err")'))
    // js and an unmodelled language fall back to the ts default.
    strictEqual(await renderErrors('js'), await renderErrors('ts'))
    ok((await renderErrors('cobol')).includes('result instanceof Error'))
  })
})
