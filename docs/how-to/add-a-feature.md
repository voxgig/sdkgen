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

Built-in features: `log`, `test`. Several at once:

```bash
voxgig-sdkgen feature add log,test
```

Then regenerate:

```bash
npm run build && npm run generate
```

> `test` is added automatically by `target add` — every target's
> generated test suite depends on it.

## Author a new feature

A feature is defined by a model file plus per-language template code.

### 1. Define the model

Create `project/.sdk/model/feature/retry.jsonic` (in this repo) or
`.sdk/model/feature/retry.jsonic` (in a project):

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

`feature add` appends the include to `feature-index.jsonic` automatically.
If you created the model by hand, add the line yourself:

```jsonic
# Features
@"test.jsonic"
@"log.jsonic"
@"retry.jsonic"
```

### 3. Provide the per-language implementation

Each target copies feature source from
`tm/<lang>/src/feature/<name>/`. Create the implementation for every
target you support, modelled on the built-ins:

```
project/.sdk/tm/ts/src/feature/retry/RetryFeature.ts
project/.sdk/tm/go/src/feature/retry/retry_feature.go
# …one per target
```

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

`feature add` copies the feature model and, for every active target, the
`tm/<target>/src/feature/<name>/` source into the project. The generator
then wires it into the per-stage dispatch via the `FeatureHook`
component. At construction time, callers can also pass extra features
through the `extend` option.

## See also

- [Operation pipeline and feature hooks](../reference/hooks.md)
- [The operation pipeline (concepts)](../explanation/operation-pipeline.md)
- [Customize templates and propagate the change](./customize-and-propagate-templates.md)
