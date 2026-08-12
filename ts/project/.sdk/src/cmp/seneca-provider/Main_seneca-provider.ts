import {
  cmp, each,
  File, Content, Copy, Folder,
  entityCollection, entityOps, entityIdField, entityClassName,
  opRequestShape, opParams, entityPath,
  collectDeps, repoInfo, packageName, packageVersion, apiName, envName,
  SdkGenError,
} from '@voxgig/sdkgen'

import {
  KIT,
} from '@voxgig/apidef'

import { Tests, Scripts, Workflow, Readme } from './Extras_seneca-provider'


// The `seneca-provider` target: a Seneca plugin exposing this API's entities
// as Seneca entities (`provider/<name>/<entity>`), layered on the sibling
// `ts` SDK.
//
// A consumer target in the go-cli / py-data mould — every standard phase is
// off in model/target/seneca-provider.aontu and this component emits the
// whole package. It differs from those in one way that shapes everything
// here: it generates into ITS OWN REPO (`output: path`), depends on the SDK
// as a PUBLISHED npm package rather than by path, and therefore carries a
// repo's worth of furniture rather than a subfolder's.
//
// SHAPE OF THE MAPPING
//
// Seneca's store commands are list / load / save / remove. The SDK's are
// list / load / create / update / remove. `save` is the one that is not
// one-to-one: Seneca's convention is that an entity carrying an id is an
// update and one without is a create, so `save` dispatches on `data.id`.
//
// Everything else follows from the model:
//   - which cmds exist at all, from the entity's declared ops;
//   - the required path params of each op, which become argument guards (a
//     nested entity like `moon` under `/planet/{planet_id}/moon` cannot build
//     its URL without the parent id, and an opaque 404 from a half-built URL
//     is a bad error message);
//   - the SDK accessor and entity class names, from the same helpers the ts
//     target uses, so the two cannot drift.


// Seneca store cmd -> the SDK ops it needs. `save` needs BOTH create and
// update; it is emitted when either is present and dispatches on the id.
const CMD_OPS: Record<string, string[]> = {
  list: ['list'],
  load: ['load'],
  save: ['create', 'update'],
  remove: ['remove'],
}


// The required (non-optional) request keys of an op, id first. These are what
// the SDK needs to build the path, so they are what the provider must have
// before it calls.
function requiredKeys(ent: any, opname: string): string[] {
  const idf = entityIdField(ent)
  return opRequestShape(ent, opname).items
    .filter((it: any) => !it.optional)
    .map((it: any) => it.name)
    .sort((a: string, b: string) => (a === idf ? 0 : 1) - (b === idf ? 0 : 1))
}


// A nested entity's parent PATH params: `moon` under
// `/planet/{planet_id}/moon` yields ['planet_id']. These are the keys a
// caller can forget, so each gets a guard.
//
// From opParams — the op's declared path params — NOT from opRequestShape.
// For create/update the latter also returns the request BODY fields, so
// reading it here generated a "planet name is required" guard for every
// writable field on every entity.
function parentKeys(ent: any): string[] {
  const idf = entityIdField(ent)
  const seen = new Set<string>()

  for (const opname of Object.keys(ent.op || {})) {
    for (const p of opParams((ent.op || {})[opname])) {
      const name = (p as any).name
      if (false !== (p as any).reqd && name !== idf && name !== 'id') {
        seen.add(name)
      }
    }
  }

  return [...seen].sort()
}


// A model field's broad shape, for generating seed data that reads as data.
// The model carries canon strings (`\`$STRING\``), not JS types.
function fieldKind(type: any): string {
  const t = String(type || '').toUpperCase()
  if (t.includes('NUMBER') || t.includes('INTEGER')) return 'number'
  if (t.includes('BOOLEAN')) return 'boolean'
  return 'string'
}


// Which entity a parent path param refers to: `planet_id` -> `planet`, but
// only when an entity of that name actually exists. A key that names no
// entity gets no cross-reference, and the seed falls back to a plain string.
function parentEntityOf(key: string, names: string[]): string {
  const stem = key.replace(/_id$/, '')
  return names.includes(stem) ? stem : ''
}


