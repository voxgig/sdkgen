# How to author an sdkgen package

An sdkgen package supplies targets, features, or both, to any SDK project
— without being part of `@voxgig/sdkgen`.

The shortest description: **a package is shaped exactly like sdkgen's own
`ts/project/`, and that is not a coincidence.** `ts/project/` *is* one,
manifest and all, which is what keeps the bundled path and yours on the
same code. Anything the bundled scaffold can do, a package can do.

## The shape

```
my-sdkgen-package/
├── package.json            # npm packages only
├── sdkgen-package.json     # the manifest
└── .sdk/
    ├── model/
    │   ├── target/iot-go.aontu
    │   └── feature/circuitbreaker.aontu
    ├── src/cmp/iot-go/     # per-target components
    └── tm/
        ├── iot-go/         # your target's templates
        └── go/             # your FEATURE's source for someone else's target
```

For an npm package, ship both:

```json
{
  "name": "@acme/sdkgen-iot",
  "version": "1.4.0",
  "files": [".sdk", "sdkgen-package.json"],
  "peerDependencies": { "@voxgig/sdkgen": ">=3.4" }
}
```

## The manifest

```json
{
  "sdkgen": { "package": 1 },
  "name": "@acme/sdkgen-iot",
  "version": "1.4.0",
  "engines": { "sdkgen": ">=3.4" },
  "provides": {
    "target": ["iot-go"],
    "feature": ["circuitbreaker"]
  }
}
```

- `sdkgen.package` is the manifest schema version. A positive integer;
  anything else is refused.
- `name` is what every installed item records as its `package`
  provenance, and what `package update` is given.
- `provides` is keyed **by kind**, so a future kind needs no schema
  change.
- `engines.sdkgen` is checked at `package add`, so declare the floor you
  actually need and check it against the generator you develop against
  (`voxgig-sdkgen --version`) — a range this generator does not satisfy
  is a refusal, including in your own test loop below. A range the
  checker cannot parse is reported and *allowed* — see the
  [supported subset](../reference/cli.md).

`provides` is validated against your disk in both directions. A claim
with nothing behind it is an **error**; something on disk nobody claims
is a **warning** (it works, it is just undiscoverable — usually a
forgotten manifest edit).

A **target** needs all three of `model/target/<t>.aontu`,
`src/cmp/<t>/` and `tm/<t>/`, the last two as directories. A **feature**
needs only its definition — per-target source is optional, because a
feature package supports the targets it chooses to.

Item names must match `^[A-Za-z0-9][A-Za-z0-9._-]*$`. Not a path, and no
`~` (that is the alias separator).

## Authoring a target

Copy a bundled target as your starting point — they are the reference
implementation:

```bash
cp -r node_modules/@voxgig/sdkgen/project/.sdk/src/cmp/go   .sdk/src/cmp/iot-go
cp -r node_modules/@voxgig/sdkgen/project/.sdk/tm/go        .sdk/tm/iot-go
cp node_modules/@voxgig/sdkgen/project/.sdk/model/target/go.aontu \
   .sdk/model/target/iot-go.aontu
```

Then, and this is the step that is easy to miss: **components are
dispatched by convention**, `cmp/<t>/Main_<t>`. Rename every
`<Cmp>_go.ts` to `<Cmp>_iot-go.ts` and fix the sibling imports inside
them, or nothing will load.

Three more things carry the origin's name, and none of them moves itself:

- **Every target key in the model file** — `go.aontu` has three: the
  target block, the per-target feature-deps slot
  (`main: kit: feature: &: target: go:`) and the feature-trim block. A
  key that is not a bare identifier must be **quoted**
  (`main: kit: target: 'iot-go':`), or aontu will not parse it.
- **The target name the components pass to model lookups.** The go
  components read their config with `goModule(model, 'go')`,
  `goPackageIdent(model, 'go')` and `packageName(model, 'go')` — that
  string is the target whose model block is read, not the language. Left
  alone, your `iot-go` target generates with the `go` target's module
  path and package identifier, and only if `go` is installed at all.
  Change it in every component; `grep -rn "'go'" .sdk/src/cmp/iot-go`
  shows what is left.
- **`base: 'BASE'`** — keep the line. It is the **anchor** the
  provenance stamp replaces; a definition without it records nothing,
  silently.

## Authoring a feature

A feature is its model file plus per-target source. Your package can ship
source for targets it does not provide — an **overlay**:

```
.sdk/tm/go/feature/circuitbreaker_feature.go
.sdk/tm/ts/src/feature/circuitbreaker/…
```

Each target puts feature source somewhere different; copy the layout of
an existing feature for that language rather than guessing.

Your overlay takes precedence over the target's own copy of a feature
with the same name — but the target's files are not removed, so avoid
reusing a built-in feature's name.

## Check it

```bash
voxgig-sdkgen package check          # the package you are standing in
```

The static battery, run from your package root — the one command that
needs no project, because it acts on the package. It reads the manifest
against your disk in both directions, compiles every model file the way a
consumer's build does, unifies each against the base schema, and looks
for the mistakes that only surface in somebody else's project: a
definition still declaring the name it was copied from, a missing
`base: 'BASE'`, a `//` comment, a pinned publication value, per-target
deps under the slot nothing reads, feature source no trim can recognise.

It exits non-zero on any error, so it belongs in your `prepublishOnly`.
Every finding is listed in the [CLI reference](../reference/cli.md#package-check-path).

## Test it before publishing

A clean check is necessary and not sufficient — it is static. The loop
that proves the package works is the same one used on sdkgen's own
scaffold: install into a real project and generate.

```bash
cd path/to/an-sdk-project/.sdk
voxgig-sdkgen package add /abs/path/to/my-sdkgen-package
npm run build && npm run generate
cd ../iot-go && <your language's test command>
```

Then check the project is exactly as `add` would leave it:

```bash
voxgig-sdkgen doctor
```

A clean `doctor` immediately after `package add` is the bar. If it
reports anything, your package and the copy pipeline disagree about what
should have been written.

Iterate by re-running `package add` — it overwrites, which is how a
resync works.

## Publishing

```bash
npm publish --access public
```

Consumers then:

```bash
npm install --save-dev @acme/sdkgen-iot
voxgig-sdkgen package add @acme/sdkgen-iot
```

Bump `version` in **both** `package.json` and `sdkgen-package.json` —
`package list` shows the manifest's version, and `package update`
compares against the source on disk.

## Things that will bite you

- **A key that is not a bare identifier must be quoted** in aontu.
  The name grammar above admits more than aontu's bare keys do — a
  hyphen (`iot-go`), a dot (`go.v2`) or a leading digit (`2go`) all need
  `target: 'iot-go':`.
- **Keep `base: 'BASE'`** in every definition, or the copy records no
  provenance and `package update` cannot find it later.
- **Rename the components** to match the target name, including the
  imports inside them and the target name they pass to model lookups
  (`goModule(model, 'go')`).
- **Do not reuse a built-in name** unless you mean to replace it —
  consumers get a name-collision refusal and must alias.
- **`sdkgen-package.json` must be in `files`**, or npm ships a package
  `package add` will not install.

## See also

- [Use an sdkgen package](./use-an-sdkgen-package.md)
- [Author a brand-new language target](./author-a-new-language.md) — the
  deeper guide to what a target must implement
- [Project layout](../reference/project-layout.md#an-sdkgen-package)
- [The design note](../design/sdkgen-packages.md)
