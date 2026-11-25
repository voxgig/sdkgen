# Reference: programmatic API

`@voxgig/sdkgen` exports a generator factory, the per-language component
toolkit, and a set of helpers. Import from the package root:

```ts
import { SdkGen, cmp, File, Content, getMatchEntries } from '@voxgig/sdkgen'
```

The package is CommonJS (`"type": "commonjs"`), targets ES2021, and ships
its own type declarations.

---

## Generator

### `SdkGen(opts) → instance`

Create a generator instance.

```ts
const sdkgen = SdkGen({ fs, folder: '/path/to/project', dryrun: false })
```

`SdkGen` is a **factory function** — call it directly, not with `new`.

#### `SdkGenOptions`

| Field | Type | Description |
| --- | --- | --- |
| `folder` | `string` | Working folder. Defaults to `'../'`. |
| `fs` | `fs`-like | File system API. Defaults to `node:fs`. |
| `root` | `string?` | Path to a compiled Root component module (used by `generate`). |
| `def` | `string?` | API definition path (metadata). |
| `model` | `{ folder, entity }?` | Model location metadata. |
| `meta` | `{ name }?` | Build metadata. |
| `debug` | `boolean \| string?` | Debug level. |
| `pino` | `Pino?` | Provide a logger instead of constructing one. |
| `now` | `() => number?` | Clock injection (used in tests for deterministic timestamps). |
| `existing` | `{ txt?, bin? }?` | Existing-file merge policy passed to jostraca. |
| `dryrun` | `boolean?` | If true, plan but write nothing. |

#### Instance methods

| Member | Signature | Description |
| --- | --- | --- |
| `generate` | `(spec) => Promise<{ ok, name }>` | Run a generation. `spec = { model, config, root? }`. Resolves the Root component (from `spec.root` or `config.root`), runs jostraca, merges output, returns `{ ok: true, name: 'sdkgen' }`. |
| `action` | `(args: string[]) => Promise<void>` | Dispatch a CLI-style action, e.g. `['target','add','ts']`. |
| `target.add` | `(targets: string[]) => Promise<ActionResult>` | Scaffold targets (the code API behind `target add`). |
| `feature.add` | `(features: string[]) => Promise<ActionResult>` | Scaffold features (the code API behind `feature add`). |
| `pino` | logger | The underlying logger. |

`ActionResult` is `{ jres: JostracaResult }`.

### `SdkGen.makeBuild(opts) → build`

Returns an async `build(model, build, ctx)` function for use as a step in
a larger model build. This is the entry point `@voxgig/model` calls to
run generation:

```ts
const build = await SdkGen.makeBuild({ root, def, model, meta })
await build(model, buildCtx, ctx)   // internally calls sdkgen.generate(...)
```

---

## Component toolkit

These are re-exported from `jostraca` so per-language components can
import everything from one place.

### Structure components

| Export | Purpose |
| --- | --- |
| `Project` | Root of a generated file tree. |
| `Folder` | A directory. |
| `File` | A file; children emit its content. |
| `Content` | Append literal text to the current file. |
| `Copy` | Copy a template file/dir, with placeholder replacement and `exclude`. |
| `Fragment` | Reusable inline source fragment. |
| `Inject` / `Slot` | Insert content at a named slot. |
| `Line` | Emit a single line. |
| `List` | Render a list of items. |

### Generation helpers

| Export | Purpose |
| --- | --- |
| `cmp(fn)` | Wrap a function as a component. The wrapper injects `ctx$` (carrying `model`, `log`, `fs`, …) into `props`, and passes a single function child as `[child]`. It also names the node after `fn`, which is how `generate` traces each file it writes to the component that wrote it, and so removes the file once that component runs and no longer writes it. A file a component made with jostraca's own `cmp` writes is traced to the nearest component made with this one. |
| `each(subject, spec?, fn?)` | Iterate arrays/objects deterministically (sorted by key). Injects `key$`/`val$`/`index$`. |
| `names(base, name)` | Populate case variants (`Name`, `NAME`, …) on `base`. |
| `snakify` / `camelify` / `kebabify` | Case conversions. |
| `cmap` / `vmap` / `omap` | Map over component/value/object structures. |
| `get` / `getx` / `template` | Path access and templating into the model. |
| `indent` | Indent a block of source. |
| `deep` | Deep merge/clone. |

