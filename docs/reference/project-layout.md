# Reference: project layout

Two layouts matter: **this repository** (the generator) and a
**scaffolded SDK project** (what the generator produces and operates on).

## This repository (`@voxgig/sdkgen`)

```
sdkgen/
├── bin/
│   └── voxgig-sdkgen          # CLI entry (target add / feature add)
├── build/
│   └── version.js             # embeds package version into the build
├── model/
│   └── sdkgen.jsonic          # base model schema (defaults + constraints)
├── src/                       # TypeScript source (CommonJS, ES2021)
│   ├── sdkgen.ts              # entry: SdkGen, makeBuild, all public exports
│   ├── types.ts              # ActionContext + model interfaces (SdkModel, …)
│   ├── utility.ts            # requirePath, resolvePath, isAuthActive, SdkGenError
│   ├── action/
│   │   ├── action.ts         # UpdateIndex, appendIndexEntries, loadContent
│   │   ├── target.ts         # target_add, action_target, resolveTarget, TargetRoot
│   │   └── feature.ts        # feature_add, action_feature, FeatureRoot
│   ├── cmp/                  # language-neutral components (delegate per-language)
│   │   ├── Main.ts  Entity.ts  Feature.ts  Test.ts  FeatureHook.ts
│   │   └── Readme*.ts        # Readme, ReadmeTop, ReadmeExplanation, …
│   └── helpers/
│       ├── collectDeps.ts    buildIdNames.ts    getMatchEntries.ts
├── project/
│   └── .sdk/                 # the scaffold copied into consumer projects
│       ├── model/
│       │   ├── target/<lang>.jsonic       # target definitions
│       │   └── feature/<name>.jsonic      # feature definitions + index
│       ├── src/cmp/<lang>/   # per-language generator COMPONENTS
│       └── tm/<lang>/        # per-language TEMPLATES (copied verbatim)
├── test/                     # Node test runner (*.test.ts)
├── docs/                     # this documentation
├── dist/                     # compiled output (committed)
└── dist-test/                # compiled tests (gitignored, regenerated)
```

### The `project/.sdk/` scaffold

This is the most important directory to understand. For each language it
holds the **two layers** described in
[Components vs templates](../explanation/components-and-templates.md):

| Path | Layer | Becomes |
| --- | --- | --- |
| `model/target/<lang>.jsonic` | model | the target definition (deps, ext, module) |
| `model/feature/<name>.jsonic` | model | the feature definition (hooks, deps) |
| `src/cmp/<lang>/*.ts` | components | API-specific source (entities, README, tests) |
| `src/cmp/<lang>/fragment/*` | components | reusable source fragments |
| `tm/<lang>/**` | templates | language-neutral runtime, copied with substitution |

Built-in targets: `ts`, `js`, `go`, `py`, `php`, `rb`, `lua`, plus the
non-SDK surfaces `go-cli` and `go-mcp`. Built-in features: `log`, `test`.

## A scaffolded SDK project

After `npm create @voxgig/sdkgen` and `target add` / `feature add`, a
project looks like:

```
my-sdk/
├── .sdk/                      # build tooling + copied templates/components
│   ├── model/
│   │   ├── api.jsonic         # apidef output (entities, operations, info)
│   │   ├── target/            # target defs + target-index.jsonic
│   │   └── feature/           # feature defs + feature-index.jsonic
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
| `dist/` | yes | `npm run build` (`tsc --build src`) |
| `dist-test/` | no (gitignored) | `npm run build` (`tsc --build test`) |

## See also

- [Model schema](./model.md)
- [Customize templates and propagate the change](../how-to/customize-and-propagate-templates.md)
