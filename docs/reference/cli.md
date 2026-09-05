# Reference: the `voxgig-sdkgen` CLI

The package installs one binary, `voxgig-sdkgen`. It performs the
**scaffolding actions** that copy language targets and features into a
project's `.sdk/` directory.

> The CLI does **not** run code generation. Generation (turning the model
> into SDK source) is driven by `@voxgig/model` through the
> [programmatic API](./api.md). In a scaffolded project you invoke it via
> `npm run generate`.

## Synopsis

```
voxgig-sdkgen [options] <action> <command> <args...>
```

Run from the directory that contains the `.sdk/` folder (typically a
generated SDK project's `.sdk/` directory). The one exception is
[`package check`](#package-check-path), which validates a package rather
than acting on a project, and so runs where there is no project model.

## Options

| Option | Short | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `--help` | `-h` | flag | — | Print usage and exit. |
| `--version` | `-v` | flag | — | Print the version and exit. |
| `--debug <level>` | `-g` | string | `info` | Log level / debug verbosity (`trace`, `debug`, `info`, `warn`, `error`, `fatal`). |
| `--dryrun` | `-y` | flag | off | Plan the work and log it, but write no files. |
| `--only <items>` | — | string | everything | `package add` only: install a subset, as `<kind>:<name>` entries. |
| `--alias <map>` | — | string | — | `package add` only: install under different names, as `<name>=<alias>` entries. |
| `--force` | — | flag | off | `package update` only: overwrite locally-changed files, listing what it discarded. |
| `--no-fetch` | — | flag | off | `package update` only: skip the fetch and use the source already installed. |

`--only` and `--alias` are arguments to one *command*, not generator
configuration — unlike `--debug` and `--dryrun`, which describe the
generator itself. In the code API they are the second argument to
`sdkgen.action(args, flags)` rather than options on `SdkGen({…})`.

Exit code is `0` on success and `1` on error. Errors raised as
`SdkGenError` are printed as a clean message; other errors print with
detail.

## Actions

The verbs are built from the kind registry (`target`, `feature`, `docs`)
plus `package` and `doctor`, so registering a new kind adds its `add`
command with no dispatch code. Names may be comma-separated to add several at
once.

### `target add <ref>[,<ref>...]`

Scaffold one or more language targets into `.sdk/`. This copies, for each
target:

- the target model (`.sdk/model/target/<name>.aontu`) and registers it
  in `target-index.aontu`;
- the generator components (`.sdk/src/cmp/<name>/`);
- the templates (`.sdk/tm/<name>/`).

It also ensures the `test` feature is present (every target's generated
test suite depends on it).

```bash
voxgig-sdkgen target add ts
voxgig-sdkgen target add ts,go,py        # several at once
voxgig-sdkgen -y target add go           # dry run
```

#### Target references

A `<ref>` selects *where* the target definition comes from and *what it
is named*:

| Form | Example | Resolves the template from | Target name |
| --- | --- | --- | --- |
| Bare name | `go` | the bundled `node_modules/@voxgig/sdkgen/project/.sdk` | `go` |
| Scoped/path | `acme/widgets/go` | `node_modules/acme/widgets/.sdk`, falling back to `acme/widgets/.sdk` | `go` |
| Absolute | `/abs/widgets/go` | `/abs/widgets/.sdk` | `go` |
| Alias (`~`) | `go~go2` | as for `go` | `go2` |

The **last path element** of a ref is the target/folder name; everything
before it locates the `.sdk` source. The alias suffix (`ref~alias`)
installs the `ref` target under a different name — useful for generating
two variants of the same language (for example a second Go module with
different options).

If the source `.sdk` folder cannot be found, the CLI fails and lists the
locations it searched.

The built-in SDK targets are: `ts`, `js`, `go`, `py`, `php`, `rb`, `lua`,
`csharp`, `java`, `kotlin`, `scala`, `swift`, `dart`, `rust`, `c`, `cpp`,
`zig`, `perl`, `clojure`, `elixir`, `ocaml`, `haskell`, `lean`. Every one
of them vendors a `@voxgig/struct` port and ships all enterprise features
with a full offline test suite.

Four further targets CONSUME another target's SDK rather than being one,
and need it present in the same project: `go-cli` and `go-mcp` (wrap
`go`), `py-data` (wraps `py`) and `seneca-provider` (wraps `ts`). They
switch the standard generation phases off and emit their whole package
from `Main`. `seneca-provider` generates into a separate repo — see
[out-of-tree targets](../explanation/out-of-tree-targets.md).

### `doctor`

Reports whether this project's `.sdk/` still matches the scaffold. Exits
non-zero when it does not, so it can gate CI.

```bash
voxgig-sdkgen doctor
```

It compares the three things `target add` owns and overwrites:
`.sdk/src/cmp/<t>/`, `.sdk/tm/<t>/` and `.sdk/model/target/<t>.aontu`.

Six categories:

| Category | Meaning |
| --- | --- |
| **forked** | A file in `.sdk/src/cmp/**`, or a target's own `.sdk/model/target/<t>.aontu`, differs from the scaffold. `target add` will silently revert it. |
| **edited** | A template master in `.sdk/tm/**` differs — compared *after* applying the same substitutions `target add` applied, so placeholder replacement is not reported as an edit. |
| **stale** | Present in the project, but `target add` would no longer write it. Orphaned output. |
| **missing** | `target add` would write it and the project does not have it. |
| **additive** | A project-owned component the scaffold never shipped. Reported, never a failure — this is the supported way to extend a target (see `registerComponent`). |
| **unwired** | A root-level component this sdkgen provides that the project's `src/*.ts` wiring never calls. Informational: opting out is legitimate. |

The first four fail the check. A plain `diff -r` against the scaffold cannot
do this job: `target add` writes template masters with substitution partly
applied and inconsistently, so most of what a naive diff reports is not an
edit at all.

An ALIASED target (`target add go~go2`) is exempt from the model-file
comparison: the scaffold ships no `go2.aontu` to compare against, and
editing that file is how an alias is differentiated in the first place.

### `feature add <name>[,<name>...]`

Scaffold one or more features into `.sdk/`. This copies the feature model
(`.sdk/model/feature/<name>.aontu`), registers it in
`feature-index.aontu`, and copies the per-target feature templates
(`.sdk/tm/<target>/src/feature/<name>/`) for every active target.

```bash
voxgig-sdkgen feature add test
voxgig-sdkgen feature add log,test
```

The built-in features are `log` and `test`.

A feature reference takes the same forms as a target reference, except
that **aliasing is refused**: a feature's name is part of the generated
`options.feature.<name>` config key and of the hook wiring in every
target, so it cannot be renamed at install time.

### `docs add <ref>[,<ref>...]`

Install a **docs item** — a generation target whose destination is a
documentation system rather than a language: a static site, a
developer-portal catalogue, a hosted service's config.

```bash
voxgig-sdkgen docs add @voxgig/docgen/apidocs
voxgig-sdkgen docs add ../my-docs/apidocs~portal
```

sdkgen ships the **kind** and no items; the items live in packages, so
every ref is a package-relative or absolute path (or a bare name once one
is installed, which resolves against the provenance already recorded).

It copies `model/docs/<n>.aontu`, `src/cmp/docs/<n>/` and — if the source
ships one — `tm/docs/<n>/`. The trees are **nested under the kind**, so a
docs item and a target may share a name without sharing a directory.

A docs item's template tree is **optional**: an item whose every emitted
byte depends on the API (a catalogue entry, a config file) legitimately
ships none, and neither `package check` nor `doctor` asks for it.

Aliasing works as it does for targets (`ref~alias`), including renaming
`Main_<n>` so the component still dispatches.

**Generation.** An installed item is emitted by `npm run generate`,
through its package's `cmp/docs/<n>/Main_<n>` component. In-tree it lands
in `<sdk-repo>/<n>/`; with `output: path` set it gets its own pass rooted
there, which is the normal case for a documentation site. Neither needs
any change to a project's `Root.ts` — sdkgen runs the docs pass itself,
so `docs add` works in a project scaffolded before the kind existed.

### `package add <pkg>[,<pkg>...]`

Install everything an [sdkgen package](../how-to/use-an-sdkgen-package.md)
provides. A package is a folder holding a `sdkgen-package.json` manifest
beside a `.sdk/` directory shaped exactly like the bundled scaffold.

```bash
npm install --save-dev @acme/sdkgen-iot
voxgig-sdkgen package add @acme/sdkgen-iot
voxgig-sdkgen package add @acme/sdkgen-iot --only target:iot-go
voxgig-sdkgen package add @acme/sdkgen-iot --alias iot-go=acme-go
```

The package reference resolves the same way an item reference does, one
level up: `node_modules/<pkg>`, then `<pkg>` relative to the project,
then an absolute path.

This is not a separate copy pipeline. It validates the manifest, then
runs the *same* per-kind `add` once per provided item — so provenance,
index handling, the feature fan-out and `--dryrun` all behave
identically to typing the adds by hand.

Three things it does that the individual commands cannot:

- **The manifest is required and validated first, in full.** Items are
  installed in a loop, so a claim that turns out to be false partway
  through would leave a half-installed project with a partial index.
- **`engines.sdkgen` is checked** against the running generator. A range
  the checker cannot parse is reported and *allowed* — refusing on an
  unparsed range would block a package that works.
- **Targets are installed before features**, because `feature add`
  copies a feature's source into every target already present, and the
  in-memory model is updated between kinds so the feature finds the
  targets this same command just installed.

A typo in `--only` is an error listing what the package does provide,
never a silent no-op.

### `package check [path]`

Validate a package you are **authoring**, before anyone installs it.
Every other verb acts on a project; this one acts on a package, so it is
the one command that runs where there is no `model/sdk.aontu` — an
author's package root, which is the default `path`.

```bash
voxgig-sdkgen package check              # the package you are standing in
voxgig-sdkgen package check ../acme-sdkgen-iot
```

It exits non-zero on any **error** finding, so it works as a publish
gate. What it checks:

| Finding | Level | What it means |
| --- | --- | --- |
| `manifest-absent` | warn | No `sdkgen-package.json`, so `package add` cannot install this — the items can still be added directly by path. Everything below is still checked. |
| `manifest-unreadable` | error | The manifest is not JSON, or not an object. |
| `manifest-item-missing` | error | The manifest claims something the package does not ship — the definition, or (for a target) its `src/cmp/<t>` or `tm/<t>` tree. |
| `manifest-item-unclaimed` | warn | Something on disk the manifest does not list, so nothing can install it. Usually a forgotten manifest edit. |
| `model-anchor-missing` | error | A definition with no `base: 'BASE'` line. The copy would record no provenance, so `package update` and `doctor` could never find its source. |
| `model-slash-comment` | error | A `//` or `/* */` line, named by line number. Aontu takes `#` comments only, and a consumer's parser is configured strictly even though a bare `Aontu()` accepts them. |
| `model-parse` | error | The definition does not compile. Says so explicitly when it compiles under a bare `Aontu()` and not the strict one. |
| `model-key-missing` | error | `model/<kind>/<name>.aontu` declares some *other* name — the mistake made when a bundled target is copied as a starting point and the key inside is not renamed. |
| `model-schema` | error | It does not unify with the base schema: a non-defaulted key is missing (`ext`, `comment.line`, `module.name`, a feature's `title`). This is what a consumer compiles. |
| `target-publish-pinned` | error | The target model sets a publication value the *project* owns, so the project can no longer set it (concrete-vs-concrete is a conflict) — and the failure would name the project's file. |
| `feature-deps-misplaced` | warn | Dependencies under `feature.<f>.target.<t>.deps`, which nothing reads. They go directly under the feature: `deps: <target>: {…}`. |
| `feature-source-undelivered` | warn | `targetsSupported` claims a target for which no feature source can be found. |
| `feature-source-unrecognised` | warn | A file named like feature source (`<name>_feature.<ext>`, `<Name>Feature.<ext>`, a directory) that no `model/feature/<name>.aontu` declares — so the trim cannot recognise it and every project receives it whatever its model selects. |

The blind spot is deliberate: a bare `<name>.<ext>` inside a `feature`
directory (rust's `retry.rs`) is written exactly like shared machinery
(`support.rs`), so shape alone cannot tell them apart and nothing is
reported where it would have to guess.

The bundled scaffold — `ts/project`, itself an sdkgen package — passes
this battery with no findings, which is what shows the checks do not fire falsely
across 27 targets and 17 features.

### `package list`

List what is installed and which package supplied each item, read
entirely from the provenance recorded in the project's own model files —
there is no lockfile. Items installed before provenance existed are
listed under `(unrecorded)`.

```bash
voxgig-sdkgen package list
```

The version shown is the one **on disk** in the source today, not one
recorded at add time.

### `package update <pkg>[,<pkg>...]`

Fetch a newer version of a package and refresh everything it supplied.

```bash
voxgig-sdkgen package update @acme/sdkgen-iot
voxgig-sdkgen package update @acme/sdkgen-iot --force
voxgig-sdkgen package update @acme/sdkgen-iot --no-fetch
```

**The order is the safety property**, and it is why this command owns the
fetch rather than telling you to run `npm update` first:

1. **check** the project's copies against the source *as currently
   installed*;
2. **fetch** the new version;
3. **re-add** each item.

Measured at step 1, a copy that differs from its source means the project
changed it. Run the other way round — fetch, then check — every item
legitimately differs from the new source, the gate fires on all of them,
and you learn to pass `--force` every time. That makes the gate worse
than not having one, because the same signal (copy differs from source)
carries both meanings and only sequence separates them.

What it refreshes is what the **project installed**, read from recorded
provenance — which may be a subset (`--only`) or carry aliases the
package never mentions.

`--force` overwrites locally-changed files, listing what it discarded.
Without it, the refusal states both readings, because nothing recorded in
the project distinguishes them:

```
@acme/sdkgen-iot: 1 file(s) differ from the installed source, so updating
would overwrite them:
  model/target/iot-go.aontu

  This means one of two things, and nothing recorded in the project tells
  them apart:
    - they are LOCAL EDITS, and `--force` will discard them;
    - or @acme/sdkgen-iot was already updated out of band (an `npm update`
      in another shell), in which case they are merely STALE and nothing
      is at risk.
```

An **aliased item's model file is never rewritten** — that file is where
an alias is differentiated, so `update` refreshes its `src/cmp` and `tm`
trees from the new origin and reports the skip, so upstream model changes
can be ported by hand rather than silently never applied.

`--no-fetch` uses the source already installed. It is not the default,
because then the command would only re-apply the source it already has,
which is `package add`.

A failed fetch leaves the project untouched: nothing is overwritten
before step 3.

## Typical sequence (in a scaffolded project)

```bash
cd my-sdk/.sdk
voxgig-sdkgen target add ts        # or: npm run add-target ts
voxgig-sdkgen feature add test     # or: npm run add-feature test
npm run build                      # compile .sdk components
npm run generate                   # emit the SDK into ../ts
```

See the [Tutorial](../tutorial.md) for the full walkthrough and
[Add a language target](../how-to/add-a-target.md) for variations.
