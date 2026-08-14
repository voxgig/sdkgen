
import * as Path from 'node:path'


import {
  File,
  Fragment,
  Line,
  cmp,
  each,
  isAuthActive,
  resolveAuthPrefix,
} from '@voxgig/sdkgen'


import {
  KIT,
  Model,
  getModelPath,
  nom,
} from '@voxgig/apidef'


import {
  clean,
  dartValue,
} from './utility_dart'


const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const ff = Path.normalize(__dirname + '/../../../src/cmp/dart/fragment/')

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  // config.auth.prefix override -> spec-derived info.security.prefix -> 'Bearer'
  const authPrefix = resolveAuthPrefix(model)
  const authBlock = authActive
    ? `'auth': <String, dynamic>{
      'prefix': '${authPrefix}',
    },

    `
    : ''

  // Read the base URL here rather than leaving it to a `$$...$$` stdrep
  // placeholder in the fragment. stdrep can only substitute a path the model
  // actually has: a model with no `info.servers` left the placeholder itself in
  // the generated source, so `options.base` came out as the literal string
  // '$main.kit.info.servers.0.url$'. Reading it explicitly yields '' in that
  // case, which is what every other target already emits, and is identical to
  // the old output whenever the model does define a server. Same defect, and
  // same fix, as ts and js.
  let baseUrl = ''
  try {
    baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`)
  } catch (_e) { }

  File({ name: 'Config.' + target.ext }, () => {

    Fragment({
      from: ff + 'Config.fragment.dart',

      replace: {

        // Config.fragment.dart carries `'name': 'ProjectName'` — without the
        // standard replacements the generated SDK reports "ProjectName" as its
        // own name at runtime. Every sibling dart component already spreads
        // these; this one did not.
        ...ctx$.stdrep,

        "'BASEURL'": JSON.stringify(baseUrl),

        "'AUTHBLOCK'": authBlock,

        "'HEADERS'": dartValue(headers, 2),

        '// #ImportFeatures': () => each(feature, (f: any) => {
          Line(`import 'feature/${f.name}/${nom(f, 'Name')}Feature.dart';`)
        }),

        '// #FeatureClasses': () => each(feature, (f: any) => {
          // Trailing comma: the map has one entry per feature, so entries
          // must be comma-separated (a single feature hid this until now).
          Line(`  '${f.name}': () => ${nom(f, 'Name')}Feature(),`)
        }),

        '// #FeatureConfigs': () => each(feature, (f: any) => {
          Line(`    '${f.name}': ${dartValue(f.config, 2)},`)
        }),


        '// #EntityConfigs': () => each(entity, (entity: any) => {
          Line(`      '${entity.name}': <String, dynamic>{},`)
        }),

        "'ENTITYMAP'": dartValue(Object.values(entity)
          .reduce((a: any, n: any) => (a[n.name] = clean({
            fields: n.fields,
            name: n.name,
            op: n.op,
            relations: n.relations,
          }, true), a), {}), 1),
      }
    })
  })
})


export {
  Config
}
