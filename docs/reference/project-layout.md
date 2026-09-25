# Reference: project layout

Two layouts matter: **this repository** (the generator) and a
**scaffolded SDK project** (what the generator produces and operates on).

## This repository (`@voxgig/sdkgen`)

`ts/` is the self-contained npm package root; the top-level holds only the
documentation and the `Makefile`. The base model and license each live
once, under `ts/`, and are shipped directly. `ts/README.md` is a short
summary linking to the full top-level README.

```
sdkgen/
├── Makefile                   # build / test / check-model (wraps ts/ npm)
├── docs/                      # this documentation
└── ts/                        # the self-contained npm package root (@voxgig/sdkgen)
    ├── package.json           # npm manifest (main: dist/sdkgen.js)
    ├── README.md              # package summary linking to the top-level README
    ├── LICENSE                # authoritative license text
    ├── bin/
    │   └── voxgig-sdkgen      # CLI entry (target add / feature add)
    ├── build/
    │   └── version.js         # embeds package version into bin/ at publish time
    ├── model/
    │   └── sdkgen.aontu         # authoritative base model schema, shipped directly
    ├── src/                   # TypeScript source (CommonJS, ES2021)
    │   ├── sdkgen.ts          # entry: SdkGen, makeBuild, all public exports
    │   ├── types.ts           # ActionContext + model interfaces (SdkModel, …)
    │   ├── utility.ts         # requirePath, resolvePath, isAuthActive, SdkGenError
    │   ├── action/
    │   │   ├── action.ts      # UpdateIndex, appendIndexEntries, loadContent
    │   │   ├── target.ts      # target_add, action_target, resolveTarget, TargetRoot
    │   │   └── feature.ts     # feature_add, action_feature, FeatureRoot
    │   ├── cmp/               # language-neutral components (delegate per-language)
    │   │   ├── Main.ts  Entity.ts  Feature.ts  Test.ts  FeatureHook.ts
    │   │   └── Readme*.ts     # Readme, ReadmeTop, ReadmeExplanation, …
    │   └── helpers/
    │       ├── collectDeps.ts    buildIdNames.ts    getMatchEntries.ts
    ├── test/                  # Node test runner (*.test.ts, including model compilation)
    ├── dist/                  # compiled output (committed)
    ├── dist-test/             # compiled tests (gitignored, regenerated)
    └── project/
        └── .sdk/              # the scaffold copied into consumer projects
            ├── model/
            │   ├── target/<lang>.aontu       # target definitions
            │   └── feature/<name>.aontu      # feature definitions + index
            ├── src/cmp/<lang>/   # per-language generator COMPONENTS
            └── tm/<lang>/        # per-language TEMPLATES (copied verbatim)
```

### The `ts/project/.sdk/` scaffold

This is the most important directory to understand. For each language it
holds the **two layers** described in
[Components vs templates](../explanation/components-and-templates.md):

| Path | Layer | Becomes |
| --- | --- | --- |
| `model/target/<lang>.aontu` | model | the target definition (deps, ext, module) |
| `model/feature/<name>.aontu` | model | the feature definition (hooks, deps) |
| `src/cmp/<lang>/*.ts` | components | API-specific source (entities, README, tests) |
| `src/cmp/<lang>/fragment/*` | components | reusable source fragments |
| `tm/<lang>/**` | templates | language-neutral runtime, copied with substitution |

Built-in SDK targets: `ts`, `js`, `go`, `py`, `php`, `rb`, `lua`,
`csharp`, `java`, `kotlin`, `scala`, `swift`, `rust`, `c`, `cpp`,
`zig`, `perl`, `clojure`, `elixir`, `ocaml`, plus the three consumer
targets `go-cli`, `go-mcp` and `py-data`, which wrap another target's SDK
(`go`, `go` and `py` respectively).

From packs: `dart`, `haskell` and `lean` in
`@voxgig/sdkgen-langpack`, and the consumer target `seneca-provider`
(wraps `ts`) in `@voxgig/sdkgen-infrapack`. Built-in features: `log`, `test`, plus the enterprise
features `retry`, `timeout`, `ratelimit`, `cache`, `idempotency`,
`paging`, `streaming`, `proxy`, `telemetry`, `metrics`, `debug`, `audit`,
`clienttrack`, `rbac`, and `netsim` (all inactive by default).

## An sdkgen package

Targets and features are not only the built-in ones. An **sdkgen
package** is any folder with this shape, installed from npm, a git
checkout, or a plain local directory:

```
<package-root>/
├── package.json            # npm packages only; files: [".sdk", "sdkgen-package.json"]
├── sdkgen-package.json     # THE manifest — see below
└── .sdk/                   # shaped byte-for-byte like ts/project/.sdk
    ├── model/
    │   ├── target/<t>.aontu     # one per provided target
    │   └── feature/<f>.aontu    # one per provided feature
    ├── src/cmp/<t>/             # per-target components
    └── tm/
        ├── <t>/                 # per-target templates
        └── <other-target>/      # a feature's source for a target this
                                 # package does NOT provide (an overlay)
```

The `.sdk` subfolder is the convention everything else rests on: it is what
resolution probes for, and it means the whole copy pipeline works on a
package tree unchanged, because it cannot tell one apart from the bundled
scaffold.

