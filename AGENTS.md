# AGENTS.md — operating guide for AI coding agents

This is the manual for automated agents working in or with
`@voxgig/sdkgen`. It is intentionally dense. Read it before making
changes; it will save you a broken build.

Human-oriented docs live in [`docs/`](./docs/README.md) (tutorial,
how-to, reference, explanation). This file is the agent-facing summary
plus the gotchas.

**Building an SDK, not modifying the generator?** If your goal is to
produce an SDK for your own API — i.e. *consume* this tool rather than
change it — start at
[`create-sdkgen/AGENTS.md`](https://github.com/voxgig/create-sdkgen/blob/main/AGENTS.md): the end-to-end
spec → scaffold → generate → test → publish guide. This file is for
working *on* the generator itself.

---

## What this tool is

`@voxgig/sdkgen` generates idiomatic, multi-language client SDKs from an
OpenAPI-derived **model**. It is a **library + CLI**, consumed three ways:

1. **CLI** `voxgig-sdkgen` — `target add` / `feature add` scaffold a
   language or feature into a project's `.sdk/`.
2. **Engine** — `SdkGen.makeBuild(...)` runs generation (invoked by
   `@voxgig/model`, not by the CLI binary).
3. **Toolkit** — per-language generator components import this package's
   public API (`cmp`, `File`, `Content`, `Copy`, `each`, `FeatureHook`,
   `getModelPath`, …).

Pipeline: `OpenAPI → apidef → model (.aontu) → aontu (unify) → jostraca
(+ sdkgen components/templates) → SDK source`.

---

## Commands

The npm package root is **`ts/`** — run npm there. The top-level
`Makefile` wraps it (`make build`, `make test`, `make check-model`, `make
sync-model`) and runs from the repo root.

```bash
cd ts && npm install
cd ts && npm run build       # tsc --build src test  → ts/dist/ (committed) + ts/dist-test/ (gitignored)
cd ts && npm test            # node --test over dist-test/**/*.test.js
cd ts && npm run test-some --pattern="<name>"   # subset by test name
cd ts && npm run watch       # incremental compile
```

`ts/` is the self-contained npm package root: `package.json`,
`node_modules/`, `bin/`, `build/`, and the shipped `project/` scaffold all
live under it, alongside the tool's own TypeScript (`ts/src/`, `ts/test/`,
compiled to `ts/dist/` and `ts/dist-test/`) — mirroring a generated SDK's
layout. The top-level holds only the shared, non-npm pieces: the canonical
`model/`, `docs/`, and the `Makefile`. **Always build before testing** —
tests run against compiled `ts/dist-test/`.

Environment note: a transitive dep (`shape`) declares `engines.node >=24`.
Builds/tests pass on Node 22 with an `EBADENGINE` warning; ignore it.

---

## The one mental model you must hold

Each language target is generated from **two layers**:

| Layer | Path | Nature | Edit it when… |
| --- | --- | --- | --- |
| **Templates** | `ts/project/.sdk/tm/<lang>/` | Plain target-language source, copied verbatim with placeholder substitution | the broken/changed file looks the **same for every API** (transport, base classes, utilities, runtime) |
| **Components** | `ts/project/.sdk/src/cmp/<lang>/` | TypeScript that **generates** source by walking the model | the file's shape **depends on the entities/operations** (entity classes, the constructor, README, tests) |

Plus the language-neutral components in `ts/src/cmp/` (this package's own
source) which delegate to the per-language ones via `requirePath`.

> Decision rule: *same for every API → template; depends on the API →
> component.*

Full explanation: [components-and-templates](./docs/explanation/components-and-templates.md).

---

## Language parity is CRITICAL

The whole value of sdkgen is that **every target language behaves identically**.
A component or template lives in a per-language directory
(`src/cmp/<lang>/`, `tm/<lang>/`), so the SAME logical concern is implemented
~22 times. **A fix, feature, or behavioural change to one language is almost
never done until it is mirrored across ALL languages that have that
component.** Treat "I fixed it in go" as "I have started fixing it everywhere."

Rules:

- **Fix the class, not the instance.** When you fix a bug in one language's
  component, immediately grep the sibling `src/cmp/*/` files for the same
  shape and fix every one. Enumerate the targets — don't fix the language in
  front of you and move on.
- **`ts`/`js` are the reference implementation.** Bring a change to `ts`/`js`
  first, then port to the rest; check the others against them.
- **Parity is testable.** `ts/test/feature.test.ts` /
  `featuremodel.test.ts` assert cross-language parity — extend them when you
  add behaviour, and expect a parity test to fail loudly if one language drifts.
- **A per-language divergence must be deliberate and commented.** If one
  language genuinely must differ (e.g. go emits a typed struct for EVERY entity
  because go-cli/go-mcp dispatch all entities dynamically, whereas others emit
  only for active entities), say so in a comment at the divergence — otherwise
  a reader can't tell a bug from a decision.

