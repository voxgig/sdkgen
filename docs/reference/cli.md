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
generated SDK project's `.sdk/` directory).

## Options

| Option | Short | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `--help` | `-h` | flag | — | Print usage and exit. |
| `--version` | `-v` | flag | — | Print the version and exit. |
| `--debug <level>` | `-g` | string | `info` | Log level / debug verbosity (`trace`, `debug`, `info`, `warn`, `error`, `fatal`). |
| `--dryrun` | `-y` | flag | off | Plan the work and log it, but write no files. |

Exit code is `0` on success and `1` on error. Errors raised as
`SdkGenError` are printed as a clean message; other errors print with
detail.

## Actions

Two actions are available, each with a single `add` command. Names may be
comma-separated to add several at once.

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
| Alias (`~`) | `go~go2` | as above for `go` | `go2` |

The **last path element** of a ref is the target/folder name; everything
before it locates the `.sdk` source. The alias suffix (`ref~alias`)
installs the `ref` target under a different name — useful for generating
two variants of the same language (for example a second Go module with
different options).

If the source `.sdk` folder cannot be found, the CLI fails and lists the
locations it searched.

The built-in targets are: `ts`, `js`, `go`, `py`, `php`, `rb`, `lua`,
`csharp`, `java`, `kotlin`, `scala`, `swift`, `dart`, `rust`, `c`, `cpp`,
`zig`, `perl`, `clojure`, `elixir`, `ocaml`, `haskell`, and the two non-SDK
surfaces `go-cli` and `go-mcp`. Every SDK target vendors a `@voxgig/struct`
port and ships all enterprise features with a full offline test suite.

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
