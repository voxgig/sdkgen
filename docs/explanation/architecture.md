# Architecture: how the pieces fit

This page explains the moving parts behind `@voxgig/sdkgen` and why they
are separate. It is background reading — if you just want to run the
tool, start with the [Tutorial](../tutorial.md).

## The one-sentence version

An OpenAPI specification is parsed into a structured **model**; that
model is **unified** with language-target and feature definitions; and a
**code generator** walks the unified model to emit SDK source for each
target language.

## The pipeline, end to end

```
  OpenAPI spec (.yaml/.json)
        │
        ▼
  ┌───────────────┐   parse + transform     entities, operations,
  │  @voxgig/apidef│ ─────────────────────▶  points, fields, flows
  └───────────────┘                          as .aontu model fragments
        │
        │  +  target/feature/option definitions
        │     (added by `voxgig-sdkgen target add` / `feature add`)
        │  +  the sdkgen base schema (model/sdkgen.aon)
        ▼
  ┌───────────────┐   unify (CUE-like)
  │     aontu      │ ─────────────────────▶  one coherent model object
  └───────────────┘
        │
        ▼
  ┌───────────────┐   run the Root component tree
  │   jostraca     │ ─────────────────────▶  in-memory file tree
  │  (+ sdkgen)    │                          (Project → Folder → File → Content)
  └───────────────┘
        │
        ▼   OVERWRITE what is on disk (never a 3-way merge — see
        ▼   explanation/regeneration-overwrite.md)
   ts/ js/ go/ py/ php/ rb/ lua/ csharp/ java/ kotlin/ scala/ swift/ dart/
   rust/ c/ cpp/ zig/ perl/ clojure/ elixir/ ocaml/ haskell/ lean/
   go-cli/ go-mcp/ py-data/                      ── inside the SDK repo
   seneca-provider                               ── into ITS OWN repo
```

The last four are **consumer** targets: they wrap another target's SDK
(`go`, `go`, `py`, `ts`) rather than being one, switch the standard
generation phases off, and emit their whole package from `Main`.
`seneca-provider` is also the one target that writes OUTSIDE the SDK
repo, via `main: kit: target: <t>: output: path` — a second `generate()`
pass rooted at that path. See
[out-of-tree targets](./out-of-tree-targets.md).

## Who does what

| Package | Role | Why it's separate |
| --- | --- | --- |
| **`@voxgig/apidef`** | Parses an OpenAPI definition into the model (entities, operations, points, fields, flows). Owns `KIT`, `getModelPath`. | Spec parsing is a large concern with its own heuristics; SDK generation should not care how the model was produced. |
| **`aontu`** | Unifies many `.aontu` fragments into one model, applying defaults and constraints (CUE-like data unification). | Lets the model be assembled from independent files (API model + per-target + per-feature) that each contribute and constrain fields. |
| **`jostraca`** | The code-generation engine: the `Project/Folder/File/Content/Copy` component tree, the `generate()` run, and the 3-way merge with existing files. | Generation mechanics (filesystem, merge, dry-run) are generic and reusable beyond SDKs. |
| **`@voxgig/sdkgen`** (this repo) | The SDK-specific layer: the base model schema, the per-language **templates** and **components**, and the `target add` / `feature add` / `generate` actions. | The opinionated "what an SDK looks like" lives here. |
| **`shape`** | Options and value validation. | Shared validation primitive. |
| **`@voxgig/struct`, `@voxgig/util`** | Shared helpers (`getelem`, logging via `prettyPino`, `showChanges`). | Cross-project utilities. |

### Sibling projects (not in this repo)

| Project | Role |
| --- | --- |
| **`create-sdkgen`** | Scaffolds a new SDK project (`npm create @voxgig/sdkgen`). Owns the build tooling (`.sdk/` scripts like `add-target`, `generate`) and the test `.aontu` data. |
| **`@voxgig/model`** | Orchestrates a build. It calls `SdkGen.makeBuild(...)` to run the generation step as part of a larger model build. |
| **an sdkgen package** (anyone's) | Supplies targets and/or features of its own. Shaped like this repo's `ts/project/` and installed with `package add`. |

### Content is not only this package's

`ts/project/` is itself an sdkgen package — a `sdkgen-package.json`
manifest beside a `.sdk/` directory — so "the bundled scaffold" and "a
third-party package" are the same thing to every code path that installs,
compares, or updates them. That is the point: the bundled path is the
external path, so the external one cannot rot from disuse.

What holds it together is **provenance in the model**. Each copied
`model/<kind>/<name>.aontu` records the `.sdk` folder it came from, the
name it had there, and the package that supplied it. There is no lockfile
and no side record — so nothing can disagree with it, and a single
`target add @acme/pkg/iot-go` remains a complete, coherent operation that
says nothing false about its siblings.

That record is what lets `doctor` compare a project against sources it
has never heard of, and `package update` refresh exactly what a package
supplied.

See [Use an sdkgen package](../how-to/use-an-sdkgen-package.md) and
[Author an sdkgen package](../how-to/author-an-sdkgen-package.md).

## Where this package sits at runtime

`@voxgig/sdkgen` is both a **library** and a **CLI**, and it is consumed
in three ways:

1. **As a CLI** — `voxgig-sdkgen target add <lang>` / `feature add <name>`
   scaffold a language target or feature into a project's `.sdk/`
   directory by copying this package's `ts/project/.sdk/` templates and
   components.

2. **As the generation engine** — `@voxgig/model` calls
   `SdkGen.makeBuild(...)`, which runs the per-language **components** to
   emit the actual SDK source. (Generation is *not* invoked from the CLI
   binary directly; the binary only performs the `target`/`feature`
   actions.)

3. **As a component toolkit** — every per-language component in
   `ts/project/.sdk/src/cmp/<lang>/` is authored against this package's
   public API (`cmp`, `File`, `Content`, `Copy`, `each`, `FeatureHook`,
   `getModelPath`, …). See the [API reference](../reference/api.md).

## The two layers of generation

The single most important architectural idea is that each language target
is produced from **two layers**:

- **Templates** (`ts/project/.sdk/tm/<lang>/`) — plain source files copied
  verbatim, with simple placeholder substitution (`ProjectName`,
  `GOMODULE`, …). These are the parts of an SDK that are the same for
  every API: the HTTP transport, the feature runtime, base classes.

- **Components** (`ts/project/.sdk/src/cmp/<lang>/`) — TypeScript that
  *generates* source by walking the model: one file per entity, the
  constructor with all operations, the README, the test suite. These are
  the parts that depend on the specific API.

This split is explained in depth in
[Components vs templates](./components-and-templates.md).

## Further reading

- [Components vs templates](./components-and-templates.md) — the two-layer model.
- [The operation pipeline](./operation-pipeline.md) — what the generated SDKs actually do at runtime, and how features extend them.
- [Project layout](../reference/project-layout.md) — every directory, mapped.