// The repo this provider is released from — NOT the SDK's. A provider is its
// own package in its own repo, so its manifest's homepage/repository must
// point there; deriving them from `main: kit: repo` sends every link in the
// published package to the SDK instead.
//
// Order: the project's `output: repo`, else the Seneca convention.
function providerRepo(model: any, lower: string): { url: string, path: string } {
  const host = model?.main?.[KIT]?.repo?.host || 'github.com'
  const declared = model?.main?.[KIT]?.target?.['seneca-provider']?.output?.repo
  const path = null != declared && '' !== declared ?
    String(declared) : `senecajs/seneca-${lower}-provider`

  return { url: `https://${host}/${path}`, path }
}


// The provider's published package name: the project's pin when it has one,
// else `@seneca/<name>-provider`. packageName() cannot answer this — its
// derivations are all SDK-shaped (`@<origin>/<slug>-sdk`).
function providerPackage(model: any, lower: string): string {
  const declared = model?.main?.[KIT]?.target?.['seneca-provider']
    ?.publish?.registry?.package
  return null != declared && '' !== declared ?
    String(declared) : `@seneca/${lower}-provider`
}


const Main = cmp(function Main(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  // HARD REQUIREMENT: this plugin imports the TypeScript SDK. Generating it
  // without `ts` produces a package whose every import fails, so fail at
  // GENERATE time with an actionable message instead.
  const targets = model.main[KIT].target || {}
  if (null == targets.ts) {
    throw new SdkGenError(
      'seneca-provider requires the `ts` target in the same SDK: it imports ' +
      'the TypeScript SDK that `ts` generates. Add it with:\n' +
      '  npm run add-target ts\n' +
      'then regenerate.')
  }

  const Name = model.const.Name                 // Solardemo
  const lower = String(model.const.name)        // solardemo
  const ENV = envName(model)                    // SOLARDEMO
  const sdkClass = `${Name}SDK`                 // SolardemoSDK
  const pluginName = `${Name}Provider`          // SolardemoProvider
  const fileBase = `${lower}-provider`          // solardemo-provider

  // The SDK is a PUBLISHED dependency, not a path: this package lives in its
  // own repo. Its name is whatever the ts target publishes under, pin
  // included, so the two can never disagree.
  const sdkPkg = packageName(model, 'npm')
  const sdkVersion = packageVersion(model, 'ts')

  const entityColl = entityCollection(model)

  // Entities this provider can serve: those with at least one op that maps to
  // a Seneca store cmd. An entity with no such op would produce an empty cmd
  // map, which seneca-entity treats as a store that answers nothing.
  const entityNames = Object.keys(entityColl).sort()
    .map((key: string) => entityColl[key].name)

  const entities = Object.keys(entityColl).sort()
    .map((key: string) => entityColl[key])
    .map((ent: any) => {
      const parents = parentKeys(ent)
      return {
        ent,
        name: ent.name,
        // The SDK ACCESSOR on the client (`client.Moon()`), which is the
        // entity's PascalCase name — NOT entityClassName, which is the
        // collision-safe CLASS name the accessor constructs (`MoonEntity`).
        // Calling the class name reads plausibly and fails at runtime with
        // "sdk.MoonEntity is not a function". MainEntity_ts is the authority
        // for this: it declares the method as `${entity.Name}()`.
        acc: ent.Name,
        // The entity's canonical route, used to probe the live server for
        // liveness. Path params are left in place only if the route has
        // them — a collection route (the `list` op's) has none, which is why
        // entityPath prefers it.
        path: entityPath(ent),
        cls: entityClassName(ent, entityColl),
        ops: entityOps(ent),
        idf: entityIdField(ent),
        parents,
        // The entity each parent key points at, so seeded child records
        // reference a parent record that exists.
        parentEntity: 0 < parents.length ?
          parentEntityOf(parents[0], entityNames) : '',
        // Required fields only: a seed record has to satisfy the shape the
        // SDK will hand back, and optional noise makes the assertions
        // harder to read.
        fields: (ent.fields || [])
          .filter((f: any) => false !== f.req)
          .map((f: any) => ({
            name: f.name,
            kind: fieldKind(f.type),
            parentEntity: parentEntityOf(f.name, entityNames),
          })),
      }
    })
    .map((e: any) => ({
      ...e,
      cmds: Object.keys(CMD_OPS)
        .filter((cmd) => CMD_OPS[cmd].some((op) => e.ops.includes(op))),
    }))
    .filter((e: any) => 0 < e.cmds.length)

  if (0 === entities.length) {
    throw new SdkGenError(
      'seneca-provider: no entity in this model declares a list/load/create/' +
      'update/remove operation, so the plugin would expose no entities at ' +
      'all. Remove the target, or add an entity with CRUD ops.')
  }

  const repo = providerRepo(model, lower)

  // The companion test server lives in the SDK repo's `app/` and is NOT
  // published, so the only way to reach it is the local checkout. The path
  // back to it is the inverse of this target's own `output: path`, computed
  // once by the external pass — see cmp/ExternalTarget.
  const sdkrel = ctx$.sdkrelpath || '..'

  // Where a live run points by default: the first declared server, which for
  // a project with a companion app is that app's own URL. Empty means the
  // live tests are not generated at all — there is no honest default host for
  // an arbitrary third-party API.
  const servers = (model?.main?.[KIT]?.info?.servers || [])
  const liveBase = 0 < servers.length ? String(servers[0].url || '') : ''

  const provider = {
    Name, lower, ENV, sdkClass, pluginName, fileBase,
    sdkPkg, sdkVersion, entities,
    repoUrl: repo.url,
    // The SDK's own repo, for pointing at the companion test server which is
    // only distributed in source.
    sdkRepoUrl: repoInfo(model).repoUrl,
    api: apiName(model),
    version: packageVersion(model, target.name),
    sdkrel,
    liveBase,
    // A route with NO path params, so the probe is a plain GET. An entity
    // whose every route is parameterised gives none, and then the probe
    // falls back to the base URL itself.
    probePath: (entities.find((e: any) =>
      '' !== e.path && !e.path.includes('{')) || { path: '' }).path,
    // The provider's OWN published name. Not derived from the SDK slug the
    // way a language target's is — a provider is `@seneca/<name>-provider` —
    // so read the project's pin directly and default to that shape.
    pkgName: providerPackage(model, lower),
  }

  // Static furniture: LICENSE, CODE_OF_CONDUCT, Makefile, .gitignore,
  // tsfmt.json and both tsconfigs. Same for every provider.
  Copy({
    from: 'tm/' + target.name,
    replace: { ...ctx$.stdrep },
  })

  PackageJson({ provider })
  ProviderSource({ provider })
  ProviderDoc({ provider })
  Tests({ provider })
  Scripts({ provider })
  Workflow({ provider })
  Readme({ provider })
})


