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
| `cmp(fn)` | Wrap a function as a component. The wrapper injects `ctx$` (carrying `model`, `log`, `fs`, …) into `props`, and passes a single function child as `[child]`. |
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
  `require-missing` warning and returns `undefined`. A module that
  resolves but throws while loading (syntax error, bug, missing nested
  dependency) still propagates — so a broken optional template is never
  silently skipped.

```ts
const Quick = requirePath(ctx$, `./cmp/${target.name}/ReadmeQuick_${target.name}`, { ignore: true })
if (Quick) Quick['ReadmeQuick']({ target })
```

### `isAuthActive(model) → boolean`

True unless the model opts out of auth. Two opt-outs, in priority order:

1. `main.kit.info.auth === false`
2. `main.kit.config.auth.active === false`

Templates use it to gate API-key code, docs, and examples for public
APIs that need no authentication.

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

### `buildIdNames(entity, flow) → string[]`

Build the placeholder id names a test populates into `setup.idmap`: the
entity's own ids (`<entity>01..03`), every ancestor entity's ids, and
every literal string referenced by `step.match` / `step.data` across the
flow. `$`-suffixed sentinels are skipped and the result is de-duplicated.

### `getMatchEntries(step) → [string, any][]`

The user-facing entries of a flow step's `match` object — keys ending in
`$` (jostraca/aontu sentinels) are filtered out.

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
