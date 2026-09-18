import { cmp, Content, File } from 'jostraca'


const Changelog = cmp(function Changelog(props: any) {
  const { ctx$ } = props
  const { model } = ctx$

  const name = model.Name || model.name

  File({ name: 'CHANGELOG.md', exclude: true }, () => {
    Content(`# Changelog

All notable changes to the generated ${name} SDK are documented here.
This project follows [Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [Unreleased]

## [0.0.1]

- Initial generated release of the ${name} SDK (TypeScript, Python, PHP, Go,
  Ruby, and Lua, plus CLI and MCP surfaces), generated from the upstream
  OpenAPI specification by @voxgig/sdkgen.
`)
  })
})


export {
  Changelog
}
