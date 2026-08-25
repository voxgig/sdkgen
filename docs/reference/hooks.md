# Reference: operation pipeline and feature hooks

This is the authoritative list of hooks a feature can implement. The
runtime source of truth is the base feature class shipped with each
target (TypeScript: `ts/project/.sdk/tm/ts/src/feature/base/BaseFeature.ts`).
For the concepts behind it, see
[The operation pipeline](../explanation/operation-pipeline.md), and for
what the shipped features actually do with these hooks, see
[the feature catalogue](./features.md).

> Hooks are only **one** of the two seams a feature can attach to. A
> feature that declares `transport: 'wrap'` replaces the transport in
> `init()` instead, and dispatches no hooks at all. See
> [The transport seam](#the-transport-seam) below.

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

## Which shipped feature uses which hook

The features that ship with the generator, and the hooks each one declares.
An empty row means the feature works at the transport seam instead.

| Feature | Hooks |
| --- | --- |
| `rbac` | `PrePoint` |
| `metrics` | `PrePoint`, `PreDone`, `PreUnexpected` |
| `telemetry` | `PrePoint`, `PreRequest`, `PreDone`, `PreUnexpected` |
| `idempotency` | `PreRequest` |
| `clienttrack` | `PostConstruct`, `PreRequest` |
| `paging` | `PreRequest`, `PreResult` |
| `streaming` | `PreResult` |
| `debug` | `PreRequest`, `PreResponse`, `PreDone`, `PreUnexpected` |
| `audit` | `PreDone`, `PreUnexpected` |
| `log` | every lifecycle, entity-state and pipeline hook |
| `test` | every lifecycle and pipeline hook (plus the base transport) |
| `retry`, `timeout`, `ratelimit`, `cache`, `proxy`, `netsim` | none — transport seam |

## The transport seam

A feature whose model says `transport: 'wrap'` takes over
`utility.fetcher` in `init()`, calling the previous one:

```ts
init(ctx: Context, options: FeatureOptions) {
  const inner = ctx.utility.fetcher
  ctx.utility.fetcher = async (ctx2, url, fetchdef) =>
    this._wrap(ctx2, url, fetchdef, inner)
}
```

That seam sees **every HTTP attempt**, where a hook sees one operation.
It is the right place for anything that suppresses, delays, repeats or
answers a request: a single operation call can make three HTTP attempts
and still fire exactly one `PreDone`.

| `transport` | Meaning |
| --- | --- |
| `'none'` | Uses pipeline hooks only. The default. |
| `'wrap'` | Wraps the current transport. Dispatches no hooks. |
| `'base'` | *Replaces* the transport (the `test` feature's mock). |

Because each wrapper wraps whatever is already installed, **init order is
nesting order**: the feature initialised last is outermost. Order is
deterministic (`test` first, then names sorted) and can be set explicitly
by passing `feature` as an array. See
[Ordering](./features.md#ordering-and-why-it-matters).

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

- [The feature catalogue](./features.md) — every shipped feature, its
  options and what it records.
- [The operation pipeline](../explanation/operation-pipeline.md) — concepts.
- [Add a feature](../how-to/add-a-feature.md) — apply this in practice.
- [Model schema → features](./model.md#mainkitfeaturename) — the feature fields.