// --- package.json -----------------------------------------------------------

const PackageJson = cmp(function PackageJson(props: any) {
  const { provider } = props
  const { model } = props.ctx$
  const target = model.main[KIT].target['seneca-provider']

  const deps = collectDeps(model, target.name, target.deps, props.ctx$.log)

  // collectDeps returns { name, version, source, raw } — the DECLARED kind
  // (prod/peer/dev) is on `raw`, not hoisted. Reading `d.kind` instead
  // silently yields an empty manifest section, which is how the first cut of
  // this component shipped a package.json with no seneca peers at all.
  const dep = (kind: string) => {
    const out: Record<string, string> = {}
    for (const d of deps.filter((d: any) => kind === (d.raw && d.raw.kind))) {
      out[d.name] = d.version
    }
    return out
  }

  const pkg = {
    name: provider.pkgName,
    version: provider.version,
    main: `dist/${provider.fileBase}.js`,
    type: 'commonjs',
    types: `dist/${provider.fileBase}.d.ts`,
    description:
      `Seneca entity provider for the ${provider.api} API, using the ` +
      `${provider.sdkPkg} SDK.`,
    homepage: provider.repoUrl,
    keywords: ['seneca', provider.lower, `${provider.lower}-provider`, 'sdk'],
    license: 'MIT',
    repository: { type: 'git', url: `git+${provider.repoUrl}.git` },
    scripts: {
      test: 'node --enable-source-maps --test test/**/*.test.js',
      'test-some':
        'node --enable-source-maps --test-name-pattern="$TEST_PATTERN" ' +
        '--test "test/**/*.test.js"',
      'test-watch': 'node --test --watch test/**/*.test.js',
      watch: 'tsc --build src test -w',
      build: 'tsc --build src test',
      clean:
        'rm -rf node_modules dist dist-test .tsbuildinfo yarn.lock ' +
        'package-lock.json',
      reset: 'npm run clean && npm i && npm run build && npm test',
    },
    // What actually ships. Without `files`, `npm publish` packs the test
    // suite and build output into the tarball.
    files: ['dist', 'src/**/*.ts', 'LICENSE'],
    engines: { node: '>=24' },
    dependencies: {
      // The SDK this plugin wraps, by its PUBLISHED name and version.
      [provider.sdkPkg]: `^${provider.sdkVersion}`,
      ...dep('prod'),
    },
    peerDependencies: dep('peer'),
    devDependencies: dep('dev'),
  }

  File({ name: 'package.json' }, () => {
    Content(JSON.stringify(pkg, null, 2) + '\n')
  })
})


