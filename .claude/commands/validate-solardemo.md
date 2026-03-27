# Validate Solardemo SDK

Regenerate the solardemo SDK from scratch using local template changes and run all tests. Use this after making changes to templates in `project/.sdk/src/cmp/ts/fragment/`, `project/.sdk/tm/ts/`, or test data in `~/Projects/voxgig/create-sdkgen/project/standard/.sdk/test/`.

## Steps

### 1. Build sdkgen

```
npm run build
```

### 2. Remove old SDK

```
rm -rf ~/Projects/voxgig-sdk/voxgig-solardemo-sdk
```

### 3. Create fresh SDK

In `~/Projects/voxgig-sdk`, using the published create-sdkgen:
```
npm create @voxgig/sdkgen@latest -- solardemo -o voxgig-solardemo-sdk \
  -d old-voxgig-solardemo-sdk/app/def/solardemo-1.0.0-openapi-3.0.0.yaml
```

Or use local create-sdkgen if test data (`.jsonic`) changed:
```
~/Projects/voxgig/create-sdkgen/bin/create-sdkgen solardemo \
  -o voxgig-solardemo-sdk \
  -d old-voxgig-solardemo-sdk/app/def/solardemo-1.0.0-openapi-3.0.0.yaml
```

### 4. Link local sdkgen

In `~/Projects/voxgig-sdk/voxgig-solardemo-sdk/.sdk/`:
```
rm -rf node_modules/@voxgig/sdkgen
mkdir -p node_modules/@voxgig/sdkgen
rsync -a --exclude node_modules --exclude .git ~/Projects/voxgig/sdkgen/ node_modules/@voxgig/sdkgen/
```
Symlinks don't work — Node resolves real paths and can't find peer deps.

### 5. Generate SDK

In `.sdk/`:
```
npm run add-target ts && npm run add-feature test && npm run build && npm run generate
```

Then rebuild the test data:
```
npm run test-model
```

### 6. Test generated SDK

In `~/Projects/voxgig-sdk/voxgig-solardemo-sdk/ts/`:
```
npm install && npm run build && npm test
```
All 128 tests should pass.

## Live testing against the test HTTP server

The solardemo test server is in `~/Projects/voxgig-sdk/old-voxgig-solardemo-sdk/app/`.

### Start the server
```
cd ~/Projects/voxgig-sdk/old-voxgig-solardemo-sdk/app
npm run build && npm start
```
Server runs on port 8901.

### Run live tests
In the generated SDK's `ts/` dir:
```
SOLARDEMO_TEST_LIVE=TRUE SOLARDEMO_TEST_MOON_ENTID='{"planet01":"mars"}' npm test
```
All tests should pass against the live server.

### Verify connection errors
Stop the server (`kill` or Ctrl-C), then re-run the same live test command. Entity and direct tests should fail with `ECONNREFUSED` errors — this confirms the SDK correctly attempts real HTTP calls in live mode.

## If test data (`.jsonic`) changed

Test data source lives in `~/Projects/voxgig/create-sdkgen/project/standard/.sdk/test/`. After editing `.jsonic` files:
1. Rebuild `test.json` in create-sdkgen: `cd ~/Projects/voxgig/create-sdkgen/project/standard/.sdk && npm run test-model`
2. Use the local create-sdkgen binary in step 3 above
3. Also run `npm run test-model` in the generated SDK's `.sdk/` dir (step 5)

## Related projects
- **create-sdkgen** (`~/Projects/voxgig/create-sdkgen`) — scaffolds new SDK projects; owns test `.jsonic` data in `project/standard/.sdk/test/`
- **Generated SDK** (`~/Projects/voxgig-sdk/voxgig-solardemo-sdk`) — the test target; `ts/` has the TypeScript SDK, `.sdk/` has the build tooling