```json
{
  "sdkgen": { "package": 1 },
  "name": "@acme/sdkgen-iot",
  "version": "1.4.0",
  "engines": { "sdkgen": ">=3.5" },
  "provides": {
    "target": ["iot-go"],
    "feature": ["circuitbreaker"]
  }
}
```

`provides` is keyed **by kind**, and is validated against the trees on
disk in both directions at `package add`: a claim with nothing behind it
is an error, something on disk that nobody claims is a warning. A target's
claim needs `model/target/<t>.aontu`, `src/cmp/<t>/` **and** `tm/<t>/`; a
feature's definition is the whole of it.

The manifest is **required** for `package add` and **optional** for a
direct ref (`target add <path>/<name>`) — a bare `.sdk`-shaped folder
stays a valid source, and simply records no `package` provenance.

**`ts/project/` is itself one of these**, manifest and all, which is what
keeps the bundled path and the external path on the same code. Its
`provides` is pinned to the actual directory listings by a guard test, so
it cannot drift from the scaffold.

See [Use an sdkgen package](../how-to/use-an-sdkgen-package.md) and the
[CLI reference](./cli.md).

## A scaffolded SDK project

After `npm create @voxgig/sdkgen` and `target add` / `feature add`, a
project looks like:

```
my-sdk/
├── .sdk/                      # build tooling + copied templates/components
│   ├── admin/                 # repository administration scripts
│   │   ├── status.sh          # local status; optional GitHub status
│   │   ├── setup-github-pages.sh  # generated by docgen when Pages is enabled
│   │   └── setup-npm-trust.sh     # generated by sdkgen when a target publishes to npm
│   ├── model/
│   │   ├── api.aontu         # apidef output (entities, operations, info)
│   │   ├── target/            # target defs + target-index.aontu
│   │   └── feature/           # feature defs + feature-index.aontu
│   ├── src/cmp/<lang>/        # components copied from sdkgen by `target add`
│   ├── tm/<lang>/             # templates copied from sdkgen by `target add`
│   └── dist/                  # compiled components (the `generate` step requires these)
├── ts/                        # ← generated TypeScript SDK
├── go/                        # ← generated Go SDK
└── …                          # one directory per active target
```

The `generate` step compiles `.sdk/src/cmp/<lang>` to `.sdk/dist`, runs
the component tree, and writes/merges the result into the per-target
directories (`ts/`, `go/`, …).

### Repository administration

New projects include `.sdk/admin/status.sh`. Run it from any directory, or use
`npm run status` from `.sdk`. The script reads Git state, the compiled model,
SDK output directories, tool versions, model publication settings, and
documentation outputs. It does not run builds or tests, fetch refs, or contact
package registries. Ahead/behind counts use local tracking refs.

```sh
.sdk/admin/status.sh
.sdk/admin/status.sh --json
.sdk/admin/status.sh --github
```

`--github` also reads recent workflow runs and Pages status through `gh`.
Publication settings describe the model; they do not verify registry releases.

Create-sdkgen supplies the launcher, and sdkgen supplies its reporting code.
Docgen generates `.sdk/admin/setup-github-pages.sh` when a Pages edition and its
CI workflow are enabled. Its `--dry-run` option previews setup, and `--check`
reports whether Pages uses GitHub Actions. Running it without either option
creates or updates the Pages configuration. It does not commit, push, merge,
or deploy.

Sdkgen generates `.sdk/admin/setup-npm-trust.sh` when a target publishes to
npm and the repository is on `github.com`. It registers each
`publish-<target>.yml` workflow as the trusted publisher of its package, using
the package name and repository that the workflow was generated from, so the
two cannot disagree. `--check` compares the configuration npm holds with those
workflows and exits non-zero on any difference. `--dry-run` prints the
`npm trust` commands without contacting npm. Running it without either option
creates a missing configuration and leaves a matching one alone, and
`--replace` also revokes trusted publishers that no workflow names. It needs
an npm login with publish rights. npm offers trusted publishing only once a
package has a version, so a new package's first version is published by hand,
as `.sdk/PUBLISHING.md` describes, and the script runs straight after. These
scripts require the project's `.sdk` dependencies.

Keep project administration scripts in this directory with different names.

### Inside a generated target (e.g. `ts/`)

A generated SDK has a stable internal shape (from `tm/<lang>/` plus the
generated entity/main/readme/test files):

```
ts/
├── src/
│   ├── <Sdk>.ts              # the SDK client (generated)
│   ├── <Entity>.ts           # one per entity (generated)
│   ├── feature/              # base + per-feature runtime (templates)
│   └── utility/              # transport, request/response pipeline (templates)
├── test/                     # generated + template tests
├── README.md  REFERENCE.md   # generated docs
└── package.json              # generated (Package component)
```

## Build outputs

| Directory | Committed? | Produced by |
| --- | --- | --- |
| `ts/dist/` | yes | `cd ts && npm run build` (`tsc --build src`) |
| `ts/dist-test/` | no (gitignored) | `cd ts && npm run build` (`tsc --build test`) |

## See also

- [Model schema](./model.md)
- [Customize templates and propagate the change](../how-to/customize-and-propagate-templates.md)