// --- src/<name>-provider.ts -------------------------------------------------

const ProviderSource = cmp(function ProviderSource(props: any) {
  const { provider } = props

  Folder({ name: 'src' }, () => {
    File({ name: `${provider.fileBase}.ts` }, () => {
      Content(`/* Generated by @voxgig/sdkgen. Do not edit. */

const Pkg = require('../package.json')

const { ${provider.sdkClass} } = require('${provider.sdkPkg}')

const SdkPkg = require('${provider.sdkPkg}/package.json')


type ${provider.pluginName}Options = {
  // Options passed straight to the ${provider.sdkClass} constructor,
  // most usefully \`base\` to point at a server.
  sdk?: Record<string, any>

  // Run the SDK in offline test mode (in-memory mock transport).
  test?: boolean

  // Test feature options, e.g. {entity: {${provider.entities[0].name}: {...}}} to
  // seed the mock with data. Only used when \`test\` is true.
  testopts?: Record<string, any>
}


function ${provider.pluginName}(this: any, options: ${provider.pluginName}Options) {
  const seneca: any = this

  const entityBuilder = this.export('provider/entityBuilder')

  seneca.message('sys:provider,provider:${provider.lower},get:info', get_info)

  async function get_info(this: any, _msg: any) {
    return {
      ok: true,
      name: '${provider.lower}',
      version: Pkg.version,
      sdk: {
        name: '${provider.sdkPkg}',
        version: SdkPkg.version,
      },
    }
  }


  // Every SDK operation resolves to an SDK ENTITY rather than raw data (a
  // removed record included: it comes back marked deleted, still holding what
  // it held). Seneca wants plain data, which the entity hands over through
  // data().
  function plain(res: any) {
    return null == res ? res : res.data()
  }


  // Seneca query directives (sort$, limit$, ...) are for the store, not the
  // API, so they must not reach the SDK as match fields.
  function cleanq(q: any) {
    const out: any = {}
    for (const k in (q || {})) {
      if (!k.endsWith('$')) {
        out[k] = q[k]
      }
    }
    return out
  }


  // The SDK throws on any non-2xx. A 404 from a single-item read is an
  // ordinary "not found" answer rather than a failure, so return null and let
  // everything else propagate. SDK errors carry the HTTP status at the top
  // level, so ask them rather than digging into \`result\`.
  async function ornull(action: () => Promise<any>) {
    try {
      return await action()
    }
    catch (e: any) {
      if (true === e?.notFound) {
        return null
      }
      throw e
    }
  }

`)

      // A guard per required parent key. Without it the SDK builds a
      // half-formed URL and the caller gets an opaque 404 instead of being
      // told what they left out.
      const guarded = provider.entities.filter((e: any) => 0 < e.parents.length)
      if (0 < guarded.length) {
        Content(`  // Nested entities cannot build their path without the parent id, so
  // say which key is missing rather than letting the SDK report an opaque
  // 404 on a half-built URL.
`)
        each(guarded, (e: any) => {
          each(e.parents, (key: any) => {
            const k = String(key.val$ ?? key)
            Content(`  function need_${e.name}_${k}(value: any, cmd: string) {
    if (null == value || '' === value) {
      throw new Error(
        '${provider.pkgName}: ${e.name} ' + cmd + ': ${k} is required'
      )
    }
    return value
  }


`)
          })
        })
      }

      // The cmd map, declared up front so every action is attached to a
      // shape seneca-entity can read before the actions are defined.
      Content(`  const entity: any = {
`)
      each(provider.entities, (e: any) => {
        Content(`    ${e.name}: {
      cmd: {
`)
        each(e.cmds, (cmd: any) => {
          Content(`        ${String(cmd.val$ ?? cmd)}: { action: (undefined as any) },
`)
        })
        Content(`      },
    },

`)
      })
      Content(`  }

`)

      each(provider.entities, (e: any) => {
        const guard = (cmd: string, src: string) => e.parents
          .map((k: string) => `      need_${e.name}_${k}(${src}.${k}, '${cmd}')\n`)
          .join('')

        if (e.cmds.includes('list')) {
          Content(`
  entity.${e.name}.cmd.list.action =
    async function list_${e.name}(this: any, entize: any, msg: any) {
      const q = cleanq(msg.q)
${guard('list', 'q')}      const list = await this.shared.sdk.${e.acc}().list(q)
      return list.map((data: any) => entize(plain(data)))
    }

`)
        }

        if (e.cmds.includes('load')) {
          const keys = requiredKeys(e.ent, 'load')
          const arg = 0 === keys.length ? '{}' :
            `{ ${keys.map((k: string) => `${k}: q.${k}`).join(', ')} }`
          Content(`
  entity.${e.name}.cmd.load.action =
    async function load_${e.name}(this: any, entize: any, msg: any) {
      const q = cleanq(msg.q)
${guard('load', 'q')}      const res = await ornull(() => this.shared.sdk.${e.acc}().load(${arg}))
      return null == res ? null : entize(plain(res))
    }

`)
        }

        if (e.cmds.includes('save')) {
          const hasCreate = e.ops.includes('create')
          const hasUpdate = e.ops.includes('update')
          const idf = e.idf || 'id'

          // Seneca's convention: an entity with an id is an update, without
          // is a create. When the API offers only one of the two, there is
          // nothing to dispatch on.
          const body = hasCreate && hasUpdate
            ? `      const res = null == data.${idf}
        ? await sdk.${e.acc}().create(data)
        : await sdk.${e.acc}().update(data)`
            : hasCreate
              ? `      const res = await sdk.${e.acc}().create(data)`
              : `      const res = await sdk.${e.acc}().update(data)`

          Content(`
  entity.${e.name}.cmd.save.action =
    async function save_${e.name}(this: any, entize: any, msg: any) {
      const data = msg.ent.data$(false)
${guard('save', 'data')}      const sdk = this.shared.sdk

${body}

      return entize(plain(res))
    }

`)
        }

        if (e.cmds.includes('remove')) {
          const keys = requiredKeys(e.ent, 'remove')
          const arg = 0 === keys.length ? '{}' :
            `{ ${keys.map((k: string) => `${k}: q.${k}`).join(', ')} }`
          Content(`
  entity.${e.name}.cmd.remove.action =
    async function remove_${e.name}(this: any, _entize: any, msg: any) {
      const q = cleanq(msg.q)
${guard('remove', 'q')}      await ornull(() => this.shared.sdk.${e.acc}().remove(${arg}))
      return null
    }

`)
        }
      })

      Content(`
  entityBuilder(this, {
    provider: {
      name: '${provider.lower}',
    },
    entity
  })


  seneca.prepare(async function(this: any) {
    const sdkopts: any = Object.assign({}, options.sdk)

    // The provider convention carries credentials, so honour an \`apikey\`
    // when one is configured and stay quiet when it is not — an API that
    // needs none still exercises the same path.
    const res = await this.post('sys:provider,get:keymap,provider:${provider.lower}')
    const apikey = res?.keymap?.apikey?.value

    if (null != apikey && '' !== apikey) {
      sdkopts.headers = Object.assign(
        { authorization: 'Bearer ' + apikey },
        sdkopts.headers
      )
    }

    this.shared.sdk = options.test
      ? ${provider.sdkClass}.test(options.testopts || {}, sdkopts)
      : new ${provider.sdkClass}(sdkopts)
  })


  return {
    exports: {
      sdk: () => this.shared.sdk,
    },
  }
}


// Default options.
const defaults: ${provider.pluginName}Options = {
  sdk: {},
  test: false,
  testopts: {},
}

Object.assign(${provider.pluginName}, { defaults })

export default ${provider.pluginName}

if ('undefined' !== typeof module) {
  module.exports = ${provider.pluginName}
}
`)
    })
  })
})


// --- src/<Name>Provider-doc.ts ----------------------------------------------

const ProviderDoc = cmp(function ProviderDoc(props: any) {
  const { provider } = props

  Folder({ name: 'src' }, () => {
    File({ name: `${provider.pluginName}-doc.ts` }, () => {
      Content(`/* Generated by @voxgig/sdkgen. Do not edit. */


const messages = {
  get_info: {
    desc: 'Get information about the ${provider.api} SDK.',
  },
}


const sections = {
  intro: {
    path: '../provider/doc/intro.md'
  }
}

const docs = {
  sections,
  messages
}

export default docs


if ('undefined' !== typeof module) {
  module.exports = docs
}
`)
    })
  })
})


export {
  Main,
}
