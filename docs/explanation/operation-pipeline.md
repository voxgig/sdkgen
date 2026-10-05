# The operation pipeline and the feature model

This page explains what a *generated* SDK does at runtime — the model
every target implements — and how features extend it. It is the concept
behind the `tm/<lang>/src/` runtime and the README "Explanation"
section. For the exact hook list, see the [hooks reference](../reference/hooks.md).

## Every operation is a pipeline

Each entity operation (`load`, `list`, `create`, `update`, `patch`, `remove`)
runs the same staged pipeline. Each stage fires a **feature hook** before
it executes, so behaviour can be observed or altered without forking the
SDK:

```
PrePoint → PreSpec → PreRequest → PreResponse → PreResult → PreDone
```

| Stage | Responsibility |
| --- | --- |
| **PrePoint** | Resolve which API endpoint (the "point") the operation maps to. |
| **PreSpec** | Build the HTTP spec: URL, method, headers, query, body. |
| **PreRequest** | Send the HTTP request. A feature can intercept here to replace the transport (this is how test mode injects a mock). |
| **PreResponse** | Parse the raw HTTP response. |
| **PreResult** | Extract the business data from the parsed response. |
| **PreDone** | Final stage before returning; entity state (match, data) is updated here. |

If a stage returns an error the pipeline short-circuits and the error is
returned to the caller (the exact shape is language-idiomatic — a tuple
in Python, a second return value in Go/Ruby/Lua, an exception elsewhere).
An unexpected exception/panic fires **`PreUnexpected`**.

## Beyond the pipeline: lifecycle and state hooks

Features can also hook points that are not part of a single request:

- **`PostConstruct`** — after the SDK client is constructed.
- **`PostConstructEntity`** — after an entity instance is constructed.
- **`SetData` / `GetData`** — when entity data is written/read.
- **`SetMatch` / `GetMatch`** — when entity match criteria are written/read.

The authoritative list is the base feature class shipped in each target
(`tm/<lang>/src/feature/base/...`). The TypeScript reference is
`BaseFeature.ts`.

## What a feature is

A feature is a small unit that implements one or more hooks. In each
language it takes the idiomatic shape:

- **TypeScript/JavaScript** — an object with a `hooks` map (or a class
  implementing the hook methods).
- **Python / PHP / Ruby** — a class with methods named after the stages.
- **Go** — a type implementing the `Feature` interface.
- **Lua** — a table with hook functions.

Features are initialised in order, and hooks fire in that order, so a
later feature can override an earlier one. Built-in features are declared
in the model under `main.kit.feature` and shipped as templates; callers
add their own via the `extend` option at construction time.

### The two built-in features

| Feature | Purpose | Active by default |
| --- | --- | --- |
| **`log`** | Structured request/response logging | options active |
| **`test`** | In-memory mock transport so unit tests run offline | options inactive (opt-in) |

`test` is special: every generated target depends on it (the generated
test suite calls `SDK.test()`), so `target add` always ensures the
`test` feature is present even if the model does not list it.

## How hooks are declared in the model

A feature's model entry enables specific hooks:

```jsonic
main: kit: feature: log: {
  active: true
  hook: {
    PreRequest:  active: true
    PreResponse: active: true
    # ...
  }
}
```

Only hooks marked `active: true` fire. The generator's `FeatureHook`
component renders the per-stage dispatch and is careful to skip a feature
that does not declare the stage rather than crashing — see the
[hooks reference](../reference/hooks.md) and the `FeatureHook` entry in
the [API reference](../reference/api.md#featurehook).

## Direct and prepare: escaping the entity model

For endpoints the entity model does not cover, every SDK exposes two
low-level methods:

- **`direct(fetchargs)`** — build and send an HTTP request in one step.
- **`prepare(fetchargs)`** — build the request *without* sending it
  (useful for debugging or a custom transport).

Both accept a map with `path`, `method`, `params`, `query`, `headers`,
and `body`.

## See also

- [Operation pipeline and feature hooks — reference](../reference/hooks.md)
- [Add a feature](../how-to/add-a-feature.md)
- [Components vs templates](./components-and-templates.md)
