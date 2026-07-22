// Typed-model emitter (EntityTypes_<lang>) output tests.
//
// The emitters live in the shipped scaffold (project/.sdk/src/cmp/<lang>/)
// and only ever compile inside a generated SDK project, so — like
// featureharness.ts does for feature templates — they are sucrase-transpiled
// and sandbox-loaded here with '@voxgig/sdkgen' shimmed to the real dist
// build and '@voxgig/apidef' to the KIT/getModelPath equivalents. Each
// emitter then renders a fixture model through a real Jostraca generate into
// memfs, and the emitted types file is asserted on.
//
// The fixture exercises the edge cases the emitters must survive:
//   - an INACTIVE entity (must still be emitted: the consumer scaffold
//     generates entity code for every entity),
//   - a fieldless placeholder entity (lazy Name derivation),
//   - a non-identifier field name (skipped-with-warning in csharp/java/...),
//   - a $NULL field (php must not emit `?null`),
//   - a $ONE union field (union syntax where the language has one),
//   - $OBJECT/$ARRAY fields (rust/cpp concrete container mapping).

import { test, describe } from 'node:test'
import { ok, strictEqual } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'
import { Jostraca, Project } from 'jostraca'
import { memfs } from 'memfs'

const sdkgen = require('../dist/sdkgen.js')
const { KIT, getModelPath } = require('../dist/types.js')


const CMP_DIR = Path.resolve(__dirname, '..', 'project', '.sdk', 'src', 'cmp')


// Transpile + evaluate a scaffold component file, resolving its relative
// requires (./utility_<lang> etc.) recursively from the scaffold tree and
// shimming the two package imports the scaffold expects.
const _modCache: Record<string, any> = {}

function scaffoldLoad(file: string): any {
  const full = Path.resolve(file)
  if (_modCache[full]) {
    return _modCache[full].exports
  }

  const src = readFileSync(full, 'utf8')
  const js = transform(src, { transforms: ['typescript', 'imports'], filePath: full }).code

  const mod: any = { exports: {} }
  _modCache[full] = mod

  const req = (p: string) => {
    if ('@voxgig/sdkgen' === p) {
      return sdkgen
    }
    if ('@voxgig/apidef' === p) {
      return { KIT, getModelPath }
    }
    if (p.startsWith('.')) {
      let rp = Path.resolve(Path.dirname(full), p)
      if (!rp.endsWith('.ts')) {
        rp = rp + '.ts'
      }
      return scaffoldLoad(rp)
    }
    return require(p)
  }

  // eslint-disable-next-line no-new-func
  const fn = new Function('exports', 'require', 'module', '__dirname', '__filename', js)
  fn(mod.exports, req, mod, Path.dirname(full), full)
  return mod.exports
}


// A capturing logger: warn calls are recorded for assertion.
function makeLog() {
  const warnings: any[] = []
  const noop = () => { }
  const log: any = {
    info: noop, debug: noop, error: noop, trace: noop, fatal: noop,
    warn: (x: any) => { warnings.push(x) },
    child() { return log },
  }
  return { log, warnings }
}


// Fixture model. Field/param `type` values use the exact sentinel forms
// apidef stores (backtick-quoted, unions as ['`$ONE`', [members]]).
function makeModel() {
  return {
    name: 'demo',
    origin: 'voxgig-sdk',
    const: { Name: 'Demo', name: 'demo' },
    main: {
      [KIT]: {
        entity: {
          sun: {
            active: true, name: 'sun',
            fields: {
              id: { name: 'id', type: '`$STRING`' },
              size: { name: 'size', type: '`$INTEGER`', req: false },
              hot: { name: 'hot', type: '`$BOOLEAN`' },
              'wave-len': { name: 'wave-len', type: '`$NUMBER`', req: false },
              nil0: { name: 'nil0', type: '`$NULL`', req: false },
              uni: { name: 'uni', type: ['`$ONE`', ['`$STRING`', '`$INTEGER`']], req: false },
              meta: { name: 'meta', type: '`$OBJECT`', req: false },
              tags: { name: 'tags', type: '`$ARRAY`', req: false },
            },
            op: {
              load: {
                active: true,
                points: [{ args: { params: [{ name: 'id', type: '`$STRING`' }] } }],
              },
              list: { active: true, points: [] },
              create: { active: true, points: [] },
            },
          },
          // Inactive: the consumer scaffold still generates its entity code,
          // so the typed model MUST include it.
          moon: {
            active: false, name: 'moon',
            fields: { id: { name: 'id', type: '`$STRING`' } },
            op: {
              load: {
                points: [{ args: { params: [{ name: 'id', type: '`$STRING`' }] } }],
              },
            },
          },
          // Fieldless placeholder: Name derivation must not depend on another
          // component having run first.
          pluto: { active: true, name: 'pluto' },
        },
      },
    },
  }
}


