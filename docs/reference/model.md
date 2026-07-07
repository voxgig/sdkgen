# Reference: the model schema (`.aontu`)

The **model** is the single structured object that drives generation. It
is assembled by `aontu` from several `.aontu` fragments and constrained
by the base schema in [`model/sdkgen.aontu`](../../model/sdkgen.aontu).

A model is the unification of:

1. **API model** — entities, operations, points, fields, flows, and API
   `info`, produced by `@voxgig/apidef` from the OpenAPI spec.
2. **Base schema** — `model/sdkgen.aontu` (this repo): defaults and
   constraints for targets, entities, features, options.
3. **Target / feature / option definitions** — added into the project's
   `.sdk/model/` by `target add` / `feature add`.

## `.aontu` / aontu syntax primer

`.aontu` is a relaxed JSON; `aontu` adds unification semantics:

| Syntax | Meaning |
| --- | --- |
| `a: b: c: 1` | Nested object shorthand for `a:{b:{c:1}}`. |
| `&: { ... }` | Schema applied to **every** child of a map (one rule, many entries). |
| `*default \| type` | A default value, unified against a type (e.g. `*true \| boolean`). |
| `name: key()` | Bind the field to the map key (so `feature: log: {}` gets `name: 'log'`). |
| `'$$name$$'` | Interpolate the model `name` into a string. |
| `@"file.aontu"` | Include another fragment (how index files work). |
| `x: .y` | Reference another path's value (e.g. `deps: ts: .js`). |

## Top level

| Path | Type | Description |
| --- | --- | --- |
| `name` | string | The SDK name. Drives `Name`/`NAME`/`ProjectName`/`$$name$$`. |
| `main.def.desc` | string | One-line description of the API. |
| `main.kit.info` | object | API metadata (see below). |
| `main.kit.config` | object | Build/runtime config (see below). |
| `main.kit.target.<name>` | object | A language target. |
| `main.kit.entity.<name>` | object | An API entity. |
| `main.kit.feature.<name>` | object | A feature. |
| `main.kit.option.<name>` | object | A named option. |

> `kit` is the value of the `KIT` constant (`'kit'`), exported by
> `@voxgig/apidef`. Code should index with `KIT`, e.g.
> `getModelPath(model, \`main.${KIT}.entity\`)`.

## `main.kit.target.<name>`

From [`model/sdkgen.aontu`](../../model/sdkgen.aontu) and the per-target
files in `ts/project/.sdk/model/target/`:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | string | `key()` | Target name (e.g. `ts`). |
| `active` | boolean | `true` | Whether the target is generated. |
| `title` | string | — | Display name (e.g. `TypeScript`). |
| `ext` | string | — | Source file extension. |
| `comment.line` | string | — | Line-comment token (e.g. `//`). |
| `module.name` | string | `'$$name$$'` | Package/module name. |
| `base` | string | — | Template base path (set to `'BASE'`, replaced at `target add`). |
| `srcfeature` | boolean | `true` | Whether per-feature source is copied into `src/feature/`. |
| `deps.<dep>.active` | boolean | `false` | Include this dependency. |
| `deps.<dep>.version` | string | `'*'` | Version constraint. |
| `deps.<dep>.kind` | string | `'prod'` | `prod` / `dev` / `peer` (target-defined). |

Example (`ts/project/.sdk/model/target/ts.aontu`):

```jsonic
main: kit: target: ts: {
  title: TypeScript
  ext: ts
  comment: line: "//"
  module: name: '$$name$$'
  deps: {
    'typescript': { active: true, version: '^5.9.3', kind: dev }
    '@types/node': { active: true, version: '^25.6.0', kind: dev }
  }
}
```

Targets may also declare a `phase` map to switch standard generation
phases on/off (`phase.<name>.active`, default true). The `go-cli` and
`go-mcp` targets use this to run only `Main` rather than the per-entity /
readme / test phases.

## `main.kit.entity.<name>`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | string | `key()` | Entity name. |
| `active` | boolean | `true` | Whether the entity is generated. |
| `alias` | object | `{}` | Field/path aliases. |

Entities are largely populated by `@voxgig/apidef`: each carries its
operations (`op`), endpoint points, `relations` (ancestors), fields, and
the `Name` case variants. The SDK generates one entity class per active
entity, with `load` / `list` / `create` / `update` / `remove` where the
API supports them.

## `main.kit.feature.<name>`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | string | `key()` | Feature name. |
| `active` | boolean | `false` | Whether the feature ships enabled. |
| `title` | string | — | Human description. |
| `version` | string | `'0.0.1'` | Feature version. |
| `config` | object | — | Feature config (e.g. `options.active`). |
| `hook.<Hook>.active` | boolean | `false` | Enable a pipeline/lifecycle hook. |
| `hook.<Hook>.await` | boolean | `false` | Whether the hook is awaited. |
| `deps.<lang>.<dep>` | object | — | Per-language runtime deps (`active`, `version`, `kind`). |
| `target.<lang>.deps.<dep>` | object | — | Target-scoped dep overrides. |

The available hook names are listed in the [hooks reference](./hooks.md).
Example (`ts/project/.sdk/model/feature/log.aontu`):

```jsonic
main: kit: feature: log: {
  title: "Structured request and response logging"
  active: true
  config: options: active: true
  hook: {
    PreRequest:  active: true
    PreResponse: active: true
    # ...
  }
  deps: js: {
    'pino':        { active: true, version: '>=10', kind: peer }
    'pino-pretty': { active: true, version: '>=13', kind: peer }
  }
  deps: ts: .js     # ts reuses the js deps
}
```

## `main.kit.option.<name>`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | string | `key()` | Option name. |
| `active` | boolean | `true` | Whether the option is present. |

## `main.kit.info` (from apidef)

Fields the README components read (all optional): `title`, `tagline`,
`about_md`, `license_md`, `license_short`, `homepage`, `docs_url`,
`entity_desc` (a map of `entity → description`), and `auth` (set to
`false` to mark the API as needing no authentication).

## `main.kit.config` (from apidef)

Build/runtime configuration. The generator reads `config.auth.active`
(set `false` to disable auth code), among others. See
[`isAuthActive`](./api.md#isauthactivemodel--boolean).

## Index files

`feature-index.aontu` and `target-index.aontu` are plain include lists.
`feature add` / `target add` append `@"<name>.aontu"` lines (idempotently
— a name already present is not added again):

```jsonic
# Features
@"test.aontu"
@"log.aontu"
```

## See also

- [Operation pipeline and feature hooks](./hooks.md)
- [Project layout](./project-layout.md)
- [Add a feature](../how-to/add-a-feature.md)