> These come from `jostraca`; see its documentation for full semantics.
> The re-exports exist so component files import a single package.

### SDK components

Language-neutral components that delegate to the per-language
implementation in `ts/project/.sdk/src/cmp/<lang>/`:

`Main`, `Entity`, `Feature`, `Test`, `Readme`, `ReadmeTop`,
`ReadmeInstall`, `ReadmeQuick`, `ReadmeIntro`, `ReadmeModel`,
`ReadmeOptions`, `ReadmeEntity`, `ReadmeHowto`, `ReadmeExplanation`,
`ReadmeRef`, and `FeatureHook`.

#### `ReadmeIntro`

Opens every language README. It writes the title and tagline, then the
target's own `ReadmeIntroBody`, then a note naming what else the project
generates: other languages, the CLI, and the MCP server, read from the active
targets. A project that declares `main: kit: target: 'go-mcp': active: false`
is not promised an MCP server, and a project with one target gets no note. A
per-language file that exports a whole `ReadmeIntro` instead writes the
introduction itself, unframed.

#### `FeatureHook`

```ts
FeatureHook({ name: 'PreRequest' }, () => { /* per-feature emission */ })
```

Renders the per-stage hook dispatch. For each **active** feature that
declares the named hook as active, the children are invoked once with the
feature as the argument. Features that do not declare the stage (or have
no `hook` map) are skipped — never a crash.

`Jostraca` (the engine constructor) is also re-exported.

---

## Helpers

### `requirePath(ctx$, path, flags?)`

Require a module resolved at `<ctx$.folder>/.sdk/dist/<path>`.

- With no flags, a missing module throws.
- With `{ ignore: true }`, a **genuinely missing** module logs a
  `require-missing` warning, naming the path it looked for, and returns
  `undefined`. A module that
  resolves but throws while loading (syntax error, bug, missing nested
  dependency) still propagates — so a broken optional template is never
  silently skipped.

```ts
const Quick = requirePath(ctx$, `./cmp/${target.name}/ReadmeQuick_${target.name}`, { ignore: true })
if (Quick) Quick['ReadmeQuick']({ target })
```

### `isAuthActive(model) → boolean`

True unless the model opts out of auth. The project's own config decides
when it says so explicitly; otherwise the spec-derived signal governs:

1. `main.kit.config.auth.active` set to `true` or `false` (per-SDK, in
   `config.aontu`)
2. `main.kit.info.auth === false` (apidef: the spec declares no
   authentication)

