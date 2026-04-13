
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

  // Generate Gemfile
  File({ name: 'Gemfile' }, () => {
    Content(`source "https://rubygems.org"

gemspec

`)

    // Collect dependencies from features
    each(feature, (f: any) => {
      const rbDeps = f.deps?.rb
      if (rbDeps) {
        each(rbDeps, (dep: any) => {
          if (dep.active) {
            Content(`gem "${dep.key$}", "~> ${dep.version}"
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
          Content(`gem "${dep.key$}", "~> ${dep.version || '0.0'}"
`)
        }
      })
    }
  })

  // Generate gemspec
  File({ name: model.name + '_sdk.gemspec' }, () => {
    Content(`Gem::Specification.new do |spec|
  spec.name          = "${model.name}-sdk"
  spec.version       = "0.0.1"
  spec.authors       = ["Voxgig"]
  spec.summary       = "${model.const.Name} SDK for Ruby"
  spec.license       = "MIT"
  spec.homepage      = "https://github.com/voxgig/${model.name}-sdk"

  spec.files         = Dir["lib/**/*.rb", "*.rb"]
  spec.require_paths = ["."]

  spec.required_ruby_version = ">= 3.0"

  spec.add_dependency "json"
`)

    // Collect dependencies from features
    each(feature, (f: any) => {
      const rbDeps = f.deps?.rb
      if (rbDeps) {
        each(rbDeps, (dep: any) => {
          if (dep.active) {
            Content(`  spec.add_dependency "${dep.key$}", "~> ${dep.version}"
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
          Content(`  spec.add_dependency "${dep.key$}", "~> ${dep.version || '0.0'}"
`)
        }
      })
    }

    Content(`
  spec.add_development_dependency "minitest", "~> 5.0"
  spec.add_development_dependency "rake", "~> 13.0"
end
`)
  })
})


export {
  Package
}
