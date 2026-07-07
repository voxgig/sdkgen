# @voxgig/sdkgen

**Voxgig SDK Generator** — generate idiomatic, multi-language client SDKs
(plus a CLI and an MCP server) from a single API definition.

Point it at an OpenAPI spec and it produces consistent SDKs across
TypeScript, JavaScript, Go, Python, PHP, Ruby, and Lua — each with the
same operation pipeline, the same feature model, generated docs, and an
offline test suite.

```
OpenAPI spec ──▶ model ──▶ [ ts  js  go  py  php  rb  lua  go-cli  go-mcp ]
```

> **Just want to build an SDK for your API?** Start with
> [`create-sdkgen`](https://github.com/voxgig/create-sdkgen) — its
> [`AGENTS.md`](https://github.com/voxgig/create-sdkgen/blob/main/AGENTS.md) walks an agent (or you) from an
> OpenAPI spec to a tested SDK end-to-end. This README is about the generator
> itself.

## How it works in one minute

- An OpenAPI definition is parsed into a structured **model** by
  `@voxgig/apidef`.
- The model is **unified** (by `aontu`) with language-target and feature
  definitions.
- A **code generator** (`jostraca` + this package) walks the model and
  emits SDK source for each target.

Each language target is built from two layers: **templates** (plain
source copied with placeholder substitution — the parts that are the same
for every API) and **components** (TypeScript that generates the
API-specific parts — one class per entity, the constructor, the README,
the tests).

See [Architecture](./docs/explanation/architecture.md) for the full
picture.

## Install

```bash
npm install @voxgig/sdkgen
```

This package is normally consumed through a scaffolded project (created
with `create-sdkgen`) rather than installed directly. It provides:

- the **`voxgig-sdkgen`** CLI (`target add`, `feature add`);
- the **generation engine** (`SdkGen.makeBuild`, used by `@voxgig/model`);
- the **component toolkit** that per-language generators are written
  against.

## Quick start

```bash
# scaffold a project from an OpenAPI spec (uses create-sdkgen)
npm create @voxgig/sdkgen@latest -- mysdk -o mysdk -d ./openapi.yaml

# add a language and generate
cd mysdk/.sdk
voxgig-sdkgen target add ts
voxgig-sdkgen feature add test
npm run build && npm run generate      # → ../ts

# build and test the generated SDK
cd ../ts && npm install && npm run build && npm test
```

The full walkthrough is in the [Tutorial](./docs/tutorial.md).

## Documentation

Comprehensive docs live in [`docs/`](./docs/README.md):

| | |
| --- | --- |
| **[Tutorial](./docs/tutorial.md)** | Generate your first SDK, end to end. |
| **[How-to guides](./docs/how-to/)** | Add a target/feature, customize templates, author a language, debug, use the API. |
| **[Reference](./docs/reference/)** | [CLI](./docs/reference/cli.md) · [API](./docs/reference/api.md) · [Model schema](./docs/reference/model.md) · [Layout](./docs/reference/project-layout.md) · [Hooks](./docs/reference/hooks.md). |
| **[Explanation](./docs/explanation/)** | [Architecture](./docs/explanation/architecture.md) · [Components vs templates](./docs/explanation/components-and-templates.md) · [Operation pipeline](./docs/explanation/operation-pipeline.md). |

**Automated coding agents:** start with [`AGENTS.md`](./AGENTS.md).

## What a generated SDK gives you

- One entity class per API entity, with `load` / `list` / `create` /
  `update` / `remove` where supported.
- A staged operation pipeline (`PrePoint → PreSpec → PreRequest →
  PreResponse → PreResult → PreDone`) that **features** hook into for
  logging, auth, retries, or a mock transport — without forking the SDK.
- `direct()` / `prepare()` escape hatches for endpoints outside the
  entity model.
- Generated `README.md` and `REFERENCE.md`, and an offline test suite.

## Develop this package

The npm package root is `ts/`. Run npm there, or use the top-level
`Makefile` (`make build`, `make test`) which wraps it.

```bash
cd ts && npm install
cd ts && npm run build   # tsc --build src test  (→ ts/dist/, ts/dist-test/)
cd ts && npm test        # Node test runner over dist-test/**/*.test.js
cd ts && npm run test-some --pattern="<name>"   # run a subset by test name
cd ts && npm run watch   # incremental compile
```

`ts/` is the self-contained npm package root: `package.json`, `bin/`,
`build/`, `node_modules/`, and the shipped `project/` scaffold live under
it, alongside the tool's own TypeScript (`ts/src/` source, `ts/test/`
tests, compiled to `ts/dist/` and `ts/dist-test/`). The canonical model
lives at top-level `model/` and is mirrored into `ts/model/` (npm can only
ship files under the package root) — edit `model/`, then `make sync-model`.
Always build before testing — tests run against `ts/dist-test/`. `ts/dist/`
is committed; `ts/dist-test/` is not.

## Related projects

- **`@voxgig/apidef`** — parses OpenAPI into the model.
- **`create-sdkgen`** — scaffolds new SDK projects.
- **`@voxgig/model`** — orchestrates a build (calls `SdkGen.makeBuild`).
- **`jostraca`** — the code-generation engine.
- **`aontu`** — data unification.

## License

MIT © Richard Rodger
