
import { test, describe } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'

import {
  collectDeps,
  buildIdNames,
  getMatchEntries,
  safeVarName,
  isRbCoreConstant,
  isRbSdkConstant,
  rbSafeTypeName,
  isSwiftSdkType,
  swiftSafeTypeName,
  isPhpReservedType,
  phpSafeTypeName,
  serverVariables,
  hasServerVariables,
  stationLibrary,
  originName,
  goModule,
  packageName,
  registryState,
  isPublished,
  installCommand,
  vendorCommand,
  goPackageIdent,
} from '../dist/sdkgen.js'


describe('helpers', () => {

  describe('collectDeps', () => {

    // Model shape mirrors what getModelPath(model, 'main.kit.feature')
    // expects: an active-flagged feature map, each feature carrying a
    // per-language `deps` block. `key$` is injected by jostraca's each()
    // during iteration, so plain object keys are enough here.
    function makeModel() {
      return {
        main: {
          kit: {
            feature: {
              auth: {
                active: true,
                deps: {
                  go: {
                    'github.com/x/auth': { active: true, version: 'v1.0.0' },
                    'github.com/x/off': { active: false, version: 'v9' },
                  },
                },
              },
              log: {
                active: true,
                deps: {
                  // No `active` → feature deps default OFF, so excluded.
                  go: { 'github.com/x/log': { version: 'v2.0.0' } },
                },
              },
              disabled: {
                active: false,
                deps: { go: { 'github.com/x/nope': { active: true, version: 'v3' } } },
              },
            },
          },
        },
      }
    }

    test('feature deps included only when active===true', () => {
      const out = collectDeps(makeModel(), 'go', undefined)
      deepStrictEqual(out.map((d) => d.name), ['github.com/x/auth'])
      strictEqual(out[0].source, 'feature')
      strictEqual(out[0].version, 'v1.0.0')
    })

    test('inactive features are excluded entirely', () => {
      // `disabled` is active:false → never contributes its deps.
      const names = collectDeps(makeModel(), 'go', undefined).map((d) => d.name)
      strictEqual(names.includes('github.com/x/nope'), false)
    })

    test('a package required by two features appears once', () => {
      // Duplicate manifest keys are a hard parse error in go.mod / Cargo.toml
      // and silently last-wins in package.json, so the same package required
      // by several features must collapse to a single entry.
      const model: any = makeModel()
      model.main.kit.feature.extra = {
        active: true,
        deps: { go: { 'github.com/x/auth': { active: true, version: 'v1.0.0' } } },
      }
      const names = collectDeps(model, 'go', undefined).map((d) => d.name)
      deepStrictEqual(names, ['github.com/x/auth'])
    })

    test('a conflicting duplicate version keeps the first and warns', () => {
      const model: any = makeModel()
      model.main.kit.feature.extra = {
        active: true,
        deps: { go: { 'github.com/x/auth': { active: true, version: 'v2.0.0' } } },
      }
      const warnings: any[] = []
      const log = { warn: (w: any) => warnings.push(w) }
      const out = collectDeps(model, 'go', undefined, log)
      deepStrictEqual(out.map((d) => d.name), ['github.com/x/auth'])
      strictEqual(out[0].version, 'v1.0.0', 'first (sorted-key) occurrence wins')
      strictEqual(warnings.length, 1)
      strictEqual(warnings[0].point, 'dep-version-conflict')
      strictEqual(warnings[0].dropped, 'v2.0.0')
    })

    test('a target dep duplicating a feature dep does not double up', () => {
      const out = collectDeps(makeModel(), 'go', {
        'github.com/x/auth': { version: 'v1.0.0' },
      } as any)
      deepStrictEqual(out.map((d) => d.name), ['github.com/x/auth'])
      strictEqual(out[0].source, 'feature', 'feature entry retained')
    })

    test('no deps for a language with none', () => {
      strictEqual(collectDeps(makeModel(), 'py', undefined).length, 0)
    })

    test('target deps included unless active===false', () => {
      const targetDeps = {
        'github.com/t/a': { version: 'v5' }, // default on
        'github.com/t/b': { active: false, version: 'v6' }, // off
        'github.com/t/c': { active: true, version: 'v7' }, // on
      }
      const out = collectDeps(makeModel(), 'go', targetDeps)
      const byName = Object.fromEntries(out.map((d) => [d.name, d]))

      // feature dep + the two active target deps
      deepStrictEqual(
        out.map((d) => d.name).sort(),
        ['github.com/t/a', 'github.com/t/c', 'github.com/x/auth'],
      )
      strictEqual(byName['github.com/t/a'].source, 'target')
      strictEqual(byName['github.com/t/c'].version, 'v7')
      strictEqual(byName['github.com/t/b'], undefined)
    })

    test('raw object is exposed for caller-specific fields', () => {
      const targetDeps = { 'github.com/t/a': { version: 'v5', replace: './local' } }
      const out = collectDeps(makeModel(), 'go', targetDeps)
      const a = out.find((d) => d.name === 'github.com/t/a')
      strictEqual(a?.raw.replace, './local')
    })
  })


  describe('stationLibrary', () => {

    // The station self-registration seam (station design §6.2 path 1):
    // which library package the generated MAIN soft-requires, read from
    // the station feature model's own deps block — the same entry
    // collectDeps flows into the manifest — never hardcoded per language.
    function makeStationModel(station?: any) {
      return {
        main: {
          kit: {
            feature: {
              test: { active: true },
              ...(undefined === station ? {} : { station }),
            },
          },
        },
      } as any
    }

    test('active station feature with an active dep names the library', () => {
      const model = makeStationModel({
        active: true,
        deps: {
          ts: { '@voxgig/station': { active: true, version: '>=0.0.1' } },
          js: { '@voxgig/station-js': { active: true, version: '>=0.0.1' } },
        },
      })
      strictEqual(stationLibrary(model, 'ts'), '@voxgig/station')
      strictEqual(stationLibrary(model, 'js'), '@voxgig/station-js')
    })

    test('no station feature, no library', () => {
      strictEqual(stationLibrary(makeStationModel(), 'ts'), undefined)
    })

    test('an INACTIVE station feature emits nothing', () => {
      // Inactive means not shipped: no source, no config entry, no
      // manifest dep — so no registration either.
      const model = makeStationModel({
        active: false,
        deps: { ts: { '@voxgig/station': { active: true, version: '*' } } },
      })
      strictEqual(stationLibrary(model, 'ts'), undefined)
    })

    test('a target with no station dep emits nothing (vendored targets)', () => {
      const model = makeStationModel({
        active: true,
        deps: { ts: { '@voxgig/station': { active: true, version: '*' } } },
      })
      strictEqual(stationLibrary(model, 'c'), undefined)
    })

    test('inactive dep entries are not the library', () => {
      // collectDeps semantics: feature deps count only when explicitly
      // active, so the require target is exactly what the manifest carries.
      const model = makeStationModel({
        active: true,
        deps: { ts: { '@voxgig/station': { version: '*' } } },
      })
      strictEqual(stationLibrary(model, 'ts'), undefined)
    })
  })


  describe('buildIdNames', () => {

    test('entity ids plus ancestor ids plus match/data aliases', () => {
      const entity = { name: 'moon', relations: { ancestors: ['planet'] } }
      const flow = {
        step: {
          s1: { match: { year: 'year01', id: 'self$' } },
          s2: { data: { type_id: 'data_type01' } },
        },
      }
      deepStrictEqual(buildIdNames(entity, flow), [
        'moon01', 'moon02', 'moon03',
        'planet01', 'planet02', 'planet03',
        'year01',
        'data_type01',
      ])
    })

    test('skips $-suffixed sentinel values and dedupes', () => {
      const entity = { name: 'moon' }
      const flow = {
        step: {
          // 'moon01' duplicate must not be repeated; 'x$' is a sentinel.
          s1: { match: { a: 'moon01', b: 'x$' } },
        },
      }
      deepStrictEqual(buildIdNames(entity, flow), ['moon01', 'moon02', 'moon03'])
    })

    test('flattens nested ancestor arrays', () => {
      const entity = { name: 'leaf', relations: { ancestors: [['root'], ['branch']] } }
      const out = buildIdNames(entity, { step: {} })
      strictEqual(out.includes('root01'), true)
      strictEqual(out.includes('branch03'), true)
    })

    test('accepts array-form flow steps', () => {
      const entity = { name: 'moon' }
      const flow = { step: [{ match: { year: 'year01' } }] }
      strictEqual(buildIdNames(entity, flow).includes('year01'), true)
    })

    test('no relations and no steps yields just the entity ids', () => {
      deepStrictEqual(buildIdNames({ name: 'sun' }, {}), ['sun01', 'sun02', 'sun03'])
    })
  })


  describe('getMatchEntries', () => {

    test('returns non-sentinel entries only', () => {
      const step = { match: { a: 1, b$: 2, c: 'x' } }
      deepStrictEqual(getMatchEntries(step), [['a', 1], ['c', 'x']])
    })

    test('empty / missing match returns empty array', () => {
      deepStrictEqual(getMatchEntries({}), [])
      deepStrictEqual(getMatchEntries(undefined), [])
      deepStrictEqual(getMatchEntries({ match: {} }), [])
    })
  })


  describe('safeVarName', () => {

    test('sanitises reserved words per language with a trailing _', () => {
      // Ruby: `self = ...` is a SyntaxError (Cloudsmith's Self entity).
      strictEqual(safeVarName('self', 'rb'), 'self_')
      strictEqual(safeVarName('end', 'rb'), 'end_')
      // Python keyword.
      strictEqual(safeVarName('class', 'py'), 'class_')
      // Lua keyword — but `self` is NOT reserved in Lua.
      strictEqual(safeVarName('end', 'lua'), 'end_')
      strictEqual(safeVarName('self', 'lua'), 'self')
      // Existing languages still work.
      strictEqual(safeVarName('delete', 'ts'), 'delete_')
      strictEqual(safeVarName('type', 'go'), 'type_')
    })

    test('leaves non-reserved names untouched', () => {
      strictEqual(safeVarName('component', 'rb'), 'component')
      strictEqual(safeVarName('cargo', 'py'), 'cargo')
      strictEqual(safeVarName('abort', 'lua'), 'abort')
    })
  })


  describe('rbSafeTypeName', () => {

    test('suffixes constants Ruby core already owns', () => {
      // The Customs Window regression: `/files` -> entity File -> the typed
      // model emitted `File = Struct.new(...)`, silently REPLACING ::File, so
      // the generated test runner's File.join raised NoMethodError.
      strictEqual(rbSafeTypeName('File'), 'FileType')
      strictEqual(rbSafeTypeName('Time'), 'TimeType')
      strictEqual(rbSafeTypeName('Data'), 'DataType')
      strictEqual(rbSafeTypeName('Dir'), 'DirType')
      strictEqual(rbSafeTypeName('IO'), 'IOType')
      strictEqual(rbSafeTypeName('Set'), 'SetType')
      strictEqual(rbSafeTypeName('Process'), 'ProcessType')
      strictEqual(rbSafeTypeName('Hash'), 'HashType')
    })

    test('leaves every other entity name untouched', () => {
      // The guard must not churn the existing fleet: names that merely LOOK
      // builtin are not core constants and stay as they are.
      strictEqual(rbSafeTypeName('Response'), 'Response')
      strictEqual(rbSafeTypeName('Record'), 'Record')
      strictEqual(rbSafeTypeName('BulkUpload'), 'BulkUpload')
      strictEqual(rbSafeTypeName('Submission'), 'Submission')
      strictEqual(rbSafeTypeName('Account'), 'Account')
    })

    test('matches exactly — case-sensitive, no partial hits', () => {
      // Only the exact constant is owned by Ruby; compounds are free.
      strictEqual(rbSafeTypeName('FileUpload'), 'FileUpload')
      strictEqual(rbSafeTypeName('TimeSeries'), 'TimeSeries')
      strictEqual(rbSafeTypeName('Filetype'), 'Filetype')
      strictEqual(isRbCoreConstant('File'), true)
      strictEqual(isRbCoreConstant('file'), false)
    })

    test('per-op type names never need the guard', () => {
      // EntityTypes_rb applies the guard to the bare data type only; op names
      // always carry a suffix, and no core constant ends with one.
      strictEqual(rbSafeTypeName('FileCreateData'), 'FileCreateData')
      strictEqual(rbSafeTypeName('FileLoadMatch'), 'FileLoadMatch')
    })

    // THE SECOND HALF OF "ALREADY TAKEN": names the SDK'S OWN SCAFFOLDING
    // claims, which a language-keyword list can never catch.
    test('suffixes constants the generated SDK itself declares', () => {
      // gitlab-sdk has a `Runner` entity. `<Sdk>_types.rb` declared
      // `class Runner`, and tm/rb/test/runner.rb then does
      // `Runner = ProjectNameTestRunner` — so in the test process the entity
      // type silently BECAME the test runner. Ruby warns and carries on,
      // which is why `rb` stayed green (issue #64).
      strictEqual(rbSafeTypeName('Runner'), 'RunnerType')
      strictEqual(rbSafeTypeName('Helpers'), 'HelpersType')
      strictEqual(rbSafeTypeName('Vs'), 'VsType')

      // The vendored struct library and the templated test classes share the
      // same global namespace at require time.
      strictEqual(rbSafeTypeName('VoxgigStruct'), 'VoxgigStructType')
      strictEqual(rbSafeTypeName('FeatureTest'), 'FeatureTestType')
      strictEqual(rbSafeTypeName('ReadmeExamplesTest'), 'ReadmeExamplesTestType')

      strictEqual(isRbSdkConstant('Runner'), true)
      strictEqual(isRbSdkConstant('File'), false)
    })

    test('does not claim names that are merely PREFIXED', () => {
      // `ProjectNameUtility` substitutes to `<Sdk>Utility`, which a bare
      // entity type cannot equal — guarding it would rename entities that
      // never collided. The fleet must not churn.
      strictEqual(rbSafeTypeName('Utility'), 'Utility')
      strictEqual(rbSafeTypeName('Context'), 'Context')
      strictEqual(rbSafeTypeName('Response'), 'Response')
      strictEqual(rbSafeTypeName('Operation'), 'Operation')
    })
  })


  describe('phpSafeTypeName', () => {

    // THE CASE THAT MATTERS MOST, because it is the one a case-sensitive
    // implementation gets wrong while looking correct.
    //
    // PHP class names are case-insensitive, so `Namespace` IS `namespace` —
    // and the generated name is PascalCase while the reserved word is
    // lowercase. A `Set.has('Namespace')` against a lowercase list matches
    // nothing, and `class Namespace` ships again.
    test('folds case, as PHP does', () => {
      strictEqual(phpSafeTypeName('Namespace'), 'NamespaceType')
      strictEqual(phpSafeTypeName('namespace'), 'namespaceType')
      strictEqual(phpSafeTypeName('NAMESPACE'), 'NAMESPACEType')

      strictEqual(isPhpReservedType('Namespace'), true)
      strictEqual(isPhpReservedType('NaMeSpAcE'), true)
    })

    test('suffixes words PHP will not accept as a class name', () => {
      // The gitlab-sdk regression (#64): a `Namespace` entity emitted
      // `class Namespace`, which is a parse error, so types/<Sdk>Types.php
      // could never be loaded.
      strictEqual(phpSafeTypeName('List'), 'ListType')
      strictEqual(phpSafeTypeName('Array'), 'ArrayType')
      strictEqual(phpSafeTypeName('Class'), 'ClassType')
      strictEqual(phpSafeTypeName('Function'), 'FunctionType')
      strictEqual(phpSafeTypeName('Match'), 'MatchType')
      strictEqual(phpSafeTypeName('Enum'), 'EnumType')
      strictEqual(phpSafeTypeName('Object'), 'ObjectType')
      strictEqual(phpSafeTypeName('String'), 'StringType')
      strictEqual(phpSafeTypeName('Static'), 'StaticType')
      strictEqual(phpSafeTypeName('Default'), 'DefaultType')
    })

    test('leaves every other entity name untouched', () => {
      // The guard must not churn the existing fleet — an SDK with no
      // collision generates byte-identically to before.
      strictEqual(phpSafeTypeName('Response'), 'Response')
      strictEqual(phpSafeTypeName('Project'), 'Project')
      strictEqual(phpSafeTypeName('Namespaces'), 'Namespaces')
      strictEqual(phpSafeTypeName('ListItem'), 'ListItem')
      strictEqual(phpSafeTypeName('ClassRoom'), 'ClassRoom')
    })

    test('per-op type names never need the guard', () => {
      // EntityTypes_php applies it to the bare data class only; op names
      // already carry a suffix, and no reserved word ends with one.
      strictEqual(phpSafeTypeName('NamespaceCreateData'), 'NamespaceCreateData')
      strictEqual(phpSafeTypeName('NamespaceLoadMatch'), 'NamespaceLoadMatch')
    })
  })


  describe('swiftSafeTypeName', () => {

    test('suffixes names the swift SDK runtime already declares', () => {
      // The Hook0 regression: their spec has a `Response` schema, so the
      // generated `public struct Response` landed in the same module as
      // core/Response.swift's `public final class Response` — Swift has no
      // intra-module namespacing, so this was `invalid redeclaration of
      // 'Response'` plus an ambiguous-lookup error in every core file.
      strictEqual(swiftSafeTypeName('Response'), 'ResponseType')
      strictEqual(swiftSafeTypeName('Context'), 'ContextType')
      strictEqual(swiftSafeTypeName('Result'), 'ResultType')
      strictEqual(swiftSafeTypeName('Entity'), 'EntityType')
      strictEqual(swiftSafeTypeName('Operation'), 'OperationType')
      strictEqual(swiftSafeTypeName('Spec'), 'SpecType')
      strictEqual(swiftSafeTypeName('JSON'), 'JSONType')
      strictEqual(swiftSafeTypeName('Utility'), 'UtilityType')
    })

    test('leaves every other entity name untouched', () => {
      // Must not churn the existing fleet: only an actual collision renames.
      strictEqual(swiftSafeTypeName('Application'), 'Application')
      strictEqual(swiftSafeTypeName('Subscription'), 'Subscription')
      strictEqual(swiftSafeTypeName('Event'), 'Event')
      strictEqual(swiftSafeTypeName('Organization'), 'Organization')
      // Ruby core constants are NOT swift SDK types, and vice versa — the two
      // guards are deliberately independent.
      strictEqual(swiftSafeTypeName('File'), 'File')
      strictEqual(rbSafeTypeName('Response'), 'Response')
    })

    test('matches exactly — case-sensitive, no partial hits', () => {
      strictEqual(swiftSafeTypeName('ResponseBody'), 'ResponseBody')
      strictEqual(swiftSafeTypeName('HttpResponse'), 'HttpResponse')
      strictEqual(swiftSafeTypeName('response'), 'response')
      strictEqual(isSwiftSdkType('Response'), true)
      strictEqual(isSwiftSdkType('response'), false)
    })

    test('per-op type names never need the guard', () => {
      // EntityTypes_swift applies the guard to the bare data type only; op
      // type names always carry a suffix, and the entity CLASS is separately
      // suffixed (`ResponseEntity`), so neither ever collided.
      strictEqual(swiftSafeTypeName('ResponseCreateData'), 'ResponseCreateData')
      strictEqual(swiftSafeTypeName('ResponseLoadMatch'), 'ResponseLoadMatch')
      strictEqual(swiftSafeTypeName('ResponseEntity'), 'ResponseEntity')
    })
  })


  describe('serverVariables', () => {

    const model = (url: string, variables?: any) => ({
      main: { kit: { info: { servers: [{ url, ...(variables ? { variables } : {}) }] } } }
    })

    test('a templated URL yields its variables in URL order', () => {
      // The Hanko shape: one variable, empty default -> required.
      const vars = serverVariables(model('https://{tenant_id}.hanko.io', {
        tenant_id: { default: '', description: 'The tenant.' },
      }))
      deepStrictEqual(vars, [
        { name: 'tenant_id', dflt: '', required: true, description: 'The tenant.' },
      ])
      strictEqual(hasServerVariables(model('https://{tenant_id}.hanko.io')), true)
    })

    test('a non-empty default makes the variable optional', () => {
      const vars = serverVariables(model('https://{region}.api.example.com', {
        region: { default: 'eu' },
      }))
      deepStrictEqual(vars, [
        { name: 'region', dflt: 'eu', required: false, description: '' },
      ])
    })

    test('a plain URL yields nothing', () => {
      deepStrictEqual(serverVariables(model('https://api.example.com')), [])
      strictEqual(hasServerVariables(model('https://api.example.com')), false)
    })

    test('an undeclared placeholder is still surfaced as required', () => {
      // Specs sometimes template the URL without a variables block; the
      // placeholder still cannot resolve, so it must still be required.
      const vars = serverVariables(model('https://{tenant}.example.com'))
      deepStrictEqual(vars, [
        { name: 'tenant', dflt: '', required: true, description: '' },
      ])
    })

    test('declared-but-unreferenced variables are appended, never required', () => {
      const vars = serverVariables(model('https://{a}.example.com', {
        a: { default: '' },
        unused: { default: 'x', description: 'not in the URL' },
      }))
      deepStrictEqual(vars.map((v: any) => [v.name, v.required]),
        [['a', true], ['unused', false]])
    })

    test('multiple and repeated placeholders dedupe in order', () => {
      const vars = serverVariables(model('https://{region}.{env}.example.com/{region}', {
        region: { default: 'eu' }, env: { default: '' },
      }))
      deepStrictEqual(vars.map((v: any) => v.name), ['region', 'env'])
    })

    test('a model with no servers at all yields nothing', () => {
      deepStrictEqual(serverVariables({}), [])
      strictEqual(hasServerVariables({}), false)
    })
  })


  // AN ALIASED TARGET IS ITS OWN TARGET, IN ITS ORIGIN'S LANGUAGE.
  //
  // `target add go~go2` installs a SECOND Go SDK. Its CONFIG is its own — its
  // module path, its registry state, its published name — but the LANGUAGE
  // rules are still Go's: the same go.mod shape, the same `go get` line.
  //
  // These helpers took one string for both jobs, so a component that wrote
  // `goModule(model, 'go')` silently rendered the ORIGIN's module path into
  // the alias's output, defeating the one use aliasing is documented for
  // (design doc section 16.12). The naive repair — passing `target.name`
  // everywhere — swaps the defect rather than fixing it: `packageName` would
  // stop matching its own switch and fall to `default`, so `ts~ts2` would
  // publish under a non-npm name. Hence `originName`, and hence this suite
  // asserting BOTH halves for every helper that had a switch.
  describe('an aliased target', () => {

    // `origname` is what `target add` stamps for an alias, and '' when the
    // target was installed under its own name.
    function makeModel() {
      return {
        name: 'demo',
        origin: 'acme',
        main: {
          kit: {
            target: {
              go: {
                name: 'go', origname: '',
                module: { path: 'github.com/acme/demo-sdk/go' },
              },
              go2: {
                name: 'go2', origname: 'go',
                module: { path: 'github.com/acme/demo-sdk/go2' },
              },
              ts: { name: 'ts', origname: '' },
              ts2: { name: 'ts2', origname: 'ts' },
              // An alias that declares nothing of its own: the fallbacks have
              // to follow the alias too, not just the declared overrides.
              bare: { name: 'bare', origname: 'go' },
            },
          },
        },
      }
    }


    test('originName answers the LANGUAGE, not the install name', () => {
      const model = makeModel()

      strictEqual(originName(model, 'go2'), 'go')
      strictEqual(originName(model, 'go'), 'go', 'unaliased must be itself')

      // Ecosystem keys name no target, so they answer for themselves — which
      // is what keeps `packageName(model, 'npm')` working.
      strictEqual(originName(model, 'npm'), 'npm')
    })


    test('goModule follows the ALIAS, both declared and derived', () => {
      const model = makeModel()

      strictEqual(goModule(model, 'go2'), 'github.com/acme/demo-sdk/go2',
        'an alias read its origin declared module path')

      // No declaration: the derived path must still carry the alias, because
      // that is the subdirectory it generates into.
      strictEqual(goModule(model, 'bare'), 'github.com/acme/demo-sdk/bare')
    })


    test('packageName keeps the origin FORMAT under the alias name', () => {
      const model = makeModel()

      // The trap: 'ts2' matches no case, so a naive fix would fall to
      // `default` and drop the npm scope.
      strictEqual(packageName(model, 'ts2'), packageName(model, 'ts'),
        'an aliased ts must still publish an npm-scoped name')

      // ...and a per-target override is still the alias's own.
      const declared: any = makeModel()
      declared.main.kit.target.ts2.publish = {
        registry: { package: '@acme/second' },
      }
      strictEqual(packageName(declared, 'ts2'), '@acme/second')
      strictEqual(packageName(declared, 'ts'), packageName(model, 'ts'),
        "the alias's override leaked onto its origin")
    })


    test('registryState applies the go family rule to a go alias', () => {
      // The alias DECLARES a live registry, and that is the point of the
      // fixture: with no registry declared, `registryState` returns 'tag'
      // through the "no registry configured" path and the assertion passes
      // whether or not the family rule ran. Only a declared-active registry
      // isolates the rule — go is tag-only whatever the model says, because
      // the Go toolchain installs from a tag.
      const model: any = makeModel()
      model.main.kit.target.go2.publish = {
        registry: { name: 'npm', state: 'active' },
      }

      strictEqual(registryState(model, 'go2'), 'tag',
        'an aliased go target escaped the go-family tag-only rule')
      strictEqual(isPublished(model, 'go2'), false)
    })


    test('packageName resolves the ALIAS module for the go family', () => {
      // Selecting the case by origin was necessary but not sufficient: the go
      // arms then called `goModule(model, 'go')` with the language literal, so
      // `packageName(model, 'go2')` still answered with the origin's module.
      // The same conflation, one level further down.
      const model = makeModel()

      strictEqual(packageName(model, 'go2'), 'github.com/acme/demo-sdk/go2')
      strictEqual(packageName(model, 'go'), 'github.com/acme/demo-sdk/go')
    })


    test('vendorCommand gives a go alias its own go get line', () => {
      // This is the path a normal `go~go2` actually takes: `registryState`
      // calls the whole go family tag-only, so READMEs reach vendorCommand
      // rather than installCommand. Switching it on the raw name meant the
      // alias fell to `default` and printed "not yet on the registry" instead
      // of an install command that works.
      const model = makeModel()

      strictEqual(vendorCommand(model, 'go2'),
        'go get github.com/acme/demo-sdk/go2@latest')
    })


    test('goPackageIdent follows the alias', () => {
      // Missed by the first sweep because that sweep listed the helpers by
      // hand. The list now comes from the module's exports.
      const model: any = makeModel()
      model.main.kit.target.go2.module.package = 'acmesecond'

      strictEqual(goPackageIdent(model, 'go2'), 'acmesecond')
    })


    test('installCommand names the alias, in the origin package manager', () => {
      const model: any = makeModel()
      model.main.kit.target.ts2.publish = {
        registry: { name: 'npm', state: 'active', package: '@acme/second' },
      }

      strictEqual(installCommand(model, 'ts2'), 'npm install @acme/second',
        'an aliased ts returned an empty install line')
    })

  })

})
