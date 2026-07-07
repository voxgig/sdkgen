# CLAUDE.md - Project Guide for Claude Code

## Documentation
- **[`AGENTS.md`](./AGENTS.md)** — the canonical operating guide for coding
  agents (mental model, where-to-edit table, propagation pipeline,
  conventions, sharp edges). Read it first.
- **[`docs/`](./docs/README.md)** — full documentation: tutorial, how-to
  guides, reference (CLI/API/model/layout/hooks), and explanation.

This file is the quick inline reference; `AGENTS.md` and `docs/` have the
depth.

## Project
Voxgig SDK Generator (`@voxgig/sdkgen`) — generates idiomatic
multi-language client SDKs (ts, js, go, py, php, rb, lua, plus go-cli and
go-mcp) from an OpenAPI-derived model.

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
  - `action/` — action handlers (`action`, `feature`, `target`; includes `resolveTarget`)
  - `cmp/` — language-neutral components (Entity, Feature, Main, Readme*, Test, FeatureHook)
  - `helpers/` — `collectDeps`, `buildIdNames`, `getMatchEntries`
- `ts/test/` — tests (`*.test.ts`)
- `ts/dist/` — compiled output (committed); `ts/dist-test/` — compiled tests (gitignored)
- `model/sdkgen.aontu` — canonical base model schema. npm can only ship
  files under the package root, so it is mirrored to `ts/model/sdkgen.aontu`
  (shipped as `@voxgig/sdkgen/model/sdkgen.aontu`). Edit `model/`, then
  `make sync-model`; a `ts/test/model-mirror.test.ts` guard fails on drift.
- `ts/project/.sdk/` — the scaffold: per-language `tm/` (templates) and `src/cmp/` (components) + `model/`

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

## Related Projects
- **apidef** (`~/Projects/voxgig/apidef`) — parses OpenAPI definitions into the model used by sdkgen
- **create-sdkgen** (`~/Projects/voxgig/create-sdkgen`) — scaffolds new SDK projects; owns test `.jsonic` data in `project/standard/.sdk/test/`
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
