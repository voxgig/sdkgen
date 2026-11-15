
import { test, describe } from 'node:test'
import { strictEqual, ok, match } from 'node:assert'

import { Jostraca, Project, Folder, File } from 'jostraca'
import { memfs } from 'memfs'

import { ReadmeExplanation, ReadmeErrors, ReadmeRefFeatures } from '../dist/sdkgen.js'


// A logger stub keeps the optional-component warning out of the test
// output (the per-language ReadmeExplanation_<lang> file
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
        moon: {
          active: true, name: 'moon', fields: { id: { n: 'id' } },
          op: { load: { active: true, points: [{ g: { params: [{ n: 'id', t: '$INTEGER' }] } }] } },
        },
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
    // direct() returns the result envelope in every language: branch on `ok`,
    // read `err` on failure (never index a failure-only key on the success
    // shape).
    ok((await renderErrors('ts')).includes('if (!result.ok) {'))
    ok(!(await renderErrors('ts')).includes('instanceof Error'))
    ok((await renderErrors('py')).includes('if not result["ok"]'))
    ok((await renderErrors('py')).includes('result.get("err")'))
    // js and an unmodelled language fall back to the ts default.
    strictEqual(await renderErrors('js'), await renderErrors('ts'))
    ok((await renderErrors('cobol')).includes('if (!result.ok) {'))
  })
})


// The REFERENCE features section, from a feature model like the shipped
// one: a feature's `transport` and `hook` say what it attaches to.
type FeatSpec = { transport?: string, hook?: string[], options?: any, optspec?: any }
function featureModel(feats: Record<string, FeatSpec>) {
  const feature: any = {}
  for (const [name, f] of Object.entries(feats)) {
    feature[name] = {
      active: true, name, title: name.toUpperCase(), transport: f.transport || 'none',
      hook: Object.fromEntries((f.hook || []).map((h) => [h, { active: true }])),
      config: { options: { active: false, ...(f.options || {}) }, ...(f.optspec ? { optspec: f.optspec } : {}) },
    }
  }
  return { name: 'demo', main: { kit: { entity: {}, feature } } }
}

async function renderRefFeatures(feats: Record<string, FeatSpec>, props: any = {}): Promise<string> {
  const { fs, vol } = memfs({})
  await Jostraca().generate(
    { fs: () => fs, folder: '/x', model: featureModel(feats), log },
    () => {
      Project({ folder: 'p' }, () => {
        File({ name: 'out.md' }, () => { ReadmeRefFeatures({ target: { name: 'ts' }, ...props }) })
      })
    },
  )
  const json: any = vol.toJSON()
  return json[Object.keys(json).find((k) => k.endsWith('out.md'))!]
}

// '#### `name`' subsection.
const featSection = (md: string, name: string): string => {
  const out: string[] = []
  let on = false
  for (const l of md.split('\n')) {
    if (/^#{1,4} /.test(l)) on = l === '#### `' + name + '`'
    if (on) out.push(l)
  }
  return out.join('\n')
}

const SHIPPED: Record<string, FeatSpec> = {
  cache: { transport: 'wrap' },
  cost: { transport: 'wrap', hook: ['PrePoint', 'PreDone'] },
  retry: { transport: 'wrap' },
  log: { hook: ['PreRequest'], options: { active: true } },
  audit: { hook: ['PreDone'] },
  test: { transport: 'base', hook: ['PreRequest'] },
}


describe('ReadmeRefFeatures', () => {

  test('the base transport is neither a hook feature nor said to attach to hooks (X3)', async () => {
    const out = await renderRefFeatures(SHIPPED)
    const hookLine = out.split('\n').find((l) => / attach(es)? to pipeline hooks/.test(l)) || ''
    ok(!hookLine.includes('`test`'), hookLine)
    ok(hookLine.includes('`audit`') && hookLine.includes('`log`'), hookLine)
    const test = featSection(out, 'test')
    ok(!/[Aa]ttaches to pipeline hooks/.test(test), test)
    ok(/Installs the BASE transport/.test(test), test)
    // A wrapper that also declares hooks says both, as the model declares.
    const cost = featSection(out, 'cost')
    ok(/Wraps the transport/.test(cost) && /Also attaches to pipeline hooks\./.test(cost), cost)
    ok(!/Also attaches/.test(featSection(out, 'retry')))
    ok(/Attaches to pipeline hooks, not the transport/.test(featSection(out, 'audit')))
  })

  test('the ordering note names a cache only where the cache feature is present (S22)', async () => {
    const without = { ...SHIPPED }
    delete without.cache
    const out = await renderRefFeatures(without)
    ok(/a feature that short-circuits the\s+call stops every feature nested/.test(out), out)
    ok(!/cache/.test(out.split('#### `')[0]), 'no cache in the ordering note')
    const nocost = { ...SHIPPED }
    delete nocost.cost
    ok(/such as a cache serving a hit/.test(await renderRefFeatures(nocost)))
  })
})
