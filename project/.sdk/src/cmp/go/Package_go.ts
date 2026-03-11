
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

  const sdkname = model.name
  const origin = null == model.origin ? '' : `${model.origin}/`

  File({ name: 'go.mod' }, () => {
    Content(`module ${origin}${sdkname}

go 1.21

`)

    // Collect dependencies from features
    const deps: Record<string, string> = {}

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
        }
      })
    }

    if (Object.keys(deps).length > 0) {
      Content(`require (
`)
      for (const [name, version] of Object.entries(deps)) {
        Content(`	${name} ${version}
`)
      }
      Content(`)
`)
    }
  })
})


export {
  Package
}
