import { Content, File, each } from 'jostraca'
import { cmp } from '../helpers/component'
import { packageVersion } from '../helpers/packageMeta'
import { KIT, getModelPath } from '../types'


const Changelog = cmp(function Changelog(props: any) {
  const { ctx$ } = props
  const { model } = ctx$

  const name = model.Name || model.name

  // Written once, so the first entry is the version the targets start at; a
  // heading with no number when they start at different ones.
  const versions = new Set<string>()
  each(getModelPath(model, `main.${KIT}.target`) || {}, (t: any) => {
    if (false !== t.active) versions.add(packageVersion(model, t.name))
  })
  const first = 1 < versions.size ? 'Initial release' :
    `[${[...versions][0] || packageVersion(model, '')}]`

  File({ name: 'CHANGELOG.md', exclude: true }, () => {
    Content(`# Changelog

All notable changes to the generated ${name} SDK are documented here.
This project follows [Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [Unreleased]

## ${first}

- Initial generated release of the ${name} SDK (TypeScript, Python, PHP, Go,
  Ruby, and Lua, plus CLI and MCP surfaces), generated from the upstream
  OpenAPI specification by @voxgig/sdkgen.
`)
  })
})


export {
  Changelog
}
