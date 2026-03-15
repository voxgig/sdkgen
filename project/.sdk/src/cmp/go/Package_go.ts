
import {
  Content,
  File,
  cmp,
  each,
} from '@voxgig/sdkgen'


import {
  KIT,
  Model,
  getModelPath,
} from '@voxgig/apidef'


const Package = cmp(async function Package(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const feature = getModelPath(model, `main.${KIT}.feature`)

  // Module name: concatenated lowercase (e.g., voxgigsolardemosdk)
  const orgPrefix = (model.origin || '').replace(/-sdk$/, '').replace(/[^a-z0-9]/gi, '')
  const gomodule = orgPrefix + model.name + 'sdk'

  File({ name: 'go.mod' }, () => {
    Content(`module ${gomodule}

go 1.20

`)

    // Collect dependencies from features
    const deps: Record<string, string> = {}
    const replaceDirs: Record<string, string> = {}

    each(feature, (f: any) => {
      const goDeps = f.deps?.go
      if (goDeps) {
        each(goDeps, (dep: any) => {
          if (dep.active) {
            deps[dep.key$] = dep.version
          }
        })
      }
    })

    // Add target-level deps
    const targetDeps = target.deps
    if (targetDeps) {
      each(targetDeps, (dep: any) => {
        if (dep.active !== false) {
          deps[dep.key$] = dep.version || 'v0.0.0'
          if (dep.replace) {
            replaceDirs[dep.key$] = dep.replace
          }
        }
      })
    }

    if (Object.keys(deps).length > 0) {
      Content(`require (
`)
      for (const [name, version] of Object.entries(deps)) {
        Content(`\t${name} ${version}
`)
      }
      Content(`)
`)
    }

    if (Object.keys(replaceDirs).length > 0) {
      Content(`
`)
      for (const [name, dir] of Object.entries(replaceDirs)) {
        Content(`replace ${name} => ${dir}
`)
      }
    }
  })
})


export {
  Package
}
