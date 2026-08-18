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
| `main.kit.repo` | object | Where the SDK's source repository lives (see below). |
| `main.kit.author` | object | Manifest `author` (see below). |
| `main.kit.contributor.<key>` | object | Manifest `contributors` entries (see below). |
| `main.kit.test` | object | How the generated test suites behave (see below). |
| `main.kit.target.<name>` | object | A language target. |
| `main.kit.entity.<name>` | object | An API entity. |
| `main.kit.feature.<name>` | object | A feature. |
| `main.kit.option.<name>` | object | A named option. |

> `kit` is the value of the `KIT` constant (`'kit'`), exported by
> `@voxgig/apidef`. Code should index with `KIT`, e.g.
> `getModelPath(model, \`main.${KIT}.entity\`)`.

## What a project declares about ITSELF

`target add` overwrites `.sdk/src/cmp/**`, `.sdk/tm/**` and
`.sdk/model/target/<t>.aontu`, and `generate` overwrites the SDK source.
So anything a project wants to say about itself has to be said in the
project's OWN model (`.sdk/model/sdk.aontu`) — a hand-edit anywhere else
is reverted on the next resync, silently. These are the keys that exist
for that purpose:

| Path | Why it exists |
| --- | --- |
| `main.kit.repo.path` / `.host` | Repo identity. The repo is NOT always `<origin>/<name>-sdk`; deriving it from the slug produced a go module path that 404s and homepage/bugs URLs for a repo that does not exist. |
| `main.kit.author` / `main.kit.contributor.<key>` | Manifest attribution. Hand-edited credit in a `package.json` is DELETED by the next regeneration — which is what happened to a hand-written provider repo the first time it was regenerated. |
| `main.kit.target.<t>.author` | Attribution for ONE target, overriding the model-wide value. A generated SDK is an artefact of the publisher; a Seneca provider is independently released by named people. One model produces both. |
| `main.kit.test.live.strict` | Whether a live test run asserts or merely observes. |
| `main.kit.target.<t>.module.path` / `.package` / `.goversion` | Go-family module identity and the `go` directive. |
| `main.kit.target.<t>.output.path` / `.repo` | Generate this target into ANOTHER repo (see [below](#generating-outside-the-sdk-repo-output)). |
| `main.kit.target.<t>.publish.version` | The port's own release version. Every manifest emitter used to hardcode `0.0.1`, so a project that had published `0.0.2` got its manifest reset on the next run. |
| `main.kit.target.<t>.publish.registry.package` | The published package name, when it is not the derived one. |
| `main.kit.feature.<name>.active` | Which features ship. |

A project extends a target's CODE the same way — by registering a
component (`registerComponent('X')` → `.sdk/src/cmp/<t>/X_<t>.ts`), which
`doctor` reports as additive rather than drift. Forking a shipped
component or a target model file is never the answer; `doctor` reports
both, because `target add` will revert both.

## `main.kit.repo`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `path` | string | `''` | `'<org>/<repo>'` under `host`. `''` derives `<origin>/<name>-sdk`. |
| `host` | string | `'github.com'` | Repo host. |

## `main.kit.author` / `main.kit.contributor`

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `author.name` | string | `''` | `''` means the publisher (Voxgig), which is what a generated SDK carries. |
| `author.url` | string | `''` | |
| `contributor.<key>.name` | string | — | |
| `contributor.<key>.url` | string | `''` | |

`contributor` is a MAP, not a list, because aontu unifies maps by key: a
project can add one contributor without restating the others, and a
duplicate key is a conflict rather than a silent second entry. Emitters
render it in sorted-key order, so the manifest stays byte-stable.

```jsonic
main: kit: author: { name: 'Ada Lovelace', url: 'https://example.com' }
main: kit: contributor: 'ada': { name: 'Ada Lovelace', url: 'https://example.com' }
```

## `main.kit.test`

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `test.live.strict` | boolean | `false` | `false`: a non-2xx in a live run is an early return, not a failure (right for an SDK generated against an arbitrary third-party API). `true`: live assertions match the offline ones. Set it when the project OWNS the server it tests against — otherwise the live suite passes with nothing listening on the port. Overridable per target (`main.kit.target.<t>.test.live.strict`). |

## Provenance: where a copied item came from

Every copied `model/<kind>/<name>.aontu` records its own origin. There is
no lockfile and no second record — the model **is** the record, which is
why nothing can disagree with it.

```
main: kit: target: iot-go: {
  …
  base: 'node_modules/@acme/sdkgen-iot/.sdk'
  origname: 'iotgo'            # only when installed under a different name
  package: '@acme/sdkgen-iot'  # only when the source declares a manifest
}
```

The shipped files carry `base: 'BASE'` as an **anchor**: a replace map can
only rewrite text that is already there, so a definition without the
anchor records nothing, silently. A guard test fails if any shipped model
loses it.

These are written by `add` and read by `doctor`, `package list` and
`package update`. Do not hand-edit them: `add` rewrites the block, and
`doctor` reports a changed value as a fork (accurately — the next add
reverts it).

The one exception is an **aliased** item (`target add go~go2`), whose
model file `add` CREATES and then never overwrites — differentiating it
is the point of an alias. Editing that file is expected; editing its
provenance block is still not, because `package update` and `doctor`
locate the source through it.

The same three keys exist on `main.kit.feature.<name>`.

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
| `module.path` | string | `''` | Go family. Full module path, overriding `'<repo.host>/<repo.path>/<target>'`. |
| `module.package` | string | `''` | Go family. The root package IDENTIFIER (`package acmesdk`), not an import path. |
| `module.goversion` | string | `''` | Go family. The `go` directive in `go.mod`. `''` defaults to 1.21 — the release that introduced `log/slog`, which the `log` feature imports. |
| `base` | string | — | **Provenance.** The `.sdk` folder this copy came from, always `/`-normalised. Project-relative when the source is inside the project (`node_modules/@acme/sdkgen-iot/.sdk`); a source outside it records what the ref resolved to — `../acme-sdkgen-iot/.sdk` for a relative ref, an absolute path for an absolute one, which is then specific to the machine that ran the add. Ships as the literal `'BASE'`; `add` replaces that one line with the block above. |
| `origname` | string | `''` | **Provenance.** The name in the SOURCE, when it differs — i.e. this was installed as `<origname>~<name>`. What makes an alias checkable. |
| `package` | string | `''` | **Provenance.** The sdkgen package that supplied it, when the source declares a manifest. What `package update` and `package list` act on. |
| `srcfeature` | boolean | `true` | Whether per-feature source is copied into `src/feature/`. |
| `phase.<name>.active` | boolean | `true` | Switch a standard generation phase off (see below). |
| `feature.trim` | boolean | `true` | Whether `target add` trims feature source to the model's selection. `false` keeps the complete set (see below). |
| `feature.fullset` | string[] | `[]` | Templates that only compile with the COMPLETE feature set (the cross-feature test suite), as paths under the target template root. Dropped whenever the set is trimmed. |
| `output.path` | string | `''` | Generate this target into ANOTHER repo (see below). `''` is the ordinary `<sdk-repo>/<target>/`. |
| `output.repo` | string | `''` | `'<org>/<repo>'` for that other repo, so its manifest's homepage/repository/bugs point there and not at the SDK's own repo. |
| `output.adopt` | boolean | `false` | Allow a destination that already holds content this generator did not write. Generation refuses one otherwise — it overwrites, and the path is taken verbatim from the model. |
| `output.sdkrel` | string | `''` | The path from the destination BACK to the SDK project, which the target's docs, scripts and live tests name. `''` derives it by inverting `path`; declare it when the destination is more than one level away. |
| `publish.version` | string | `'0.0.1'` | The port's own release version — what the generated manifest declares and what its Makefile tags. Per TARGET: ports publish to different registries on different clocks. |
| `publish.tag.active` | boolean | `true` | Emit a git release tag `<prefix>/vX.Y.Z`. |
| `publish.tag.prefix` | string | `''` | `''` uses the target name. |
| `publish.registry.state` | string | `'pending'` | `pending` (declared + git-tag-published, not yet uploaded) / `active` / `inactive`. Omit `registry` entirely for tag-only ports (the go family). |
| `publish.registry.name` / `.url` | string | `''` | Registry identity (`npm`, `pypi`, …). |
| `publish.registry.package` | string | `''` | Published package name. `''` derives one. |
| `deps.<dep>.active` | boolean | `false` | Include this dependency. |
| `deps.<dep>.version` | string | `'*'` | Version constraint. |
| `deps.<dep>.kind` | string | `'prod'` | Manifest section(s). Target-defined, and a COMMA-SEPARATED LIST where a package belongs in two (`'peer,dev'`) — the map is keyed by package name, so it cannot be declared twice. |

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

### `phase` — switching generation phases off

A target declares `phase.<name>.active: false` to skip a standard
generation phase; the phases are `entity`, `feature`, `readme`,
`agentguide` and `test`, and all default to on. The CONSUMER targets
(`go-cli`, `go-mcp`, `py-data`, `seneca-provider`) switch every one of
them off and emit their whole package from `Main`: they wrap another
target's SDK rather than being one, so the standard components — which
assume an SDK-shaped package — would emit the wrong content.

### Generating outside the SDK repo (`output`)

By default a target's files are written to `<sdk-repo>/<target>/`, a
folder inside the SDK repo, which is what every language target wants.

A target that produces a **separate, independently released package**
needs somewhere else. `seneca-provider` is the case: it is its own npm
package in its own repo (`@seneca/<name>-provider`), depends on the `ts`
SDK as an ordinary published dependency, and carries a repo's worth of
furniture — LICENSE, CI workflow, `doc/` — that must not land inside the
SDK repo. Point it at that repo from the project's own model:

```jsonic
main: kit: target: 'seneca-provider': output: {
  path: '../../seneca/seneca-acme-provider'
  repo: 'senecajs/seneca-acme-provider'
}
```

- `path` resolves against the **SDK repo root**, so a sibling checkout is
  `'../<repo>'`. An absolute path is taken as given.
- Files are written at the **root** of that path, not under a
  `<target>/` subfolder: the destination IS the package.
- Generation into it is a **separate pass**, so the destination receives
  only what this target emits — none of the SDK repo's own root files
  (README, AGENTS.md, the build scaffold) follow it out.
- `repo` is what the generated manifest's homepage / repository / bugs
  URLs point at. Left unset, a target may supply its own convention, and
  otherwise falls back to the SDK's own repo — which would be wrong for a
  package released from somewhere else.
- The destination is checked **before any file is written**, in-tree
  output included: it may not be inside (or contain) the SDK project, two
  targets may not claim the same folder, and a folder already holding
  content this generator did not write is refused until the project says
  `output: adopt: true`.
- `active: false` on an out-of-tree target generates it **nowhere**. It
  does not relocate the target back into `<sdk-repo>/<target>/`.

Why a separate pass rather than a folder name: jostraca deliberately
refuses a `..` segment in a `Folder` name, and the output root is the
`folder` option on the `generate()` CALL, not a node in the component
tree. See
[out-of-tree targets](../explanation/out-of-tree-targets.md) for the
mechanism and what it means for a consumer project.

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

### The `station` feature's options

Installed by the external package `@voxgig/sdkgen-station` (see
[Use voxgig/station with a generated SDK](../how-to/use-station.md)).
Its `config.options`, all overridable per project:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `active` | boolean | `false` | Off by default: a project that does nothing gets current behavior. |
| `url` | string | `''` | Explicit proxy URL (`''` = discover per station's config). |
| `fromEnv` | boolean | `true` | Let `VOXGIG_STATION_*` env vars participate in resolution. |
| `profile` | string | `''` | Pin a `station.json` profile (`''` = the station's own selection). |
| `secret` | string | `''` | Override the plugin's sekreto secret name (`''` = the descriptor default, `<envtoken(slug) lowercased>.apikey`). |
| `register` | boolean | `true` | Register the descriptor with the bound station. |
| `capture` | string | `'meta'` | Capture depth: `meta` \| `headers` \| `full`. |

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
