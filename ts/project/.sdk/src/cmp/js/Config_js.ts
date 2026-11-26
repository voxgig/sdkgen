
import * as Path from 'node:path'


import {
  Content,
  File,
  Fragment,
  Line,
  cmp,
  configDefinition,
  configReprSetting,
  each,
  indent,
  isConfigData,
  targetFeatures,
} from '@voxgig/sdkgen'


import {
  KIT,
  Model,
  getModelPath,
  nom,
} from '@voxgig/apidef'


import {
  formatJson,
} from './utility_js'


const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = targetFeatures(model, target)

  const ff = Path.normalize(__dirname + '/../../../src/cmp/js/fragment/')

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const { def: configDef, json: configJson } = configDefinition(model, target.name)
  const asData = isConfigData(configJson, configReprSetting(model))

  const auth = configDef.options.auth
  const authBlock = null == auth ? '' : `auth: {
      prefix: '${auth.prefix}',${auth.basic ? `
      basic: true,` : ''}${null == auth.in ? '' : `
      in: '${auth.in}',`}${null == auth.name ? '' : `
      name: '${auth.name}',`}
    },

    `

  const server = configDef.options.server
  const serverBlock = null == server ? '' :
    'server: {\n' +
    Object.entries(server).map(([name, dflt]: [string, any]) => `      ${JSON.stringify(name)}: ${JSON.stringify(dflt)},\n`).join('') +
    '    },\n\n    '

  File({ name: 'Config.' + target.ext }, () => {

    if (asData) {
      Fragment({
        from: ff + 'Config.data.fragment.js',

        replace: {

          '// #ImportFeatures': () => {
            each(feature, (f: any) => {
              Line(`const { ${nom(f, 'Name')}Feature } = ` +
                `require('./feature/${f.name}/${nom(f, 'Name')}Feature')`)
            })
            pluginImports(feature)
          },

          '// #FeatureClasses': () => {
            each(feature, (f: any) => {
              Line(` ${f.name}: ${nom(f, 'Name')}Feature,`)
            })
          },

          '// #FeaturePlugins': () => pluginDefs(feature),

          "'CONFIGJSON'": JSON.stringify(configJson),
        }
      })
      return
    }

    Fragment({
      from: ff + 'Config.fragment.js',

      replace: {

        "'BASEURL'": JSON.stringify(configDef.options.base),

        "'SERVERBLOCK'": serverBlock,

        "'AUTHBLOCK'": authBlock,

        "'HEADERS'": indent(JSON.stringify(headers, null, 2), 4).trim(),

        '// #ImportFeatures': () => {
          each(feature, (f: any) => {
            Line(`const { ${nom(f, 'Name')}Feature } = ` +
              `require('./feature/${f.name}/${nom(f, 'Name')}Feature')`)
          })
          pluginImports(feature)
        },

        // Values from configDefinition's def, not re-derived here, so the
        // literal rep and the data rep cannot disagree on identity.
        '// #MainMeta': () => {
          Line(`    slug: ${JSON.stringify(configDef.main.slug)},`)
          Line(`    version: ${JSON.stringify(configDef.main.version)},`)
          Line(`    target: ${JSON.stringify(configDef.main.target)},`)
        },

        '// #FeatureClasses': () => {
          each(feature, (f: any) => {
            Line(` ${f.name}: ${nom(f, 'Name')}Feature,`)
          })
        },

        '// #FeaturePlugins': () => pluginDefs(feature),

        // Rendered from configDefinition's def, not from f.config, so the
        // literal carries the feature's `transport` role (station design
        // §8.4) beside its options and cannot drift from the data rep.
        '// #FeatureConfigs': () => {
          each(feature, (f: any) => {
            Line(` ${f.name}: ${formatJson(configDef.feature[f.name], { margin: 4 })},`)
          })
        },


        '// #EntityConfigs': () => {
          each(entity, (entity: any) => {
            Content(`
        ${entity.name}: {
        },
  `)
          })
        },

        "'ENTITYMAP'": formatJson(configDef.entity, { margin: 2 }).trim(),
      }
    })
  })
})


function pluginImports(feature: any) {
  each(feature, (f: any) => {
    const bypath: Record<string, string[]> = {}

    each(f.plugin, (plugin: any) => {
      // Filter on `active` HERE rather than trusting the feature object to
      // arrive filtered. Whether a model path was read with `only_active`
      // varies by call site, and getting it wrong in this direction emits
      // a require for a module the trim just deleted — an SDK that throws
      // on load, rather than one that merely carries too much.
      if (false === plugin.active || null == plugin.active) return

      for (const [sym, one] of Object.entries(plugin.def?.js || {})) {
        const path = String(one)
        ; (bypath[path] = bypath[path] || []).push(sym)
      }
    })

    for (const path of Object.keys(bypath).sort()) {
      const spec = './' + path.replace(/^src\//, '').replace(/\.js$/, '')
      Line(`const { ${bypath[path].sort().join(', ')} } = require('${spec}')`)
    }
  })
}

function pluginDefs(feature: any) {
  each(feature, (f: any) => {
    const syms: string[] = []
    each(f.plugin, (plugin: any) => {
      if (false === plugin.active || null == plugin.active) return
      syms.push(...Object.keys(plugin.def?.js || {}))
    })
    if (0 < syms.length) {
      Line(` ${f.name}: [${syms.sort().join(', ')}],`)
    }
  })
}


export {
  Config
}
