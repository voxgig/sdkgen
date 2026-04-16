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

## Debugging Generated SDK Targets

When a language target fails to build or test in the solardemo SDK, follow this process:

### 1. Identify where the error lives
- Build/compile errors in the generated SDK (e.g. `go build ./...` fails) point to either a **template file** (`project/.sdk/tm/<lang>/`) or a **component file** (`project/.sdk/src/cmp/<lang>/`).
- Template (`tm/`) files are plain source copied by the `Copy()` mechanism with placeholder replacement (`ProjectName` → `Solardemo`, `GOMODULE` → actual module path, etc.).
- Component (`src/cmp/`) files are TypeScript that *generate* source code via `Content()`, `File()`, etc.

### 2. Always fix in sdkgen templates, never in generated output
- Generated files in the SDK (`go/`, `ts/`, `js/`, etc.) are overwritten by `npm run reset` / `npm run generate`.
- Fix the bug in the sdkgen template (`project/.sdk/tm/`) or component (`project/.sdk/src/cmp/`), then regenerate.

### 3. Propagation pipeline — getting template changes into the generated SDK
The pipeline is: **sdkgen template → `add-target` → SDK `.sdk/tm/` → `generate` → SDK target dir**.

1. Edit the template in sdkgen: `project/.sdk/tm/<lang>/...`
2. In the SDK's `.sdk/` dir, run `npm run add-target <lang>` — this copies updated templates into `.sdk/tm/<lang>/`
3. Run `npm run generate` — this applies placeholder replacements and merges into the target dir

**Critical**: `generate` uses a merge strategy. If the target file already exists, changed lines from the template may merge in but **placeholder replacements (e.g. `ProjectName`, `GOMODULE`) are NOT applied to merged content**. To force a clean copy with full replacement:
- Delete the specific generated file from the target dir (e.g. `rm go/feature/log_feature.go`)
- Then run `npm run generate` — it will create the file fresh with all replacements applied

### 4. Cross-language consistency
- When fixing a template for one language, check if the same pattern exists in other language templates. The JS/TS targets are the reference implementation — compare against them.
- Test runner logic (e.g. regex matching in `runner_test.go`) should match the JS runner behavior in `js/test/runner.js`.

### 5. Validation sequence
After fixing templates:
```
cd sdkgen && npm run build && npm test          # sdkgen itself still works
cd solardemo-sdk/.sdk
npm run add-target <lang>                        # copy updated templates
npm run generate                                 # regenerate SDK
cd ../<lang> && <lang-test-command>              # run target tests
```
Also re-run TS and JS tests to confirm no regressions.
