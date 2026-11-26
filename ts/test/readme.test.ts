
import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual, ok, match } from 'node:assert'

import { Jostraca, Project, Folder, File } from 'jostraca'
import { memfs } from 'memfs'

import { ReadmeExplanation, ReadmeErrors, applyFacts } from '../dist/sdkgen.js'
import { ReadmeStation } from '../dist/cmp/ReadmeStation.js'
import { PIPELINE_STAGES, pipelineLength } from '../dist/cmp/FeatureHook'
import { generateDocs } from './textguard'


// A logger stub keeps the optional-component warning out of the test
// output (the per-language ReadmeExplanation_<lang> file
// does not exist under the in-memory folder, which is expected).
const noop = () => {}
const log: any = {
  info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
  child() { return log },
}

function makeModel() {
  return applyFacts({
    name: 'demo',
    const: { name: 'demo', Name: 'Demo' },
    main: { kit: {
      entity: {
        moon: {
          active: true, name: 'moon', fields: { id: { n: 'id' } },
          op: { load: { active: true, points: [{ g: { params: [{ n: 'id', t: '$INTEGER' }] } }] } },
        },
      },
      feature: {
        test: { active: true, name: 'test', title: 'Test mode (offline)', config: { options: { active: false } } },
        log: { active: true, name: 'log', title: 'Structured logging', config: { options: { active: true } } },
        retry: { active: false, name: 'retry', title: 'Retry', config: { options: { active: false } } },
      },
    } },
  })
}