> **Cautionary example (real):** the typed-model emitter filtered structs on the
> lazily-derived `Name` (`filter(null != e.Name)`), silently dropping fieldless
> placeholder entities and producing `undefined: Gon2` in generated Go. The fix
> (derive `Name` via `names()` before emitting) had to land in **all eight**
> `EntityTypes_<lang>` components — go was merely where it surfaced first. Fixing
> only go would have left seven latent copies of the same defect.

---

## Where do I make this change?

| Goal | Edit | Then |
| --- | --- | --- |
| Fix generated **runtime** source (HTTP, base feature, utility) | `ts/project/.sdk/tm/<lang>/…` | propagate (below) |
| Fix generated **API-specific** source (entity, main, readme, tests) | `ts/project/.sdk/src/cmp/<lang>/…` | propagate (below) |
| Change a target's deps / ext / module | `ts/project/.sdk/model/target/<lang>.aontu` | propagate |
| Change a feature's hooks / deps | `ts/project/.sdk/model/feature/<name>.aontu` | propagate |
| Change the **generator core** (CLI, actions, neutral components, helpers) | `ts/src/…` | `cd ts && npm run build && npm test` |
| Change the base model schema | `model/sdkgen.aontu` (canonical) | `make sync-model` then `make build test` |

### Never edit generated output

Files in a generated SDK (`ts/`, `go/`, …) are overwritten by
`generate`/`reset` — generation is **overwrite, not merge**, so any hand-edit is
lost. Fix the **template or component**, then regenerate. Why overwrite (and not
jostraca's 3-way merge, which silently kept stale files and injected `<<<<<<<`
markers on toolchain bumps): [regeneration-overwrite](./docs/explanation/regeneration-overwrite.md).

---

## Propagating a `ts/project/.sdk/` change into a generated SDK

```
edit sdkgen template/component
  └─▶ (consumer .sdk/) npm run add-target <lang>   # copy updated files in
       └─▶ npm run generate                         # substitute + merge into target dir
```

**Merge gotcha:** `generate` merges into existing files, and placeholder
replacement (`ProjectName`, `GOMODULE`, …) is **not** re-applied to
merged content. If you see a literal `ProjectName` in output, delete that
generated file and re-run `generate` to recreate it fresh.

Details: [customize-and-propagate-templates](./docs/how-to/customize-and-propagate-templates.md).
Debugging a failing target: [debug-generation](./docs/how-to/debug-generation.md).

---

## Conventions

- **CommonJS**, strict TypeScript, ES2021 target. Source maps on.
- `ts/dist/` is **committed**; `ts/dist-test/` is gitignored. A clean
  rebuild must leave `ts/dist/` unchanged (deterministic) — if
  `git status` shows `ts/dist/` changes after `npm run build`, commit them
  with your source.
- Index the `kit` namespace with the **`KIT`** constant
  (`getModelPath(model, \`main.${KIT}.entity\`)`), not a hardcoded
  `'kit'`.
- The model is dynamic (aontu metadata: `key$`, `val$`, `Name`, …).
  Typed model interfaces live in `ts/src/types.ts` (`SdkModel`,
  `ModelTarget`, `ModelFeature`, …) with permissive index signatures —
  prefer them over bare `any` at function boundaries.
- `each(...)` iterates objects in **sorted-key order** for deterministic,
  byte-stable output. Do not rely on insertion order.
