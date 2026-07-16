
import {
  Content,
  File,
  cmp,
} from '@voxgig/sdkgen'


import type {
  Model,
} from '@voxgig/apidef'


import { zigModuleName } from './utility_zig'


// build.zig.zon — the Zig package manifest. Zig has no central package
// registry, so there are no external registry dependencies to declare: the
// voxgig struct port is vendored in-tree (utility/voxgigstruct) and wired as a
// local module by build.zig. This generator only stamps the manifest with the
// model-derived package name (the go/rust Package generators emit go.mod /
// Cargo.toml the same way).
//
// The `.paths` allow-list mirrors the (registry-less) template: it only
// matters when packaging for a registry, which zig does not do, so it is kept
// stable. `.name` is a plain string here (matching the target's zig toolchain
// pin) rather than the newer enum-literal + fingerprint form.
const Package = cmp(async function Package(props: any) {
  const ctx$ = props.ctx$
  const model: Model = ctx$.model

  const name = zigModuleName(model)

  File({ name: 'build.zig.zon' }, () => {
    Content(`.{
    .name = "${name}",
    .version = "0.0.1",
    .dependencies = .{},
    .paths = .{
        "src",
        "test",
        "build.zig",
        "build.zig.zon",
    },
}
`)
  })
})


export {
  Package
}
