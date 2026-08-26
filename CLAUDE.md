# CLAUDE.md - Project Guide for Claude Code

## Documentation
- **[`AGENTS.md`](./AGENTS.md)** — the canonical operating guide for coding
  agents (mental model, where-to-edit table, propagation pipeline,
  conventions, sharp edges). Read it first.
- **[`docs/`](./docs/README.md)** — full documentation: tutorial, how-to
  guides, reference (features/CLI/API/model/layout/hooks), and explanation.

This file is the quick inline reference; `AGENTS.md` and `docs/` have the
depth.

## Project
Voxgig SDK Generator (`@voxgig/sdkgen`) — generates idiomatic
multi-language client SDKs (ts, js, go, py, php, rb, lua, csharp, java,
kotlin, scala, swift, dart, rust, c, cpp, zig, perl, clojure, elixir, ocaml,
plus go-cli and go-mcp) from an OpenAPI-derived model. `haskell` ships
separately, in `packages/sdkgen-haskell`.

## Build & Test
The npm package root is **`ts/`** — run npm commands there, or use the
top-level `Makefile` (`make build`, `make test`, `make check-model`) which
wraps them.
- **Build:** `cd ts && npm run build` (TypeScript, compiles `src/` → `dist/`, `test/` → `dist-test/`)
- **Test:** `cd ts && npm test` (Node.js built-in test runner, runs `dist-test/**/*.test.js`)
- **Test subset:** `cd ts && npm run test-some --pattern="<pattern>"` (matches test names)
- **Watch:** `cd ts && npm run watch` (TypeScript watch mode)
- **Always build before testing** — tests run against compiled JS in `ts/dist-test/`.
- A transitive dep (`shape`) wants Node ≥24; on Node 22 you get a harmless `EBADENGINE` warning.