async function render(lang: string, target: any): Promise<{
  files: Record<string, string>, warnings: any[],
}> {
  const EntityTypes =
    scaffoldLoad(Path.join(CMP_DIR, lang, `EntityTypes_${lang}.ts`)).EntityTypes

  const { fs, vol } = memfs({})
  const jostraca = Jostraca()
  const { log, warnings } = makeLog()

  await jostraca.generate(
    { fs: () => fs, folder: '/x', model: makeModel(), log },
    () => {
      Project({ folder: 'p' }, () => {
        EntityTypes({ target })
      })
    },
  )

  const json: any = vol.toJSON()
  const files: Record<string, string> = {}
  for (const k of Object.keys(json)) {
    files[k] = json[k]
  }
  return { files, warnings }
}


function findFile(files: Record<string, string>, re: RegExp): string {
  const key = Object.keys(files).find((k) => re.test(k))
  ok(key, `types file matching ${re} in ${Object.keys(files).join(', ')}`)
  return files[key!]
}


describe('EntityTypes emitters — fixture model output', () => {

  test('ts: typed interfaces, unions, optionality, inactive included', async () => {
    const { files } = await render('ts', { name: 'ts', ext: 'ts' })
    const out = findFile(files, /DemoTypes\.ts$/)

    ok(out.includes('export interface Sun {'), 'Sun interface')
    ok(out.includes('export interface Moon {'), 'inactive Moon interface present')
    ok(out.includes('export interface Pluto {'), 'fieldless Pluto interface')
    ok(out.includes('export interface SunLoadMatch {'), 'op match type')
    ok(out.includes('export interface SunCreateData {'), 'op data type')
    ok(out.includes('  id: string'), 'required field')
    ok(out.includes('  size?: number'), 'optional field')
    ok(out.includes('  uni?: string | number'), 'union field renders as TS union')
    ok(out.includes('"wave-len"?: number'), 'non-identifier field quoted, kept')
    ok(out.includes('  meta?: Record<string, any>'), 'object field')
  })

  test('js: JSDoc typedefs with bracketed optionals', async () => {
    const { files } = await render('js', { name: 'js', ext: 'js' })
    const out = findFile(files, /DemoTypes\.js$/)
    ok(out.includes('@typedef {Object} Sun'), 'Sun typedef')
    ok(out.includes('@typedef {Object} Moon'), 'inactive Moon typedef present')
    ok(out.includes('string|number'), 'union renders in JSDoc')
  })

  test('py: TypedDicts with required/optional split and py unions', async () => {
    const { files } = await render('py', { name: 'py', ext: 'py' })
    const out = findFile(files, /demo_types\.py$/)
    ok(out.includes('class Sun'), 'Sun TypedDict')
    ok(out.includes('class Moon'), 'inactive Moon present')
    ok(out.includes('str | int'), 'union renders in python syntax')
  })

  test('php: $NULL and unions degrade to mixed — never `?null`', async () => {
    const { files } = await render('php', { name: 'php', ext: 'php' })
    const out = findFile(files, /DemoTypes\.php$/)
    ok(out.includes('class Sun'), 'Sun class')
    ok(out.includes('class Moon'), 'inactive Moon present')
    ok(!out.includes('?null'), 'no invalid `?null` property type')
    ok(out.includes('public mixed $nil0 = null;'), '$NULL field degrades to mixed')
    ok(out.includes('public mixed $uni = null;'), 'union degrades to mixed')
    ok(out.includes('public ?int $size = null;'), 'optional int field')
  })

  test('java: boxed component types, non-identifier fields skipped w/ warning', async () => {
    const { files, warnings } = await render('java', { name: 'java', ext: 'java' })
    const out = findFile(files, /DemoTypes\.java$/)
    ok(out.includes('public record Sun('), 'Sun record')
    ok(out.includes('public record Moon('), 'inactive Moon present')
    ok(out.includes('Long size'), 'boxed Long (matches README mapping)')
    ok(!out.includes('wave-len'), 'non-identifier field omitted')
    ok(
      warnings.some((w) => 'entity-types-skip-field' === w.point && 'wave-len' === w.field),
      'skip warned',
    )
  })

  test('csharp: nullable optionals, skip warning for non-identifier field', async () => {
    const { files, warnings } = await render('csharp', { name: 'csharp', ext: 'cs' })
    const out = findFile(files, /DemoTypes\.cs$/)
    ok(out.includes('public record Sun'), 'Sun record')
    ok(out.includes('public record Moon'), 'inactive Moon present')
    ok(out.includes('public long? size { get; init; }'), 'optional -> nullable')
    ok(warnings.some((w) => 'entity-types-skip-field' === w.point), 'skip warned')
  })

  test('rust: OBJECT renders as concrete HashMap, Option<T> optionality', async () => {
    const { files } = await render('rust', { name: 'rust', ext: 'rs' })
    const out = findFile(files, /types\.rs$/)
    ok(out.includes('pub struct Sun {'), 'Sun struct')
    ok(out.includes('pub struct Moon {'), 'inactive Moon present')
    ok(
      out.includes('Option<std::collections::HashMap<String, Value>>'),
      'object field is a concrete map type',
    )
    ok(out.includes('pub id: String'), 'required field plain')
  })

  test('cpp: std::map object mapping and the <map> include', async () => {
    const { files } = await render('cpp', { name: 'cpp', ext: 'hpp' })
    const out = findFile(files, /demo_types\.hpp$/)
    ok(out.includes('#include <map>'), '<map> included')
    ok(out.includes('std::map<std::string, Value>'), 'object field concrete map')
    ok(out.includes('struct Moon'), 'inactive Moon present')
  })

  test('elixir: shared-derived snake_case names, typespec unions', async () => {
    const { files } = await render('elixir', { name: 'elixir', ext: 'ex' })
    const out = findFile(files, /demo_types\.ex$/)
    ok(out.includes('@type sun ::'), 'sun alias')
    ok(out.includes('@type moon ::'), 'inactive moon alias present')
    ok(out.includes('@type sun_load_match ::'), 'op alias (shared OP_SUFFIX derived)')
    ok(out.includes('@type sun_create_data ::'), 'data op alias')
    ok(out.includes('String.t() | integer()'), 'union renders as typespec union')
  })

  test('go: structs for every entity incl. inactive', async () => {
    const { files } = await render('go', { name: 'go', ext: 'go' })
    const out = findFile(files, /types\.go$/)
    ok(out.includes('type Sun struct {'), 'Sun struct')
    ok(out.includes('type Moon struct {'), 'inactive Moon present')
    ok(out.includes('type Pluto struct {'), 'fieldless Pluto present')
  })

  // The remaining emitters share the same policy plumbing; smoke-check that
  // each renders all three entities (the include-all filter) without error.
  for (const [lang, target, re] of [
    ['rb', { name: 'rb', ext: 'rb' }, /Demo_types\.rb$/],
    ['lua', { name: 'lua', ext: 'lua' }, /demo_types\.lua$/],
    ['kotlin', { name: 'kotlin', ext: 'kt' }, /DemoTypes\.kt$/],
    ['scala', { name: 'scala', ext: 'scala' }, /DemoTypes\.scala$/],
    ['swift', { name: 'swift', ext: 'swift' }, /DemoTypes\.swift$/],
    ['dart', { name: 'dart', ext: 'dart' }, /DemoTypes\.dart$/],
    ['c', { name: 'c', ext: 'h' }, /types\.h$/],
  ] as const) {
    test(`${lang}: all entities emitted (include-all filter)`, async () => {
      const { files } = await render(lang as string, target)
      const out = findFile(files, re as RegExp)
      for (const marker of ['Sun', 'Moon', 'Pluto']) {
        ok(
          out.includes(marker) || out.includes(marker.toLowerCase()),
          `${lang}: ${marker} present`,
        )
      }
    })
  }
})