async function render(comp: any, langName: string, model: any = makeModel()): Promise<string> {
  const { fs, vol } = memfs({})
  const jostraca = Jostraca()

  await jostraca.generate(
    { fs: () => fs, folder: '/x', model, log },
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

// The bundled languages outside EXAMPLE_LANGS, with their fence tags.
const FENCE: Record<string, string> = {
  c: 'c', clojure: 'clojure', cpp: 'cpp', csharp: 'csharp', elixir: 'elixir', java: 'java',
  kotlin: 'kotlin', ocaml: 'ocaml', perl: 'perl', rust: 'rust', scala: 'scala', swift: 'swift',
  zig: 'zig',
}

function fences(text: string): string[] {
  const tags = [...text.matchAll(/^```(\S*)$/gm)].map((m) => m[1]).filter((t) => '' !== t)
  return [...new Set(tags)]
}


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

  test('ts and js share one row in their own fences; an unknown origin writes no code', async () => {
    const ts = await renderExplanation('ts')
    ok(ts.includes('```ts'))
    ok(ts.includes('moon.data()'))
    ok(ts.includes('A feature is an object with a'))
    ok(ts.includes('The `direct` method gives full control'))

    strictEqual(await renderExplanation('js'), ts.replace(/```ts\n/g, '```js\n'))
    const cobol = await renderExplanation('cobol')
    deepStrictEqual(fences(cobol), [], 'an unknown origin borrows no code')
    ok(!cobol.includes('### Entity state'), 'an unknown origin has no entity objects to describe')
    ok(cobol.includes('The `direct` method gives full control'))
  })

  // lean has no entity object: its ops are free functions over the client.
  test('a lean origin says nothing of entity state', async () => {
    const lean = await renderExplanation('lean')
    ok(!lean.includes('Entity instances are stateful'))
    deepStrictEqual(fences(lean), [])
  })

  test('every bundled language writes its own row, in its own fence', async () => {
    for (const [lang, own] of Object.entries(FENCE)) {
      const out = await renderExplanation(lang)
      deepStrictEqual(fences(out), [own], lang + ': fences')
      ok(out.includes('Entity instances are stateful'), lang + ': entity state')
      ok(!out.includes('A feature is an object with a'), lang + ': the ts feature prose')
    }
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
    strictEqual(await renderErrors('js'), (await renderErrors('ts')).replace(/```ts\n/g, '```js\n'))
    const cobol = await renderErrors('cobol')
    ok(cobol.includes('## Error handling'))
    deepStrictEqual(fences(cobol), [], 'an unknown origin borrows no code')
  })

  test('the c Error handling section shows c, never ts', async () => {
    const c = await renderErrors('c')
    ok(!c.includes('```ts'))
    ok(c.includes('```c\n'))
    ok(c.includes('moon->vt->load(moon, cmap(1, "id", v_num(1)), NULL, &err);'))
  })

  test('every bundled language writes its own row, in its own fence', async () => {
    for (const [lang, own] of Object.entries(FENCE)) {
      const out = await renderErrors(lang)
      deepStrictEqual(fences(out), [own], lang + ': fences')
      ok(/[Mm]oon/.test(out), lang + ': references the example entity')
      ok(out.includes('example_id'), lang + ': the direct() example')
    }
  })
})


describe('ReadmeStation', () => {

  const stationModel = (station: any, auth: boolean, target: any) => applyFacts({
    name: 'demo', const: { Name: 'Demo', name: 'demo' },
    main: { kit: {
      entity: {},
      config: { auth: { active: auth } },
      target,
      feature: {
        station: { name: 'station', config: { options: { active: false } }, ...station },
      },
    } },
  })

  async function renderStation(model: any, target: any): Promise<string> {
    const { fs, vol } = memfs({})
    await Jostraca().generate({ fs: () => fs, folder: '/x', model, log }, () => {
      Project({ folder: 'p' }, () => Folder({ name: 'd' }, () => File({ name: 'out.md' }, () => {
        ReadmeStation({ target })
      })))
    })
    const json: any = vol.toJSON()
    return json[Object.keys(json).find((k) => k.endsWith('out.md'))!] ?? ''
  }

  const ts = { ts: { name: 'ts' } }

  test('an inactive station feature writes no section', async () => {
    const out = await renderStation(stationModel({ active: false }, true, ts), ts.ts)
    ok(!/Use with Station/.test(out), out)
  })

  test('an active station feature writes the section', async () => {
    const out = await renderStation(stationModel({ active: true }, true, ts), ts.ts)
    match(out, /## Use with Station/)
    match(out, /### The secret name derives from the instance/)
  })

  test('a station on by default says so', async () => {
    const on = { active: true, config: { options: { active: true } } }
    const out = await renderStation(stationModel(on, true, ts), ts.ts)
    match(out, /present and \*\*on by default\*\*\./)
    ok(!/off by default/.test(out), out)
  })

  test('an API with no credential gets no secret-name paragraph', async () => {
    const out = await renderStation(stationModel({ active: true }, false, ts), ts.ts)
    match(out, /## Use with Station/)
    ok(!/secret name|APIKEY/.test(out), out)
  })

  test('an alias binds the way its origin does', async () => {
    const target = { ts2: { name: 'ts2', origname: 'ts' } }
    const out = await renderStation(stationModel({ active: true }, true, target), target.ts2)
    match(out, /### Imperative: `connect\(\)`/)
  })
})


describe('the pipeline in both READMEs', () => {

  test('the root and target READMEs count the same stages, from one constant', async () => {
    const run = await generateDocs({
      id: 'stages', family: 'stages', targets: ['ts', 'go'], features: ['test', 'log'], extra: '',
    })
    for (const doc of ['README.md', 'ts/README.md', 'go/README.md']) {
      const counts = [...run.files[doc].matchAll(/(\w+)-stage pipeline/g)].map((m) => m[1])
      deepStrictEqual([...new Set(counts)], [pipelineLength()], doc)
    }
    for (const s of PIPELINE_STAGES) {
      ok(run.files['README.md'].includes('**' + s.name + '** — ' + s.purpose), 'root: ' + s.name)
      ok(run.files['ts/README.md'].includes('- **' + s.hook + '**: ' + s.purpose), 'ts: ' + s.hook)
    }
  })
})


describe('feature lead-ins', () => {

  const noFeatures = () => {
    const model: any = makeModel()
    for (const f of Object.values<any>(model.main.kit.feature)) f.active = false
    return model
  }

  test('no feature list, and no lead-in or order claim, without an active feature', async () => {
    const out = await render(ReadmeExplanation, 'ts', noFeatures())
    ok(out.includes('### Features and hooks'))
    ok(!out.includes('The SDK ships with built-in features:'))
    ok(!out.includes('Features are initialized'))
  })

  test('a fixed-order origin makes no claim about activation order', async () => {
    const lean = await render(ReadmeExplanation, 'lean')
    ok(!lean.includes('later features can override earlier ones'))
    ok(lean.includes('fixed catalog order'))
    ok((await renderExplanation('ts')).includes('later features can override earlier ones'))
  })

  // An SDK always carries the test feature, so only a project of consumers
  // has no feature at all.
  test('the root README writes no features table without a feature', async () => {
    const consumer = 'main: kit: target: ts: phase: { entity: active: false, feature: active: false, ' +
      'readme: active: false, agentguide: active: false, test: active: false }'
    const run = await generateDocs({ id: 'nofeat', family: 'nofeat', targets: ['ts'], features: [], extra: consumer })
    ok(!run.files['README.md'].includes('| Feature | Purpose |'))
    ok(run.files['README.md'].includes('Pass custom features via the `extend` option'))
  })

  test('entity access names no operation set', async () => {
    ok(!(await renderExplanation('ts')).includes('CRUD'))
  })
})
