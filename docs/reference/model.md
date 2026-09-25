# Reference: the model schema (`.aontu`)

The **model** is the single structured object that drives generation. It
is assembled by `aontu` from several `.aontu` fragments and constrained
by the base schema in [`ts/model/sdkgen.aontu`](../../ts/model/sdkgen.aontu).

A model is the unification of:

1. **API model** — entities, operations, points, fields, flows, and API
   `info`, produced by `@voxgig/apidef` from the OpenAPI spec.
2. **Base schema** — `ts/model/sdkgen.aontu` (this repo): defaults and
   constraints for targets, entities, features, options.
3. **Target / feature / option definitions** — added into the project's
   `.sdk/model/` by `target add` / `feature add`.

## API model attributes

Entity `fields` is a map keyed by each field's `n` (name). A field has `h`
(human title), `t` (validation shape), `r` (required), and `a` (active).
Optional metadata uses `sh`, `ro`, `wo`, `de`, and `fo` for short description,
read-only, write-only, deprecated, and format.

Operation points use `a` (active), `k` (transport), `m` (method), `o` (source
path), `s` (segments), `r` (renames), `t` (transforms), `g` (arguments), and
`q` (selectors). Optional `co` identifies the source operation, `li` supplies
live-test hints, and `gq` describes GraphQL. Arguments use `a`, `k`, `n`, `r`,
and `t`; `or` preserves the original name and `ex` supplies an example.

Flow steps use `a`, `o`, `i`, `m`, `d`, `s`, and `v` for activation,
operation, inputs, match, data, mutations, and assertions. Inactive steps
are omitted from generated tests. Ancestor chains contain checked entity
addresses such as `path($.main.kit.entity.planet)`.

Components read this compact model directly. `configDefinition` projects
it into the descriptive attribute names used by runtime hooks. Live-test
schema facts come from the resolved specification supplied by Apidef;
points contain no embedded JSON contracts. Regenerate older API models
before using these templates.

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

