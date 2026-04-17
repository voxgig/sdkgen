
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

  File({ name: 'pyproject.toml' }, () => {
    Content(`[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.backends._legacy:_Backend"

[project]
name = "${model.name}-sdk"
version = "0.0.1"
description = "${model.const.Name} SDK for Python"
license = "MIT"
requires-python = ">=3.8"
dependencies = [
    "requests>=2.33",
`)

    // Collect dependencies from features
    each(feature, (f: any) => {
      const pyDeps = f.deps?.py
      if (pyDeps) {
        each(pyDeps, (dep: any) => {
          if (dep.active) {
            Content(`    "${dep.key$}>=${dep.version}",
`)
          }
        })
      }
    })

    // Add target-level deps
    const targetDeps = target.deps
    if (targetDeps) {
      each(targetDeps, (dep: any) => {
        if (dep.active !== false) {
          Content(`    "${dep.key$}>=${dep.version || '0.0'}",
`)
        }
      })
    }

    Content(`]

[project.urls]
Homepage = "https://github.com/voxgig/${model.name}-sdk"
`)
  })
})


export {
  Package
}
