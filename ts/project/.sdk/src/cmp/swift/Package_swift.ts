
import {
  Content,
  File,
  cmp,
  collectDeps,
} from '@voxgig/sdkgen'


import type {
  Model,
} from '@voxgig/apidef'


// Emits Package.swift (the SwiftPM manifest; the Swift twin of Package_go's
// go.mod / Package_csharp's csproj). The library target compiles everything
// under Sources/ProjectNameSDK (the copied runtime + generated sources); the
// test target compiles Tests/ProjectNameSDKTests. Directory names are the
// verbatim copied paths (Copy does not rewrite path components); the target
// NAMES carry the API name. Runtime is dependency-free (Foundation + the
// vendored struct); target/feature deps, when declared, become SwiftPM deps.
const Package = cmp(async function Package(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const Name = model.const.Name

  const deps: Record<string, string> = {}
  for (const d of collectDeps(model, target.name, target.deps)) {
    deps[d.name] = d.source === 'target' ? (d.version || '0.0.0') : d.version
  }
  // Vendored, dependency-free by design; declared deps (if any) are ignored
  // here since the runtime imports only Foundation + the in-tree struct.

  File({ name: 'Package.swift' }, () => {
    Content(`// swift-tools-version:5.9
//
// ${Name} SDK - SwiftPM manifest. Zero runtime dependencies (Foundation +
// the vendored Voxgig Struct port under Sources/ProjectNameSDK/Struct).
import PackageDescription

let package = Package(
    name: "${Name}Sdk",
    products: [
        .library(name: "${Name}Sdk", targets: ["${Name}Sdk"]),
    ],
    targets: [
        .target(
            name: "${Name}Sdk",
            path: "Sources/ProjectNameSDK"),
        .testTarget(
            name: "${Name}SdkTests",
            dependencies: ["${Name}Sdk"],
            path: "Tests/ProjectNameSDKTests"),
    ]
)
`)
  })
})


export {
  Package,
}