`.aontu` is the only extension aontu reads: an include naming a file with
the older `.aon` extension is refused. A project still holding
`model/sdk.aon` is refused by the CLI with the fix (run the current
create-sdkgen over it), and an item from a package that still ships
`.aon` is installed as `.aontu`; see the
[CLI reference](./cli.md#target-references).

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
| `main.kit.repo.path` / `.host` | Repo identity. The repo is NOT always `<origin>/<name>-sdk`; deriving it from the slug produced a go module path that returns 404 and homepage/bugs URLs for a repo that does not exist. |
| `main.kit.author` / `main.kit.contributor.<key>` | Manifest attribution. Hand-edited credit in a `package.json` is DELETED by the next regeneration — which is what happened to a hand-written provider repo the first time it was regenerated. |
| `main.kit.target.<t>.author` | Attribution for ONE target, overriding the model-wide value. A generated SDK is an artefact of the publisher; a Seneca provider is independently released by named people. One model produces both. |
| `main.kit.test.live.strict` | Whether a live test run asserts or merely observes. |
| `main.kit.target.<t>.module.path` / `.package` / `.goversion` | Go-family module identity and the `go` directive. |
| `main.kit.target.<t>.output.path` / `.repo` / `.create` | Generate this target into ANOTHER repo and optionally require that repo to exist already (see [below](#generating-outside-the-sdk-repo-output)). |
| `main.kit.target.<t>.active` | Whether the target is generated. `false` keeps it in the model, where a target wrapping it can still read it. |
| `main.kit.target.<t>.output.root` / `main.kit.phase` | A repository that is one package rather than an SDK: generate that target at the project root, and none of the SDK repository's own files (see [below](#generating-at-the-project-root-outputroot)). |
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
| `test.live.strict` | boolean | `true` | Assert live request outcomes in the TS and Go direct-test generators. Independent tests continue after failures. Explicit `false` retains legacy exploratory result handling; it does not establish full API coverage. Overridable per target (`main.kit.target.<t>.test.live.strict`). Pinned by `ts/test/generate.test.ts` and `ts/test/livegenerated.test.ts`. |

## `main.kit.phase`

What the project's `Root` writes besides its targets. The standard `Root`
that create-sdkgen scaffolds reads these; a project turns them off in
`.sdk/model/project.aontu`.

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `phase.top.active` | boolean | `true` | The SDK repository's own files at the project root: the README, the agent guides, LICENSE, SECURITY.md, CHANGELOG.md, the release Makefile and the publish workflows. |
| `phase.build.active` | boolean | `true` | The per-entity test data under `.sdk/test/entity/`, which only the SDK targets' own generated tests read. |

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

From [`ts/model/sdkgen.aontu`](../../ts/model/sdkgen.aontu) and the per-target
files in `ts/project/.sdk/model/target/`:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | string | `key()` | Target name (e.g. `ts`). |
| `active` | boolean | `true` | Whether the target is generated. An inactive target stays in the model. |
| `title` | string | — | Display name (e.g. `TypeScript`). |
| `ext` | string | — | Source file extension. |
| `comment.line` | string | — | Line-comment token (e.g. `//`). |
| `module.name` | string | `'$$name$$'` | Package/module name. |
| `module.path` | string | `''` | Go family. Full module path, overriding `'<repo.host>/<repo.path>/<target>'`. |
| `module.package` | string | `''` | Go family. The root package IDENTIFIER (`package acmesdk`), not an import path. |
| `module.goversion` | string | `''` | Go family. The `go` directive in `go.mod`. `''` defaults to 1.21 — the release that introduced `log/slog`, which the `log` feature imports. |
| `base` | string | — | **Provenance.** The `.sdk` folder this copy came from, always `/`-normalised. Project-relative when the source is inside the project (`node_modules/@acme/sdkgen-iot/.sdk`); a source outside it records what the ref resolved to — `../acme-sdkgen-iot/.sdk` for a relative ref, an absolute path for an absolute one, which is then specific to the machine that ran the add. Ships as the literal `'BASE'`; `add` replaces that one line with the preceding block. |
| `origname` | string | `''` | **Provenance.** The name in the SOURCE, when it differs — i.e. this was installed as `<origname>~<name>`. What makes an alias checkable. |
| `package` | string | `''` | **Provenance.** The sdkgen package that supplied it, when the source declares a manifest. What `package update` and `package list` act on. |
| `srcfeature` | boolean | `true` | Whether per-feature source is copied into `src/feature/`. |
| `phase.<name>.active` | boolean | `true` | Switch a standard generation phase off (see below). |
| `feature.trim` | boolean | `true` | Whether `target add` trims feature source to the model's selection. `false` keeps the complete set (see below). |
| `feature.fullset` | string[] | `[]` | Templates that only compile with the COMPLETE feature set (the cross-feature test suite), as paths under the target template root. Dropped whenever the set is trimmed. |
| `output.path` | string | `''` | Generate this target into ANOTHER repo (see below). `''` is the ordinary `<sdk-repo>/<target>/`. |
| `output.root` | boolean | `false` | Generate this target at the project root instead of `<project>/<target>/` (see [below](#generating-at-the-project-root-outputroot)). |
| `output.repo` | string | `''` | `'<org>/<repo>'` for that other repo, so its manifest's homepage/repository/bugs point there and not at the SDK's own repo. |
| `output.create` | boolean | `true` | Whether sdkgen may create a missing out-of-tree destination. `false` keeps the target active but skips it until the destination folder exists. |
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
| `deps.<dep>.kind` | string | `'prod'` | Manifest sections. Target-defined, and a COMMA-SEPARATED LIST where a package belongs in two (`'peer,dev'`) — the map is keyed by package name, so it cannot be declared twice. |

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
(`go-cli`, `go-mcp`, `py-data`, and `seneca-provider` from its package)
switch every one of them off and emit their whole package from `Main`: they wrap another
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
  create: false
}
```

- `path` resolves against the **SDK repo root**, so a sibling checkout is
  `'../<repo>'`. An absolute path is taken as given.
- Files are written at the **root** of that path, not under a
  `<target>/` subfolder: the destination IS the package.
- Generation into it is a **separate pass**, so the destination receives
  only what this target emits — none of the SDK repo's own root files
  (README, the contributor guides, the build scaffold) follow it out.
- `repo` is what the generated manifest's homepage / repository / bugs
  URLs point at. Left unset, a target may supply its own convention, and
  otherwise falls back to the SDK's own repo — which would be wrong for a
  package released from somewhere else.
- `create: false` keeps the target active but skips its external pass when
  the destination folder is absent. This is useful when the separate target
  fleet is an optional set of checkouts: creating or cloning the folder later
  makes the unchanged model generate it normally. The default is `true`.
- The destination is checked **before any file is written**, in-tree
  output included: it may not be inside (or contain) the SDK project, two
  targets may not claim the same folder, and a folder already holding
  content this generator did not write is refused until the project says
  `output: adopt: true`.

#### Overriding the destination at generate time

`output: path` is committed and describes one checkout layout. To generate
the same model into a different one, override it on the run rather than
committing a second value the two layouts disagree over:

```js
// the build config, in .sdk/build/sdkgen.js
external: {
  'seneca-provider': {
    path: '../..',
    sdkrel: '.sdksrc/acme-sdk',
    enclosing: true,
  },
}
```

The same shape is read from the `SDKGEN_EXTERNAL` environment variable as
JSON, and the environment wins. Use it to drive a checkout you do not own,
where editing the build config would mean changing files inside someone
else's repo.

- `path` and `sdkrel` replace the model's values for that run only. The
  model object is never written back to, so `target add` cannot commit the
  override by accident.
- An override may also send an item out of tree that the model generates in
  tree. Every destination check listed earlier still runs on it.
- `enclosing: true` permits a destination that **contains** the SDK project
  — the layout where a repo carries a checkout of its SDK in a subfolder and
  regenerates itself from it. Only an override can set it, never the model,
  because the mistake it guards against (one `..` too many, writing a
  package over an unrelated repo) is silent. It also stands in for `adopt`:
  a folder containing the project always holds content, so the emptiness
  check has nothing to say.

See [Out-of-tree targets](../explanation/out-of-tree-targets.md#one-model-two-layouts)
for why this is a run-time decision rather than a model one.
- `active: false` on an out-of-tree target generates it **nowhere**. It
  does not relocate the target back into `<sdk-repo>/<target>/`.

Why a separate pass rather than a folder name: jostraca deliberately
refuses a `..` segment in a `Folder` name, and the output root is the
`folder` option on the `generate()` CALL, not a node in the component
tree. See
[out-of-tree targets](../explanation/out-of-tree-targets.md) for the
mechanism and what it means for a consumer project.

### Generating at the project root (`output.root`)

A target normally goes into `<project>/<target>/`. With `output: root: true`
it is written at the project root instead, so the repository holding `.sdk/`
is that target's package. This is the layout of a repository that carries
its own builder: a Seneca provider generated in its own repository, depending
on an SDK released from another one.

```jsonic
# .sdk/model/project.aontu
main: kit: phase: top: active: false
main: kit: phase: build: active: false
main: kit: doc: active: false
main: kit: target: 'seneca-provider': output: root: true
```

- `phase: top: active: false` is required. Otherwise the SDK repository's
  own files (README, LICENSE, the release Makefile) would overwrite the
  target's, so the standard `Root` refuses to generate.
- One target at most may declare it.
- It applies in-tree only. A target that also declares `output: path` is
  refused, because `path` sends it into another repository and `root` keeps
  it in this one.
- `phase: build` and `doc` are off because nothing in such a repository
  reads them. The entity test data serves the SDK targets' own tests, and the
  documentation site describes an SDK.

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

An entity name is also an identifier stem: the class name, the SDK method
that returns it, the generated type names and the per-language module names
all come from it.
No target language accepts an identifier that starts with a digit, so a name
that does is prefixed with an `n` before anything reads it — the entity
`3ds_session` from `/3ds-sessions` becomes `n3ds_session`, and its class
`N3dsSessionEntity`. The key, the flow that names the entity and any ancestor
reference move with it. The request path does not: it comes from the point,
so the SDK still calls `/3ds-sessions`. apidef applies the same rule when it
derives the name, so this changes nothing for a model apidef produced.

## `main.kit.feature.<name>`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | string | `key()` | Feature name. |
| `active` | boolean | `false` | Whether the feature ships enabled. |
| `title` | string | — | Human description. |
| `version` | string | `'0.0.1'` | Feature version. |
| `config.options` | object | — | Option DEFAULTS, one key per option. Also the README's option table, and — read by example — each option's type in the generated option spec. |
| `config.optspec` | object | `{}` | Types for options a default cannot describe: callbacks and injected values with no default, or an option whose default understates its type (netsim's `latency: 0`, which is also a `{ min, max }` map). Values are `struct.validate` sentinels. A name in both takes its type from here and its default from `config.options`. |
| `config.strict` | boolean | `false` | Reject an option neither map declares, instead of passing it through. |
| `hook.<Hook>.active` | boolean | `false` | Enable a pipeline/lifecycle hook. |
| `hook.<Hook>.await` | boolean | `false` | Whether the hook is awaited. |
| `deps.<lang>.<dep>` | object | — | Per-language runtime deps (`active`, `version`, `kind`). |
| `target.<lang>.deps.<dep>` | object | — | Target-scoped dep overrides. |
| `plugin.<name>.active` | boolean | `false` | Enable one of a feature's separately-trimmed parts. |
| `plugin.<name>.deps.<lang>.<dep>` | object | — | Deps only that plugin's files need. Taken when the PLUGIN is active, not merely the feature. |

The available hook names are listed in the [hooks reference](./hooks.md).

#### Where dependencies come from, and what gates each one

A generated manifest — `package.json`, `go.mod`, `Cargo.toml` — is
assembled from three sources, each with its own gate:

| source | declared at | taken when |
| --- | --- | --- |
| target | `target.<lang>.deps.<dep>` | `active` is not `false` (default ON) |
| feature | `feature.<f>.deps.<lang>.<dep>` | the feature is active, applies to this target, AND the dep says `active: true` |
| plugin | `feature.<f>.plugin.<p>.deps.<lang>.<dep>` | everything the feature row requires, AND the plugin itself is active |

Feature and plugin deps are opt-in (`active: true`) while target deps are
opt-out, because a target's own deps describe the language and a feature's
describe a choice. An inactive feature contributes nothing at all, and
neither does a feature whose `needs` the target does not `provide`.

**The plugin level is gated one step deeper on purpose.** A plugin is a
removable part inside an ACTIVE feature: its templates are dropped unless
the project selects it, so a dependency only its files use must not reach
the manifest until then. rust's mini vault is the case — it takes `ring`
for AES-256-GCM, and declaring that at feature level would put ring in the
Cargo.toml of every secrets-enabled rust SDK, including the ones whose
chain is `[env, dotenv]` and which never compile a vault. The manifest has
to agree with the tree the trim leaves behind, or the build asks for a
package whose files are gone.

Most plugins need nothing here: `node:crypto`, go's `crypto/aes` and
python's `ctypes`-loaded OpenSSL are all standard library.

Packages are collapsed by name across every source, first occurrence
winning, and a second declaration with a different version is reported
rather than silently dropped — a duplicate key is a hard parse error in
`go.mod` and `Cargo.toml`, and silently last-wins in `package.json`.

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
| `secret` | string | `''` | Override the plugin's sekreto secret name (`''` = the descriptor default, `<envtoken(instance) lowercased>.apikey`). |
| `instance` | string | `''` | The instance name this client registers under — station passes it when it constructs the client (`station.sdk()`); `''` falls back to the descriptor slug, which is what a bare `connect(SDK)` does. |
| `register` | boolean | `true` | Register the descriptor with the bound station. |
| `capture` | string | `'meta'` | Capture depth: `meta` \| `headers` \| `full`. |

## `main.kit.option.<name>`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | string | `key()` | Option name. |
| `active` | boolean | `true` | Whether the option is present. |

## `main.kit.optspec`

The SDK client's option schema: one declaration that every target validates
against. It is a `struct.validate` spec written by example, so a concrete
value is both the type and the default — `base:
'http://localhost:8000'` means "a string, defaulting to that" — and a
`` `$SENTINEL` `` constrains without defaulting.

The generator writes it into each SDK as a `Schema` module — `src/Schema.ts`
in TypeScript, `core/schema.go` in Go, `sdk_schema.ml` in OCaml — and the
SDK's own `makeOptions` validates the caller's options against it at
construction. Add an option here and every target accepts it; nothing else
needs editing.

| Key | Meaning |
| --- | --- |
| `apikey`, `secret` | Credentials. `auth: null` suppresses auth outright. |
| `base`, `prefix`, `suffix` | The API base URL and path affixes. |
| `auth.prefix`, `auth.basic` | Credential scheme. |
| `headers` | Extra headers sent with every request. |
| `allow.method`, `allow.op` | Comma-separated allow-lists. |
| `entity` | Per-entity overrides. |
| `extend` | Feature instances supplied at construction. |
| `utility`, `system.fetch` | Platform seams. |
| `test` | Offline test-mode settings. |
| `clean.keys` | Keys masked in diagnostics. |
| `server` | Values for a templated base URL. |

`feature` is not declared here: it is assembled per target from each active
feature's own `config.options` and `config.optspec`.

A target's `provides: { schema: true }` tag is a narrower claim, and not the
one this section describes: it says the target can also run the `validate`
feature, which needs a per-target implementation on top of the module.

## `main.kit.info` (from apidef)

Fields the README components read (all optional): `title`, `tagline`,
`about_md`, `license_md`, `license_short`, `homepage`, `docs_url`,
`entity_desc` (a map of `entity → description`), and `auth` (set to
`false` to mark the API as needing no authentication).

## `main.kit.config` (from apidef)

Build/runtime configuration. The generator reads `config.auth.active`
(set `false` to disable auth code, `true` to keep it when the spec
declares no security scheme), among others. See
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

## Documentation editions

Docgen extends the same model under `main.kit.doc`. Its schema is supplied
by `@voxgig/docgen/model/docgen.aontu`, included by each installed edition.
Use `style` for shared branding and `edition.<name>` for each output's
activation, path, filters, and style overrides. Documentation settings do
not change SDK README generation.

Install an edition with `voxgig-sdkgen edition add presentation`. New
projects include `summary` and `github-pages`. The
[docgen guide](https://github.com/voxgig/docgen#configure-the-model)
describes all settings and the generated text QA and deployment workflow.
