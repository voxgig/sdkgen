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

Built-in targets: `ts`, `js`, `go`, `py`, `php`, `rb`, `lua`, and the
non-SDK surfaces `go-cli`, `go-mcp`.

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
`.sdk/model/target/go2.jsonic` to differentiate it (module name, deps).

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
