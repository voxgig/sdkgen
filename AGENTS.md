# AGENTS.md — operating guide for AI coding agents

This is the manual for automated agents working in or with
`@voxgig/sdkgen`. It is intentionally dense. Read it before making
changes; it will save you a broken build.

Human-oriented docs live in [`docs/`](./docs/README.md) (tutorial,
how-to, reference, explanation). This file is the agent-facing summary
plus the gotchas.

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

Pipeline: `OpenAPI → apidef → model (.jsonic) → aontu (unify) → jostraca
(+ sdkgen components/templates) → SDK source`.

---

## Commands

```bash
npm install
npm run build       # tsc --build src test  → dist/ (committed) + dist-test/ (gitignored)
npm test            # node --test over dist-test/**/*.test.js
npm run test-some --pattern="<name>"   # subset by test name
npm run watch       # incremental compile
```

**Always build before testing** — tests run against compiled `dist-test/`.
There are currently 48 tests across `test/*.test.ts`.

Environment note: a transitive dep (`shape`) declares `engines.node >=24`.
Builds/tests pass on Node 22 with an `EBADENGINE` warning; ignore it.

---

## The one mental model you must hold

Each language target is generated from **two layers**:

| Layer | Path | Nature | Edit it when… |
| --- | --- | --- | --- |
| **Templates** | `project/.sdk/tm/<lang>/` | Plain target-language source, copied verbatim with placeholder substitution | the broken/changed file looks the **same for every API** (transport, base classes, utilities, runtime) |
| **Components** | `project/.sdk/src/cmp/<lang>/` | TypeScript that **generates** source by walking the model | the file's shape **depends on the entities/operations** (entity classes, the constructor, README, tests) |

Plus the language-neutral components in `src/cmp/` (this package's own
source) which delegate to the per-language ones via `requirePath`.

> Decision rule: *same for every API → template; depends on the API →
> component.*

Full explanation: [components-and-templates](./docs/explanation/components-and-templates.md).

---

## Where do I make this change?

| Goal | Edit | Then |
| --- | --- | --- |
| Fix generated **runtime** source (HTTP, base feature, utility) | `project/.sdk/tm/<lang>/…` | propagate (below) |
| Fix generated **API-specific** source (entity, main, readme, tests) | `project/.sdk/src/cmp/<lang>/…` | propagate (below) |
| Change a target's deps / ext / module | `project/.sdk/model/target/<lang>.jsonic` | propagate |
| Change a feature's hooks / deps | `project/.sdk/model/feature/<name>.jsonic` | propagate |
| Change the **generator core** (CLI, actions, neutral components, helpers) | `src/…` | `npm run build && npm test` |
| Change the base model schema | `model/sdkgen.jsonic` | `npm run build && npm test` |

### Never edit generated output

Files in a generated SDK (`ts/`, `go/`, …) are overwritten by
`generate`/`reset`. Fix the **template or component**, then regenerate.

---

## Propagating a `project/.sdk/` change into a generated SDK

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
- `dist/` is **committed**; `dist-test/` is gitignored. A clean rebuild
  must leave `dist/` unchanged (deterministic) — if `git status` shows
  `dist/` changes after `npm run build`, commit them with your source.
- Index the `kit` namespace with the **`KIT`** constant
  (`getModelPath(model, \`main.${KIT}.entity\`)`), not a hardcoded
  `'kit'`.
- The model is dynamic (aontu metadata: `key$`, `val$`, `Name`, …).
  Typed model interfaces live in `src/types.ts` (`SdkModel`,
  `ModelTarget`, `ModelFeature`, …) with permissive index signatures —
  prefer them over bare `any` at function boundaries.
- `each(...)` iterates objects in **sorted-key order** for deterministic,
  byte-stable output. Do not rely on insertion order.
- **The `ts`/`js` targets are the reference implementation.** When fixing
  one language, check the others against `ts`/`js`.

---

## Testing

- Node's built-in runner; files are `test/*.test.ts` → `dist-test/*.test.js`.
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
cd sdkgen && npm run build && npm test          # generator healthy
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
bin/voxgig-sdkgen      CLI entry
model/sdkgen.jsonic    base model schema
src/                   generator core (TypeScript)
  sdkgen.ts            SdkGen, makeBuild, public exports
  types.ts             ActionContext + model interfaces
  utility.ts           requirePath, resolvePath, isAuthActive
  action/              target add / feature add / index updates
  cmp/                 language-neutral components (delegate per-language)
  helpers/             collectDeps, buildIdNames, getMatchEntries
project/.sdk/          the scaffold copied into consumer projects
  model/{target,feature}/   target & feature definitions
  src/cmp/<lang>/      per-language COMPONENTS
  tm/<lang>/           per-language TEMPLATES
test/                  Node test runner suites
dist/ (committed)  dist-test/ (gitignored)
```

Targets: `ts js go py php rb lua` + `go-cli go-mcp`. Features: `log test`.

---

## Git / workflow

- Develop on the branch you were given; do not push to others.
- Commit `dist/` changes alongside the `src/` change that produced them.
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
