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

## Validating Template Changes (End-to-End)

Template changes (in `project/.sdk/src/cmp/ts/fragment/`, `project/.sdk/tm/ts/`, etc.) must be validated by generating a real SDK and running its tests. The solardemo SDK is the reference project.

### Steps

1. **Build sdkgen:** `npm run build` (in this project)
2. **Remove old SDK:** `rm -rf ~/Projects/voxgig-sdk/voxgig-solardemo-sdk`
3. **Create fresh SDK:** In `~/Projects/voxgig-sdk`:
   ```
   npm create @voxgig/sdkgen@latest -- solardemo -o voxgig-solardemo-sdk \
     -d old-voxgig-solardemo-sdk/app/def/solardemo-1.0.0-openapi-3.0.0.yaml
   ```
   Or use local create-sdkgen if test data changed:
   ```
   ~/Projects/voxgig/create-sdkgen/bin/create-sdkgen solardemo \
     -o voxgig-solardemo-sdk \
     -d old-voxgig-solardemo-sdk/app/def/solardemo-1.0.0-openapi-3.0.0.yaml
   ```
4. **Link local sdkgen:** In `.sdk/`:
   ```
   rm -rf node_modules/@voxgig/sdkgen
   mkdir -p node_modules/@voxgig/sdkgen
   rsync -a --exclude node_modules --exclude .git ~/Projects/voxgig/sdkgen/ node_modules/@voxgig/sdkgen/
   ```
   (Symlinks don't work — Node resolves real paths and can't find peer deps.)
5. **Generate SDK:** In `.sdk/`:
   ```
   npm run add-target ts && npm run add-feature test && npm run build && npm run generate
   ```
6. **Test generated SDK:** In `ts/`:
   ```
   npm install && npm run build && npm test
   ```

### If test data (`.jsonic`) changed

Test data lives in `~/Projects/voxgig/create-sdkgen/project/standard/.sdk/test/`. After editing `.jsonic` files, regenerate `test.json` in the generated SDK's `.sdk/`:
```
npm run test-model
```
Then rebuild and retest the SDK (`ts/` dir).

### Related projects
- **create-sdkgen** (`~/Projects/voxgig/create-sdkgen`) — scaffolds new SDK projects; owns test `.jsonic` data in `project/standard/.sdk/test/`
- **Generated SDK** (`~/Projects/voxgig-sdk/voxgig-solardemo-sdk`) — the test target; `ts/` has the TypeScript SDK, `.sdk/` has the build tooling
