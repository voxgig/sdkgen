# How to add a feature

Features extend the operation pipeline (logging, auth, retries, test
transport) without forking the generated SDK. This guide adds an existing
feature, then shows how to author a new one.

## Add a built-in feature

From the project's `.sdk/` directory:

```bash
voxgig-sdkgen feature add log
# or:
npm run add-feature log
```

Built-in features:

- **Core:** `log`, `test`.
- **Enterprise (ts):** `retry`, `timeout`, `ratelimit`, `cache`,
  `idempotency`, `paging`, `streaming`, `proxy`, `telemetry`, `metrics`,
  `debug`, `audit`, `clienttrack`, `rbac`.
- **Test support:** `netsim` (network-condition simulation — see
  [Simulate network conditions](./simulate-network.md)).

All features are **inactive by default**; enable one per SDK with
`options.feature.<name>.active = true` (and its tuning options). Several at
once:

```bash
voxgig-sdkgen feature add retry,timeout,cache
```

Then regenerate:

```bash
npm run build && npm run generate
```

> `test` is added automatically by `target add` — every target's
> generated test suite depends on it.

## Use a feature from another package

A feature reference takes the same forms as a target reference — a bare
name, a package-relative path, or an absolute path. The **last** path
element is the feature name; the rest locates its `.sdk`:

```bash
voxgig-sdkgen feature add @acme/sdkgen-iot/circuitbreaker
voxgig-sdkgen feature add ../my-features/circuitbreaker
```

Or, if the package declares a
[manifest](../reference/project-layout.md#an-sdkgen-package):

```bash
voxgig-sdkgen package add @acme/sdkgen-iot
```

**Aliasing is refused for features**, unlike targets: a feature's name is
part of the generated `options.feature.<name>` config key and of the hook
wiring in every target, so it cannot be renamed at install time.

An external feature may ship its own per-target source as an *overlay* —
`tm/<target>/…` inside the feature's package, for targets it supports but
does not provide. That overlay wins over the target's own copy of the same
feature, and `doctor` reports a conflict if both exist, because the files
already copied from the target's tree are not removed.

Ordering matters if you are installing both: add **targets first**. A
feature's source is copied into the targets present at the time, so a
feature added before a target ships no source for it. `package add` does
this for you.

## Author a new feature

A feature is defined by a model file plus per-language template code.

### 1. Define the model

Create `ts/project/.sdk/model/feature/retry.aontu` (in this repo) or
`.sdk/model/feature/retry.aontu` (in a project):

```jsonic
main: kit: feature: retry: {
  title: "Retry failed requests with backoff"
  active: true
  version: '0.0.1'

  config: options: active: true

  hook: {
    PreRequest:  { active: true }
    PreResponse: { active: true }
  }

  # optional per-language runtime dependencies
  deps: ts: {
    # 'p-retry': { active: true, version: '^6', kind: prod }
  }
}
```

Choose hooks from the [hooks reference](../reference/hooks.md). Only hooks
marked `active: true` fire.

### 2. Register it

`feature add` appends the include to `feature-index.aontu` automatically.
If you created the model by hand, add the line yourself:

```jsonic
# Features
@"test.aontu"
@"log.aontu"
@"retry.aontu"
```

### 3. Provide the per-language implementation

Feature source lives wherever that language expects it. Put the
implementation where the built-in features already are, and the
generator finds it — it discovers feature source by walking the target's
template tree for directories named `feature`, rather than assuming one
layout:

```
ts/project/.sdk/tm/ts/src/feature/retry/RetryFeature.ts
ts/project/.sdk/tm/go/feature/retry_feature.go
ts/project/.sdk/tm/py/pkg/feature/retry_feature.py
ts/project/.sdk/tm/dart/lib/feature/retry/RetryFeature.dart
ts/project/.sdk/tm/swift/Sources/ProjectNameSDK/feature/RetryFeature.swift
# …one per target
```

The file name maps back to the feature: `<name>`, `<name>_feature.<ext>`,
`<Name>Feature.<ext>`, or a directory named `<name>`. Anything else in
those directories (`feature_options.go`, `mod.rs`, `support.rs`,
`__init__.py`) is shared machinery and is never treated as a feature.

Implement the hooks you enabled. The template placeholders
`FEATURE_Name` and `FEATURE_VERSION` are substituted at `feature add`.
Use the `log` feature's files as the closest reference.

### 4. Add and generate

```bash
cd <project>/.sdk
voxgig-sdkgen feature add retry
npm run build && npm run generate
```

## How a feature reaches the runtime

`feature add` copies the feature model and, for every active target, that
feature's source into the project. The generator then wires it into the
per-stage dispatch via the `FeatureHook` component. At construction time,
callers can also pass extra features through the `extend` option.

Only features the model declares **and activates** get source. `target
add` copies the rest of the template tree without them, so a project
carries exactly the features it asked for — see
[Trimming the feature set](#trimming-the-feature-set).

## Trimming the feature set

`target add` copies a target's template tree minus the source of every
shipped feature the model did not select. Two things follow from that:

- **A template that statically references every feature stops
  compiling.** Each target declares those in its own model as
  `feature: { fullset: [...] }` — in practice the cross-feature test
  suite, which constructs every shipped feature type by name. They are
  dropped along with the features they exercise, and kept when a project
  selects the full set.
- **Aggregate indexes must be generated, not templated.** `rust`'s
  `feature/mod.rs` names every module in the crate, so it is emitted by
  `Main_rust` from the model rather than shipped as a template.

- **The shared test harness must survive the drop.** go and csharp keep
  it in `feature_harness_test.go` / `FeatureHarness.cs`, because
  `pipeline_test.*` uses the same helpers — leaving them inside the
  cross-feature suite took the whole test package down with it.

A target whose templates are not ready for any of that says
`feature: { trim: false }` and keeps the complete feature set. Currently:
`clojure`, `haskell`, `lean` and `ocaml` (every feature lives in one
module, so there is no per-feature file to leave out), `scala` (the
cross-feature tests share the single test entry point) and `zig`
(`root.zig` imports every feature module, and `build.zig` names the
feature test explicitly).

## See also

- [Operation pipeline and feature hooks](../reference/hooks.md)
- [The operation pipeline (concepts)](../explanation/operation-pipeline.md)
- [Customize templates and propagate the change](./customize-and-propagate-templates.md)