Templates use it to gate API-key code, docs, and examples for public
APIs that need no authentication. An API whose spec omits its security
schemes (GitHub's official OpenAPI does) still gets a credential when the
project sets `config: auth: { active: true, prefix: 'Bearer' }`.

### `guardModel(model, log?) → model`

Prepare a model before anything reads a fact from it. It renames an entity
name no target can hold, a leading digit or two names that meet once case is
ignored, together with the model's references to that name. It also switches
off a flow step whose call the runtime would refuse. Given a `log`, it reports
each change.

`generate()` applies it and then the fact pass, `applyFacts(model)`. A tool
that reads facts from a model `generate()` did not prepare, such as docgen
running alone over `sdk.json`, applies both in that order. Applying it to a
prepared model changes nothing.

### `sourceString(lang, text) → string`

The inside of a double-quoted string literal in the language `lang` that
holds `text`, with every `$` written as that language's escape. A component
prints text from the spec in generated source through it, so the template
pass never reads a `$$` in the text as a model path. It throws for a language
it does not know.

### `collectDeps(model, targetName, targetDeps) → DepEntry[]`

Collect target-language dependencies from features and from the target's
own `deps` block, applying the active-flag rules:

- **feature deps** are included when `dep.active === true` (default off);
- **target deps** are included when `dep.active !== false` (default on).

```ts
type DepEntry = {
  name: string
  version: string
  source: 'feature' | 'target'
  raw: ModelDep      // original dep object (for replace/kind/etc.)
}
```

### `stationLibrary(model, targetName) → string | undefined`

The station library package the generated main module soft-requires for
self-registration with [voxgig/station](https://github.com/voxgig/station)
(station design §6.2 path 1). Defined only when the model carries an
**active** `station` feature (installed via
`package add @voxgig/sdkgen-station`) that declares an **active** dep for
`targetName` in its `deps.<target>` block — the same entry `collectDeps`
flows into the generated manifest, so the manifest dependency and the
emitted require cannot disagree. `undefined` means: emit no registration.

### `buildIdNames(entity, flow) → string[]`

Build the placeholder id names a test populates into `setup.idmap`: the
entity's own ids (`<entity>01..03`), every ancestor entity's ids, and
every literal string referenced by `step.match` / `step.data` across the
flow. `$`-suffixed sentinels are skipped and the result is de-duplicated.

### `getMatchEntries(step) → [string, any][]`

The user-facing entries of a flow step's `match` object — keys ending in
`$` (jostraca/aontu sentinels) are filtered out.

### `alongsideNote(model, targetName) → string`

The note the shared `ReadmeIntro` ends a language introduction with, naming
what the project generates beside that target: other languages, the CLI, and
the MCP server, read from the active targets. It returns an empty string when
the project generates nothing else. A per-language component that writes its
whole introduction itself can call it for the same note.

### `consumedTarget(model, target, sdkrel) → Consumed`

The installed target that a consumer such as `go-cli` builds on, which the
consumer's model names with `consumes`, and where that target is. `sdkrel` is
the path from the consumer's folder back to the project, which `Main` gives a
component as `ctx$.stdrep.SDKREL`. It throws an `SdkGenError` that names
`voxgig-sdkgen target add` when the model has no target of that origin, and one
that names the switch when the model has one but switches it off.

- `name`: the target's installed name, the origin or an alias of it.
- `path`: the path from the consumer's folder to the target's.
- `dir`: the target's folder in the repository the two share, `''` when they
  share none.
- `away`: whether the target is generated into a repository of its own, and
  `url`, that repository's address when the model names one.

### Typing helpers

The typed-model subsystem (full picture:
[typed models](./typed-models.md)) exports:

- **`canonToType(sentinel, lang) → string`** — map a canonical type
  sentinel (`` `$STRING` ``, …, or the `['`$ONE`', [members]]` union
  form) to a concrete type name in `lang`. Unknown sentinel or language →
  that language's "any"; never throws. **`canonKey(sentinel) → string`**
  normalizes a sentinel to its bare key (`'`$STRING`' → 'STRING'`).
- **`OP_SUFFIX`** / **`opTypeName(Name, op) → string`** — the generated
  request-type name scheme (`<Name>LoadMatch`, `<Name>CreateData`, …).
- **`opRequestShape(ent, op) → { items, fromParams }`** — an op's request
  members with the required/optional decision applied (the partiality
  policy). **`opParams(op)`** is the underlying param merge (dedupe by
  name; required = intersection across points; `$action` points excluded).
- **`entityClassName(ent, entityColl) → string`** — collision-free entity
  class name (`<Name>Entity`, disambiguated when it would clash with a
  generated type name).
- **`entityConstructorName(ent, entityColl) → string`** — the go
  constructor name, `New<Class>`, numbered (`NewLicenceEntity2`) when it
  would meet a generated type or class name, such as the class of a
  `new_licence` entity beside `licence`.
- **`entityTypeCollisions(entityColl) → string[]`** /
  **`warnEntityTypeCollisions(entityColl, log, lang)`** — detect (and
  warn about) duplicate generated type names across entities.
- **`entityIdField(ent)`** / **`entityDataIdField(ent)`** — the id-like
  key of the load match / of the data type (they differ; doc generators
  must pick the right one). **`entityOps(ent)`** — active op names of the
  six the bundled targets generate, in canonical order, leaving out an op
  whose every route is an action;
  **`introOps(model)`** — the op names of those six a README introduction
  lists, across every active entity, in canonical order, or `list` and `load`
  when there are none;
  **`entityPrimaryOp(ent)`** — the representative op for a single example;
  **`pickExampleEntity(entityColl)`** — the entity a README example should
  use, preferring one whose example call reaches a route.
- **`opReachable(op, given) → boolean`** — whether a call that gives these
  parameter names, and no `$action`, reaches a route of the op, by the rule
  the runtime point choice applies: only a route without an action that the
  call fills. **`opNeedsAction(op) → boolean`** — whether every route of the
  op is an action, a lone one included, so a call must name one with
  `$action`.

---

## Test kit

`@voxgig/sdkgen/testkit` is the package's second entry point: what an
sdkgen package's own suite uses to install the package into a staged
project and generate from it. The
[package authoring guide](../how-to/author-an-sdkgen-package.md) walks
through it.

```js
const { stageConsumer, generateInto, textGuard } = require('@voxgig/sdkgen/testkit')
```

### `stageConsumer(opts?) → Consumer`

Builds a real project on disk, with `@voxgig/sdkgen` and its peers linked
into its `.sdk/node_modules`. On the consumer, `addPackage(ref)` runs
`package add`, `add(kind, ref)` runs an add through the same dispatch as
the command line,
`compile()` transpiles `.sdk/src/cmp/**`, and `cleanup()` removes the tree.

### `generateInto(consumer, opts) → Promise<GenerateResult>`

A real generation run from the staged project into memory. `opts.model` is
the compiled model. `top: true` also writes the root documents, `outside`
names the destinations of targets generated out of tree, and `external`
relocates targets for this call, as `SDKGEN_EXTERNAL` relocates them for a
run. The result is `{ files, outside, leaks }`: the files by path, the
out-of-tree files by destination, and each placeholder that survived.

### `textGuard(files, opts?) → TextFinding[]`

Reads the Markdown in a `files` map, such as the one `generateInto`
returns, and returns a finding for each line it objects to, without
throwing. A finding is `{ relation, doc, line, cause }`:

| `relation` | The line | `cause` |
| --- | --- | --- |
| `link` | links or changes directory to a path the run did not write, or to an anchor its page lacks | the path, with the anchor |
| `marker` | holds a `$$path$$` marker outside a code span | `unfired` |
| `fence` | opens a code block tagged with a language other than its target's | the tag |
| `off` | names a word in `opts.absent` | the word |

`opts.fences` maps a target's directory to the tag its documents use,
beside the bundled targets' tags and the neutral tags for shell sessions
and data; the guard skips a directory it has no tag for. `opts.absent`
lists the words, or regular expressions, for what the run left out.
`opts.present` names paths that exist although the run did not write them.
Run it over a generation with `top: true`, so a link to a root document
has something to resolve against.

### `manifestParity(pkgRoot) → Record<string, string>`

The `parity` map of the package's `sdkgen-package.json`, or an empty map.

### `volumeKey(path) → string`, `PLACEHOLDERS` and `SDKGEN_ROOT`

`volumeKey` turns a path into the key the in-memory file system stores it
under: forward slashes, no drive letter. `PLACEHOLDERS` lists the tokens `leaks` reports,
and `SDKGEN_ROOT` is the root of the installed `@voxgig/sdkgen`.

---

## Exported types

`SdkGenOptions`, `DepEntry`, and the model interfaces `SdkModel`,
`ModelKit`, `ModelTarget`, `ModelFeature`, `ModelEntity`, `ModelDep`,
`ModelHook`. The model interfaces document the fields sdkgen relies on
and carry permissive index signatures for the dynamic aontu metadata.
See the [model schema](./model.md).

---

## Authoring a component

A minimal per-language component, and how it is wired:

```ts
// ts/project/.sdk/src/cmp/ts/Greeting_ts.ts
import { cmp, File, Content } from '@voxgig/sdkgen'

const Greeting = cmp(function Greeting(props: any) {
  const { model } = props.ctx$
  File({ name: 'GREETING.md' }, () => {
    Content(`# ${model.Name}\nGenerated SDK.\n`)
  })
})

export { Greeting }
```

It is invoked from a parent component (e.g. `Main_ts.ts`):

```ts
import { Greeting } from './Greeting_ts'
Greeting({ target })
```

See [Drive generation from code](../how-to/use-the-api.md) and
[Author a brand-new language target](../how-to/author-a-new-language.md).
