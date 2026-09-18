
import { test, describe } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'

import {
  pluginExcludes,
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
  luaKey,
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
      const names = collectDeps(makeModel(), 'go', undefined).map((d) => d.name)
      strictEqual(names.includes('github.com/x/nope'), false)
    })

    // A PLUGIN IS TRIMMABLE INSIDE AN ACTIVE FEATURE, so its deps are gated
    // one step deeper: the manifest must agree with the tree the trim
    // leaves behind, or the build asks for a package whose files are gone.
    function pluginModel(active: boolean) {
      const model: any = makeModel()
      model.main.kit.feature.secrets = {
        active: true,
        name: 'secrets',
        plugin: {
          minivault: {
            name: 'minivault',
            active,
            deps: { rust: { ring: { active: true, version: '0.17' } } },
          },
        },
      }
      return model
    }

    test('an active plugin contributes its deps', () => {
      const out = collectDeps(pluginModel(true), 'rust', undefined)
      deepStrictEqual(out.map((d) => d.name), ['ring'])
      strictEqual(out[0].version, '0.17')
      strictEqual(out[0].source, 'feature')
    })

    test('an inactive plugin contributes nothing, though its feature is on', () => {
      const out = collectDeps(pluginModel(false), 'rust', undefined)
      deepStrictEqual(out.map((d) => d.name), [])
    })

    test('a plugin dep left at the default is declared, not taken', () => {
      const model = pluginModel(true)
      model.main.kit.feature.secrets.plugin.minivault.deps.rust.ring = { version: '0.17' }
      deepStrictEqual(collectDeps(model, 'rust', undefined).map((d) => d.name), [])
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
        'github.com/t/a': { version: 'v5' },
        'github.com/t/b': { active: false, version: 'v6' },
        'github.com/t/c': { active: true, version: 'v7' },
      }
      const out = collectDeps(makeModel(), 'go', targetDeps)
      const byName = Object.fromEntries(out.map((d) => [d.name, d]))

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

    test('luaKey brackets a keyword, and any non-identifier', () => {
      // Every Lua keyword must be bracketed, not just the memorable ones.
      for (const kw of [
        'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for',
        'function', 'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat',
        'return', 'then', 'true', 'until', 'while',
      ]) {
        strictEqual(luaKey(kw), `["${kw}"]`)
      }

      // Plain identifiers stay bare, including ones that merely START with a
      // keyword — `ending` is not `end`.
      strictEqual(luaKey('city'), 'city')
      strictEqual(luaKey('start'), 'start')
      strictEqual(luaKey('_x'), '_x')
      strictEqual(luaKey('a1'), 'a1')
      strictEqual(luaKey('ending'), 'ending')
      strictEqual(luaKey('endDate'), 'endDate')

      strictEqual(luaKey('start-date'), '["start-date"]')
      strictEqual(luaKey('a.b'), '["a.b"]')
      strictEqual(luaKey('2x'), '["2x"]')
      strictEqual(luaKey('per_page[]'), '["per_page[]"]')
      strictEqual(luaKey(''), '[""]')

      // `self` is reserved in Ruby but NOT in Lua, so it is a bare key here.
      strictEqual(luaKey('self'), 'self')
    })


    test('sanitises reserved words per language with a trailing _', () => {
      strictEqual(safeVarName('self', 'rb'), 'self_')
      strictEqual(safeVarName('end', 'rb'), 'end_')
      strictEqual(safeVarName('class', 'py'), 'class_')
      strictEqual(safeVarName('end', 'lua'), 'end_')
      strictEqual(safeVarName('self', 'lua'), 'self')
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
      strictEqual(rbSafeTypeName('Utility'), 'Utility')
      strictEqual(rbSafeTypeName('Context'), 'Context')
      strictEqual(rbSafeTypeName('Response'), 'Response')
      strictEqual(rbSafeTypeName('Operation'), 'Operation')
    })
  })


  describe('phpSafeTypeName', () => {

    test('folds case, as PHP does', () => {
      strictEqual(phpSafeTypeName('Namespace'), 'NamespaceType')
      strictEqual(phpSafeTypeName('namespace'), 'namespaceType')
      strictEqual(phpSafeTypeName('NAMESPACE'), 'NAMESPACEType')

      strictEqual(isPhpReservedType('Namespace'), true)
      strictEqual(isPhpReservedType('NaMeSpAcE'), true)
    })

    test('suffixes words PHP will not accept as a class name', () => {
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

      const declared: any = makeModel()
      declared.main.kit.target.ts2.publish = {
        registry: { package: '@acme/second' },
      }
      strictEqual(packageName(declared, 'ts2'), '@acme/second')
      strictEqual(packageName(declared, 'ts'), packageName(model, 'ts'),
        "the alias's override leaked onto its origin")
    })


    test('registryState applies the go family rule to a go alias', () => {
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


describe('pluginExcludes', () => {

  const model = (plugins: any) => ({
    main: { kit: { feature: { secrets: {
      name: 'secrets', active: true, plugin: plugins,
    } } } },
  })

  test('an inactive plugin is excluded', () => {
    const out = pluginExcludes(model({
      dotenv: { name: 'dotenv', active: true },
      aws: { name: 'aws', active: false },
    }))
    deepStrictEqual(out.map(String),
      [String(/(^|\/)src\/feature\/secrets\/plugin\/aws\//)])
  })

  test('an active plugin is kept', () => {
    deepStrictEqual(
      pluginExcludes(model({ dotenv: { name: 'dotenv', active: true } })), [])
  })

  test('a feature with no plugins excludes nothing', () => {
    deepStrictEqual(pluginExcludes({
      main: { kit: { feature: { retry: { name: 'retry', active: true } } } },
    }), [])
  })

  // An INACTIVE feature's whole tree is already gone via
  // srcFeatureExcludes, so its plugins must not be walked again here -
  // and the model's only_active filter would not return them anyway.
  test('an inactive feature contributes no plugin patterns', () => {
    deepStrictEqual(pluginExcludes({
      main: { kit: { feature: { secrets: {
        name: 'secrets', active: false,
        plugin: { aws: { name: 'aws', active: false } },
      } } } },
    }), [])
  })
})
