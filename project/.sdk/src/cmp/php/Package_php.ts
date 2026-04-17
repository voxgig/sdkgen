
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

  // Generate composer.json
  File({ name: 'composer.json' }, () => {
    Content(`{
  "name": "voxgig/${model.name}-sdk",
  "description": "${model.const.Name} SDK for PHP",
  "type": "library",
  "license": "MIT",
  "minimum-stability": "stable",
  "require": {
    "php": ">=8.2"`)

    // Collect dependencies from features
    const deps: { name: string, version: string }[] = []
    each(feature, (f: any) => {
      const phpDeps = f.deps?.php
      if (phpDeps) {
        each(phpDeps, (dep: any) => {
          if (dep.active) {
            deps.push({ name: dep.key$, version: dep.version })
          }
        })
      }
    })

    // Add target-level deps
    const targetDeps = target.deps
    if (targetDeps) {
      each(targetDeps, (dep: any) => {
        if (dep.active !== false) {
          deps.push({ name: dep.key$, version: dep.version || '0.0' })
        }
      })
    }

    for (const dep of deps) {
      Content(`,
    "${dep.name}": "^${dep.version}"`)
    }

    Content(`
  },
  "require-dev": {
    "phpunit/phpunit": "^11.0"
  },
  "autoload": {
    "psr-4": {
      "${model.const.Name}\\\\": "src/"
    }
  },
  "autoload-dev": {
    "psr-4": {
      "${model.const.Name}\\\\Tests\\\\": "test/"
    }
  }
}
`)
  })
})


export {
  Package
}
