# CLAUDE.md - Project Guide for Claude Code

## Project
Voxgig SDK Generator (`@voxgig/sdkgen`) - generates SDKs from API definitions.

## Build & Test
- **Build:** `npm run build` (TypeScript, compiles `src/` → `dist/`, `test/` → `dist-test/`)
- **Test:** `npm test` (Node.js built-in test runner, runs `dist-test/**/*.test.js`)
- **Test subset:** `npm run test-some --pattern="<pattern>"` (matches test names)
- **Watch:** `npm run watch` (TypeScript watch mode)
- **Always build before testing** — tests run against compiled JS in `dist-test/`.

## Code Structure
- `src/` — TypeScript source (CommonJS, ES2021 target)
  - `sdkgen.ts` — main entry point
  - `types.ts` — type definitions
  - `utility.ts` — utility functions
  - `action/` — action handlers (action, feature, target)
  - `cmp/` — components (Entity, Feature, Main, Readme*, Test, etc.)
- `test/` — tests (`*.test.ts`)
- `model/` — model definitions (`.jsonic` format)
- `project/` — project templates
- `dist/` — compiled output (committed)
- `dist-test/` — compiled tests (not committed)

## Key Dependencies (peer)
- `jostraca` — code generation engine
- `aontu` — data unification
- `@voxgig/struct`, `@voxgig/util`, `@voxgig/apidef` — Voxgig shared libs

## Conventions
- CommonJS (`"type": "commonjs"`)
- Strict TypeScript
- Source maps enabled for debugging

## Related Projects
- **apidef** (`~/Projects/voxgig/apidef`) — parses OpenAPI definitions into the model used by sdkgen
- **create-sdkgen** (`~/Projects/voxgig/create-sdkgen`) — scaffolds new SDK projects; owns test `.jsonic` data in `project/standard/.sdk/test/`
- **Generated SDK** (`~/Projects/voxgig-sdk/voxgig-solardemo-sdk`) — the solardemo reference SDK; `ts/` has the TypeScript SDK, `.sdk/` has the build tooling
