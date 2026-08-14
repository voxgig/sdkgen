
import * as Path from 'node:path'


import {
  Content,
  File,
  Fragment,
  Line,
  cmp,
  each,
  indent,
  isAuthActive,
  isConfigData,
  resolveAuthPrefix,
  serverVariables,
} from '@voxgig/sdkgen'


import {
  KIT,
  Model,
  getModelPath,
  nom,
} from '@voxgig/apidef'


import {
  clean,
  formatJson,
} from './utility_ts'


const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const ff = Path.normalize(__dirname + '/../../../src/cmp/ts/fragment/')

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  // config.auth.prefix override -> spec-derived info.security.prefix -> 'Bearer'
  const authPrefix = resolveAuthPrefix(model)
  const authBlock = authActive
    ? `auth: {
      prefix: '${authPrefix}',
    },

    `
    : ''

  // Templated server URL: emit the spec's server-variable defaults so the
  // runtime can substitute {name} placeholders in base (see makeOptions).
  const svars = serverVariables(model)
  const serverBlock = 0 === svars.length ? '' :
    'server: {\n' +
    svars.map((v: any) => `      ${JSON.stringify(v.name)}: ${JSON.stringify(v.dflt)},\n`).join('') +
    '    },\n\n    '

  // Read the base URL here rather than leaving it to a `$$...$$` stdrep
  // placeholder in the fragment. stdrep can only substitute a path the model
  // actually has: a model with no `info.servers` left the placeholder itself in
  // the generated source, so `options.base` came out as the literal string
  // '$main.kit.info.servers.0.url$'. Reading it explicitly yields '' in that
  // case, which is what every other target already emits, and is identical to
  // the old output whenever the model does define a server.
  let baseUrl = ''
  try {
    baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`)
  } catch (_e) { }

  // The same config as an OBJECT, so it can be measured and, above the
  // threshold, emitted as data instead of as class field literals. Mirrors the
  // literal branch below exactly - feature config is NOT cleaned here, because
  // it is not cleaned there either.
  const entityDefs: any = {}
  each(entity, (e: any) => {
    entityDefs[e.name] = clean({
      fields: e.fields,
      name: e.name,
      op: e.op,
      relations: e.relations,
    }, true)
  })

  const featureDefs: any = {}
  each(feature, (f: any) => {
    featureDefs[f.name] = f.config
  })

  const entityStubs: any = {}
  each(entity, (e: any) => {
    entityStubs[e.name] = {}
  })

  const optionsDef: any = { base: baseUrl }
  if (0 < svars.length) {
    optionsDef.server = svars.reduce(
      (a: any, v: any) => (a[v.name] = v.dflt, a), {})
  }
  if (authActive) {
    optionsDef.auth = { prefix: authPrefix }
  }
  optionsDef.headers = headers
  optionsDef.entity = entityStubs

  const configDef = {
    main: { name: model.const.Name },
    feature: featureDefs,
    options: optionsDef,
    entity: entityDefs,
  }
  const configJson = JSON.stringify(configDef)

  // `auto` decides by size; 'data'/'literal' pin it for this SDK.
  let configReprSetting = 'auto'
  try {
    configReprSetting = getModelPath(model, `main.${KIT}.config.repr`) || 'auto'
  } catch (_e) { }

  File({ name: 'Config.' + target.ext }, () => {

    if (isConfigData(configJson, configReprSetting)) {
      Fragment({
        from: ff + 'Config.data.fragment.ts',

        replace: {

          '// #ImportFeatures': () => each(feature, (f: any) => {
            Line(`import { ${nom(f, 'Name')}Feature } from ` +
              `'./feature/${f.name}/${nom(f, 'Name')}Feature'`)
          }),

          '// #FeatureClasses': () => each(feature, (f: any) => {
            Line(` ${f.name}: ${nom(f, 'Name')}Feature,`)
          }),

          // A JS string literal, so the JSON survives verbatim. JSON.stringify
          // escapes the quotes and backslashes the model contains (values like
          // `$STRING` carry backticks, which a template literal could not).
          "'CONFIGJSON'": JSON.stringify(configJson),
        }
      })
      return
    }

    Fragment({
      from: ff + 'Config.fragment.ts',

      replace: {

        "'BASEURL'": JSON.stringify(baseUrl),

        "'SERVERBLOCK'": serverBlock,

        "'AUTHBLOCK'": authBlock,

        "'HEADERS'": indent(JSON.stringify(headers, null, 2), 4).trim(),

        '// #ImportFeatures': () => each(feature, (f: any) => {
          Line(`import { ${nom(f, 'Name')}Feature } from ` +
            `'./feature/${f.name}/${nom(f, 'Name')}Feature'`)
        }),

        '// #FeatureClasses': () => each(feature, (f: any) => {
          // Trailing comma: the map has one entry per feature, so entries
          // must be comma-separated (a single feature hid this until now).
          Line(` ${f.name}: ${nom(f, 'Name')}Feature,`)
        }),

        '// #FeatureConfigs': () => each(feature, (f: any) => {
          Line(` ${f.name}: ${formatJson(f.config, { margin: 4 })},`)
        }),


        '// #EntityConfigs': () => each(entity, (entity: any) => {
          Content(`
      ${entity.name}: {
      },
`)
        }),

        "'ENTITYMAP'": formatJson(Object.values(entity)
          .reduce((a: any, n: any) => (a[n.name] = clean({
            fields: n.fields,
            name: n.name,
            op: n.op,
            relations: n.relations,
          }, true), a), {}), { margin: 2 }).trim(),
      }
    })
  })
})


export {
  Config
}
