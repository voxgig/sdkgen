
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

  File({ name: model.name + '.rockspec' }, () => {
    Content(`package = "${model.name}-sdk"
version = "0.0-1"
source = {
  url = "git://github.com/voxgig/${model.name}-sdk.git"
}
description = {
  summary = "${model.const.Name} SDK for Lua",
  license = "MIT"
}
dependencies = {
  "lua >= 5.3",
  "dkjson >= 2.5",
`)

    // Collect dependencies from features
    each(feature, (f: any) => {
      const luaDeps = f.deps?.lua
      if (luaDeps) {
        each(luaDeps, (dep: any) => {
          if (dep.active) {
            Content(`  "${dep.key$} >= ${dep.version}",
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
          Content(`  "${dep.key$} >= ${dep.version || '0.0'}",
`)
        }
      })
    }

    Content(`}
build = {
  type = "builtin",
  modules = {
    ["${model.name}_sdk"] = "${model.name}_sdk.lua",
    ["config"] = "config.lua",
    ["features"] = "features.lua",
  }
}
`)
  })
})


export {
  Package
}
