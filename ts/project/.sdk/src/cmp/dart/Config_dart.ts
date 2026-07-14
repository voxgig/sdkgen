
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

  File({ name: 'Config.' + target.ext }, () => {

    Fragment({
      from: ff + 'Config.fragment.dart',

      replace: {

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
          }), a), {}), 1),
      }
    })
  })
})


export {
  Config
}