describe('entityTypeCollisions', () => {
  const { entityTypeCollisions, warnEntityTypeCollisions, names } = sdkgen

  function coll(entities: Record<string, any>) {
    const entityColl: any = entities
    Object.values(entityColl).forEach((e: any) => names(e, e.name))
    return entityColl
  }

  test('two entities with the same PascalCase Name collide', () => {
    const entityColl = coll({
      'foo-bar': { name: 'foo-bar', op: { load: {} } },
      foo_bar: { name: 'foo_bar', op: { load: {} } },
    })
    const dups = entityTypeCollisions(entityColl)
    ok(dups.includes('FooBar'), 'data type collision detected')
    ok(dups.includes('FooBarLoadMatch'), 'op type collision detected')
  })

  test('distinct names -> no collisions; memoised per collection', () => {
    const entityColl = coll({
      sun: { name: 'sun', op: { load: {} } },
      moon: { name: 'moon', op: { load: {} } },
    })
    strictEqual(entityTypeCollisions(entityColl).length, 0)
    strictEqual(entityTypeCollisions(entityColl).length, 0)
  })

  test('warnEntityTypeCollisions logs once with the duplicate names', () => {
    const entityColl = coll({
      'foo-bar': { name: 'foo-bar' },
      foo_bar: { name: 'foo_bar' },
    })
    const { log, warnings } = makeLog()
    const dups = warnEntityTypeCollisions(entityColl, log, 'ts')
    ok(dups.includes('FooBar'))
    strictEqual(warnings.length, 1)
    strictEqual(warnings[0].point, 'entity-types-name-collision')
    ok(warnings[0].note.includes('FooBar'))
  })
})
