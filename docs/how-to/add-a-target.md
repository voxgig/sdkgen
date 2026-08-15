# How to add a language target

Add one of the built-in language SDKs (or an external one) to a project.

## Prerequisites

- A scaffolded SDK project (a directory containing `.sdk/`). If you don't
  have one yet, follow the [Tutorial](../tutorial.md) first.
- `@voxgig/sdkgen` available (it is a dependency of the scaffolded
  project's `.sdk/`).

## Add a built-in target

From the project's `.sdk/` directory:

```bash
voxgig-sdkgen target add ts
# or, via the project script:
npm run add-target ts
```

Built-in SDK targets: `ts`, `js`, `go`, `py`, `php`, `rb`, `lua`,
`csharp`, `java`, `kotlin`, `scala`, `swift`, `dart`, `rust`, `c`, `cpp`,
`zig`, `perl`, `clojure`, `elixir`, `ocaml`, `haskell`, `lean`.

Plus four **consumer** targets, which wrap another target's SDK rather
than being one: `go-cli` and `go-mcp` (wrap `go`), `py-data` (wraps
`py`), and `seneca-provider` (wraps `ts`). Each needs the target it wraps
to be present in the same project. `seneca-provider` also generates into
a **separate repo** — see
[out-of-tree targets](../explanation/out-of-tree-targets.md).

This copies the target's model, components, and templates into `.sdk/`
and ensures the `test` feature is present. Then generate:

```bash
npm run build        # compile the .sdk components
npm run generate     # emit the SDK into ../ts
```

## Add several at once

```bash
voxgig-sdkgen target add ts,go,py
```

## Generate two variants of one language (aliasing)

Use `ref~alias` to install the same target under a second name — for
example a second Go module with different options:

```bash
voxgig-sdkgen target add go~go2
```

This creates a `go2` target whose templates come from `go`. Edit
`.sdk/model/target/go2.aontu` to differentiate it (module name, deps).

An ALIAS is the one target model file a project is meant to edit: nothing
in the scaffold is named `go2`, so `target add` never rewrites it. For a
target added under its own name, the opposite holds — `target add`
OVERWRITES `.sdk/model/target/<t>.aontu` along with `.sdk/src/cmp/<t>/`
and `.sdk/tm/<t>/`, so an edit there is silently reverted on the next
resync. Put project-specific values in the project's own model
(`.sdk/model/sdk.aontu`) instead; see
[what a project declares about itself](../reference/model.md#what-a-project-declares-about-itself).
`voxgig-sdkgen doctor` reports the three trees, the target model file
included.

## Use a target from another package

If a target definition lives in another installed package or a sibling
directory, reference it by path. The **last** path element is the target
name; the rest locates its `.sdk`:

```bash
voxgig-sdkgen target add acme/widgets/go      # node_modules/acme/widgets/.sdk, then acme/widgets/.sdk
voxgig-sdkgen target add /abs/path/go         # /abs/path/.sdk
```

If the source `.sdk` cannot be found, the command lists every location it
searched.

If that package declares an [`sdkgen-package.json`](../reference/project-layout.md#an-sdkgen-package)
manifest, prefer `package add` — it installs everything the package
provides, validates the manifest first so a bad claim cannot leave you
half-installed, and checks the package's `engines.sdkgen` against your
generator:

```bash
npm install --save-dev @acme/sdkgen-iot
voxgig-sdkgen package add @acme/sdkgen-iot
voxgig-sdkgen package add @acme/sdkgen-iot --only target:iot-go
voxgig-sdkgen package add @acme/sdkgen-iot --alias iot-go=acme-go
```

Either way, the copied model file records where the item came from, so
`voxgig-sdkgen package list` can tell you later, and
`voxgig-sdkgen package update` can refresh it.

`package add` refuses a name already installed from a **different**
source rather than replacing it — install that one under an alias, or by
its own ref. A direct `target add` does not check: it OVERWRITES whatever
is there of that name, which is the same behaviour that makes a resync
work.

## Preview without writing

```bash
voxgig-sdkgen -y target add go        # dry run: logs the plan, writes nothing
```

## Verify

```bash
cd ../ts && npm install && npm run build && npm test
```

## See also

- [CLI reference](../reference/cli.md)
- [Add a feature](./add-a-feature.md)
- [Author a brand-new language target](./author-a-new-language.md)