## Code Structure
`ts/` is the self-contained npm package root — `package.json`,
`package-lock.json`, `node_modules/`, `bin/`, `build/`, and the shipped
`project/` scaffold all live under it (mirrors a generated SDK's layout).
The top-level holds only the shared, non-npm pieces: the canonical
`model/`, `docs/`, and the `Makefile`.
- `ts/src/` — TypeScript source (CommonJS, ES2021 target)
  - `sdkgen.ts` — main entry point (`SdkGen`, `makeBuild`, public exports)
  - `types.ts` — `ActionContext` + model interfaces (`SdkModel`, `ModelTarget`, …)
  - `utility.ts` — `requirePath`, `resolvePath`, `isAuthActive`, `SdkGenError`
  - `action/` — the verbs: `dispatch` (ACTION_MAP from the kind registry),
    `kind` (KINDS + the shared add spine), `resolve` (ref → source,
    provenance, name collisions), `target`, `feature`, `package`, `doctor`
  - `cmp/` — language-neutral components (Entity, Feature, Main, Readme*, Test, FeatureHook)
  - `helpers/` — `collectDeps`, `buildIdNames`, `getMatchEntries`,
    `definition` (where a kind's model files live), `manifest`
    (`sdkgen-package.json`), `semver` (the engines subset), `stdrep`
    (the replace maps add writes and doctor re-applies)
- `ts/test/` — tests (`*.test.ts`)
- `ts/dist/` — compiled output (committed); `ts/dist-test/` — compiled tests (gitignored)
- `model/sdkgen.aontu` — canonical base model schema. npm can only ship
  files under the package root, so it is mirrored to `ts/model/sdkgen.aontu`
  (shipped as `@voxgig/sdkgen/model/sdkgen.aontu`). Edit `model/`, then
  `make sync-model`; a `ts/test/model-mirror.test.ts` guard fails on drift.
- `ts/project/` — an sdkgen package like any other: `sdkgen-package.json`
  (its manifest, pinned to the directory listings by a guard test) beside
  `.sdk/` — the scaffold: per-language `tm/` (templates) and `src/cmp/`
  (components) + `model/`

## Content can come from OUTSIDE this package
An **sdkgen package** is any folder with a `sdkgen-package.json` manifest
beside a `.sdk/` shaped like `ts/project/.sdk` — from npm, a checkout, or
a local path. `ts/project/` is itself one, which keeps the bundled and
external paths on the same code.

```bash
voxgig-sdkgen package add @acme/sdkgen-iot    # everything it provides
voxgig-sdkgen package list                    # what is installed, from where
voxgig-sdkgen package update @acme/sdkgen-iot # fetch newer + refresh
voxgig-sdkgen package check                   # AUTHORING: validate a package
```

Three things to hold when touching `ts/src/action/`:
- **Never assume the bundled scaffold.** Each copied model file records
  `base` / `origname` / `package`, and resolution reads that.
- **`add` is overwrite** — that is how a resync works. `doctor` is the
  safety net, so anything an add writes, doctor must compare, or the next
  add silently reverts a project's edit.
- **One rule, one place.** Path conventions, name grammars and provenance
  reconstruction each live in exactly one function. This subsystem has
  produced the same-rule-written-twice defect five times.

See [`docs/design/sdkgen-packages.md`](./docs/design/sdkgen-packages.md)
and AGENTS.md's "Sharp edges".

## Two-layer generation (the key idea)
Each target = **templates** (`ts/project/.sdk/tm/<lang>/`, copied verbatim
with placeholder substitution — same for every API) + **components**
(`ts/project/.sdk/src/cmp/<lang>/`, TypeScript that generates API-specific
source). Rule: *same for every API → template; depends on the API →
component.* See [docs/explanation/components-and-templates](./docs/explanation/components-and-templates.md).

## Key Dependencies (peer)
- `jostraca` — code generation engine
- `aontu` — data unification
- `@voxgig/struct`, `@voxgig/util`, `@voxgig/apidef` — Voxgig shared libs

## Conventions
- CommonJS (`"type": "commonjs"`), strict TypeScript, source maps on.
- Index the kit namespace with the `KIT` constant, not a hardcoded `'kit'`.
- `each(...)` iterates in sorted-key order — output is byte-stable; don't rely on insertion order.
- The `ts`/`js` targets are the reference implementation; keep other languages in parity.
- Commit `ts/dist/` changes with the `ts/src/` change that produced them.
- Two entity views, picked by the question you are asking. To decide WHAT TO
  EMIT, use `getModelPath(model, \`main.${KIT}.entity\`)` — active-filtered,
  which is what `active: false` exists for. To get the whole NAME-SPACE (class
  names, type collisions), use `entityCollection(model)` — unfiltered and
  memoised, because `EntityTypes` emits types for inactive entities too.
  Never read the raw `model.main[KIT].entity` map. See AGENTS.md.
- `entity.op` is optional: `entity.op || {}`, `entity.op?.load`.
- `npm run build` also type-checks `ts/project/.sdk/src/cmp/**`
  (`check-scaffold`) and the fixture package's components
  (`check-fixture`, `ts/test/fixture/**`); neither tree is visible to
  `tsc --build src test`. It then
  `stage-scaffold`s a miniature consumer into `ts/dist-test-scaffold/` so
  `ts/test/generate.test.ts` can generate a small SDK for every target into
  memfs and assert on the output — the only suite that RUNS the per-language
  components. See AGENTS.md.
- Parity tiers and the zero-case corpus guard live in `ts/test/parity.test.ts`
  — see AGENTS.md "Language parity is CRITICAL".

## Related Projects
- **apidef** (`~/Projects/voxgig/apidef`) — parses OpenAPI definitions into the model used by sdkgen
- **create-sdkgen** (`~/Projects/voxgig/create-sdkgen`) — scaffolds new SDK projects; owns test `.aontu` data in `project/standard/.sdk/test/`
- **Generated SDK** (`~/Projects/voxgig-sdk/voxgig-solardemo-sdk`) — the solardemo reference SDK; `ts/` has the TypeScript SDK, `.sdk/` has the build tooling

## Debugging generated targets (summary)
Fix bugs in the sdkgen **template/component**, never in generated output
(it's overwritten). Propagate: edit → (consumer `.sdk/`)
`npm run add-target <lang>` → `npm run generate`.

**Merge gotcha:** `generate` merges into existing files and does **not**
re-apply placeholder replacement (`ProjectName`, `GOMODULE`) to merged
content. If you see a literal placeholder, `rm` that generated file and
regenerate it fresh.

Full process: [docs/how-to/debug-generation](./docs/how-to/debug-generation.md)
and [docs/how-to/customize-and-propagate-templates](./docs/how-to/customize-and-propagate-templates.md).

Validation sequence:
```
cd sdkgen && make build test                    # sdkgen itself still works (npm runs in ts/)
cd solardemo-sdk/.sdk
npm run add-target <lang>                        # copy updated templates
npm run generate                                 # regenerate SDK
cd ../<lang> && <lang-test-command>              # run target tests
```
Also re-run TS and JS tests to confirm no regressions.
