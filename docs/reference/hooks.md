# Reference: operation pipeline and feature hooks

This is the authoritative list of hooks a feature can implement. The
runtime source of truth is the base feature class shipped with each
target (TypeScript: `ts/project/.sdk/tm/ts/src/feature/base/BaseFeature.ts`).
For the concepts behind it, see
[The operation pipeline](../explanation/operation-pipeline.md).

## Hook groups

### Lifecycle

| Hook | Fires |
| --- | --- |
| `init(ctx, options)` | When the feature is initialised. |
| `PostConstruct` | After the SDK client is constructed. |
| `PostConstructEntity` | After an entity instance is constructed. |

### Entity state

| Hook | Fires |
| --- | --- |
| `SetData` | When entity data is written. |
| `GetData` | When entity data is read. |
| `SetMatch` | When entity match criteria are written. |
| `GetMatch` | When entity match criteria are read. |

### Operation pipeline (in order)

| Hook | Fires before | Notes |
| --- | --- | --- |
| `PrePoint` | Endpoint resolution | Choose which API point the operation maps to. |
| `PreSpec` | Building the HTTP spec | URL, method, headers, query, body. |
| `PreRequest` | Sending the request | Intercept to replace the transport (test mode mocks here). |
| `PreResponse` | Parsing the response | |
| `PreResult` | Extracting result data | |
| `PreDone` | Returning to the caller | Entity state is updated here. |
| `PreUnexpected` | (on unexpected error) | Fired when an exception/panic escapes the pipeline. |

```
PrePoint → PreSpec → PreRequest → PreResponse → PreResult → PreDone
                                                              │
                                            (exception) → PreUnexpected
```

## Enabling a hook

A hook only fires if the feature's model entry marks it active:

```jsonic
main: kit: feature: myfeature: {
  active: true
  hook: {
    PreRequest:  { active: true }
    PreResponse: { active: true, await: true }   # await async work
  }
}
```

| Field | Default | Meaning |
| --- | --- | --- |
| `hook.<Name>.active` | `false` | Whether this hook is dispatched for the feature. |
| `hook.<Name>.await` | `false` | Whether the dispatcher awaits the hook (async). |

## Dispatch

At generation time the `FeatureHook` component (see the
[API reference](./api.md#featurehook)) renders the per-stage dispatch. At
runtime the feature-hook utility calls each feature's matching method by
name, collecting any returned promises. A feature that does not implement
a stage is simply skipped.

## Idiomatic error returns

When a stage returns an error, the pipeline short-circuits. How the error
reaches the caller is language-idiomatic:

| Target | Error surface |
| --- | --- |
| Python | second element of the return tuple |
| PHP | second element of the return array |
| Ruby / Lua | second return value |
| Go | returned `error`; a panic triggers `PreUnexpected` |
| TypeScript / JavaScript | thrown exception; `PreUnexpected` before propagating |

## See also

- [The operation pipeline](../explanation/operation-pipeline.md) — concepts.
- [Add a feature](../how-to/add-a-feature.md) — apply this in practice.
- [Model schema → features](./model.md#mainkitfeaturename) — the feature fields.
