import { cmp, Content, File } from 'jostraca'


// Root CHANGELOG.md seed. Generated as an initial "Keep a Changelog" skeleton;
// the version reflects the lockstep SDK version at generation time. (Publish
// history is carried by the git release tags <target>/vX.Y.Z.)
//
// WRITE-ONCE. A changelog is written by people: the skeleton is a starting
// point, and every entry added after it is content this component cannot
// reconstruct. Emitted unconditionally, it rewrote the seed over the real
// file on every `npm run generate`, silently deleting released entries —
// observed on univec-sdk, where a full model build dropped a committed
// `## [release/v0.1.2]` section.
//
// `exclude: true` returns early when the file already exists (FileOp), the
// same semantics `sdk-test-control.json` uses for the same reason: a
// generated file a project is meant to edit must survive regeneration.
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