- **The `ts`/`js` targets are the reference implementation.** When fixing
  one language, check — and fix — the others against `ts`/`js`. Language
  parity is a hard requirement, not a nicety: see
  [Language parity is CRITICAL](#language-parity-is-critical).

---

## Testing

- Node's built-in runner; files are `ts/test/*.test.ts` → `ts/dist-test/*.test.js`.
- Pure helpers (`collectDeps`, `buildIdNames`, `getMatchEntries`,
  `resolveTarget`, `isAuthActive`, `requirePath`) have direct unit tests.
- Components are tested by **rendering them through jostraca into memfs**
  and asserting on the output. Pattern:

  ```ts
  import { Jostraca, Project, Folder, File } from 'jostraca'
  import { memfs } from 'memfs'
  import { ReadmeExplanation } from '../'

  const { fs, vol } = memfs({})
  const jostraca = Jostraca()
  await jostraca.generate({ fs: () => fs, folder: '/x', model }, () => {
    Project({ folder: 'p' }, () => Folder({ name: 'd' }, () => File({ name: 'out.md' }, () => {
      ReadmeExplanation({ target: { name: 'ts' } })
    })))
  })
  // assert on vol.toJSON()
  ```

- `ctx$.model` comes from the `model` option to `generate`. `build: false`
  runs define-only (no file I/O) — handy for counting hook firings.
- **If you change generated *output*, characterize it first.** Capture
  the rendered output before your change and diff after to prove
  intentional vs accidental changes. (This is how `ReadmeExplanation` was
  refactored to a data table with zero output change.)

Validation sequence for a template/component change:

```bash
cd sdkgen && make build test                    # generator healthy (npm runs in ts/)
cd <project>/.sdk && npm run add-target <lang> && npm run generate
cd ../<lang> && <lang-test-command>             # target builds + tests
# re-run ts/js target tests too (reference parity)
```

---

## Sharp edges (already handled — don't reintroduce)

- **`requirePath(ctx$, path, { ignore: true })`** swallows only genuine
  *module-not-found*. A component that resolves but throws while loading
  must propagate — do not wrap it in a blanket try/catch that hides load
  errors.
- **`FeatureHook`** must tolerate an active feature that omits a stage:
  use `feature.hook?.[name]?.active`. Never assume every feature
  implements every hook.
- **Dry run** must be honoured everywhere. Reuse the caller's Jostraca
  instance (`actx.jostraca`); a fresh `Jostraca()` defaults `dryrun:false`
  and will write during a `-y` run.
- **Index updates** (`feature-index` / `target-index`) must be idempotent
  — adding a name already present must not duplicate it.

---

## Project map (this repo)

```
model/sdkgen.aontu     canonical base model schema (mirrored to ts/model/)
Makefile               build/test/check-model/sync-model (wraps ts/ npm)
docs/                  human-oriented documentation
ts/                    the self-contained npm package root (@voxgig/sdkgen)
  package.json         the npm manifest (main: dist/sdkgen.js)
  bin/voxgig-sdkgen    CLI entry
  build/version.js     stamps the version into bin/ at publish time
  model/sdkgen.aontu   npm-shipped mirror of the canonical model/
  src/                 generator core
    sdkgen.ts          SdkGen, makeBuild, public exports
    types.ts           ActionContext + model interfaces
    utility.ts         requirePath, resolvePath, isAuthActive
    action/            target add / feature add / index updates
    cmp/               language-neutral components (delegate per-language)
    helpers/           collectDeps, buildIdNames, getMatchEntries
  test/                Node test runner suites (+ model-mirror guard)
  dist/ (committed)    dist-test/ (gitignored)
  project/.sdk/        the scaffold copied into consumer projects
    model/{target,feature}/   target & feature definitions
    src/cmp/<lang>/    per-language COMPONENTS
    tm/<lang>/         per-language TEMPLATES
```

Targets: `ts js go py php rb lua csharp java kotlin scala swift dart rust c
cpp zig perl clojure elixir ocaml haskell` + `go-cli go-mcp`.

Features (all inactive by default — opt in per SDK via
`options.feature.<name>.active`):

- **Core:** `log` (structured logging), `test` (in-memory mock transport;
  accepts an optional `net` block to simulate latency / failures / offline
  — see [how-to/simulate-network](./docs/how-to/simulate-network.md)).
- **Enterprise:** `retry`, `timeout`, `ratelimit`, `cache`,
  `idempotency`, `paging`, `streaming`, `proxy`, `telemetry`, `metrics`,
  `debug`, `audit`, `clienttrack`, `rbac`.
- **Test support:** `netsim` (wraps any transport to inject network
  conditions; composes with `retry`/`timeout` etc.).

Enterprise features are implemented across **all SDK targets** (each with a
vendored `@voxgig/struct` port and a full offline feature-behaviour test
suite at parity). Two mechanisms: *transport
wrappers* replace `ctx.utility.fetcher` in `init()` (retry, timeout,
ratelimit, cache, proxy, netsim); *pipeline hooks* implement the stages in
[hooks.md](./docs/reference/hooks.md) (idempotency, rbac, metrics,
telemetry, debug, audit, clienttrack, paging, streaming). Behaviour is
covered by `ts/test/feature.test.ts`, which drives the **real template
source** through a simulated pipeline+network offline (see
`ts/test/featureharness.ts`); `ts/test/featuremodel.test.ts` guards
model↔template consistency.

### Generated-SDK test surfaces (ts templates)

Every generated ts SDK ships its own coverage-oriented tests:

- `test/feature.test.ts` + `test/feature/harness.ts` — drive each present
  feature (discovered via `config.makeFeature`) through a mock pipeline;
  `test/netsim.test.ts` covers the `test` feature's `net` simulation.
- `test/pipeline.test.ts` — direct unit tests of the operation-pipeline
  utilities' error/edge branches (missing spec/response, 4xx, transport
  failure, feature ordering, auth shaping) reached via `stdutil`.
- `npm run test-coverage` (or `make coverage`) enforces a coverage floor on
  the SDK source (test files excluded); thresholds live in the generated
  `package.json`. Note: `--enable-source-maps` (used by `npm test`) maps
  coverage back to `.ts` and reads several points **lower** than true `.js`
  coverage — the gate omits it deliberately.

---

## Git / workflow

- Develop on the branch you were given; do not push to others.
- Commit `ts/dist/` changes alongside the `ts/src/` change that produced them.
- Do not create pull requests unless explicitly asked.

---

## Pointers

- Concepts: [architecture](./docs/explanation/architecture.md) ·
  [pipeline](./docs/explanation/operation-pipeline.md)
- Reference: [CLI](./docs/reference/cli.md) ·
  [API](./docs/reference/api.md) · [model](./docs/reference/model.md) ·
  [layout](./docs/reference/project-layout.md) ·
  [hooks](./docs/reference/hooks.md)
- Tasks: [docs/how-to/](./docs/how-to/)
