# @voxgig/sdkgen

**Voxgig SDK Generator** — generate idiomatic, multi-language client SDKs
(plus a CLI, an MCP server, an analyst-oriented data package and a Seneca
plugin) from a single API definition.

Point it at an OpenAPI spec and it produces consistent SDKs across 23
languages — TypeScript, JavaScript, Go, Python, PHP, Ruby, Lua, and the
rest — each with the same operation pipeline, the same feature model,
generated docs, and an offline test suite.

```
OpenAPI spec ──▶ model ──┬─▶ 22 bundled language SDKs
                         │     ts  js  go  py  php  rb  lua  csharp  java
                         │     kotlin  scala  swift  rust  c  cpp
                         │     zig  perl  clojure  elixir  ocaml
                         │
                         ├─▶ more from packs
                         │     dart, haskell, lean  (@voxgig/sdkgen-langpack)
                         │     seneca-provider      (@voxgig/sdkgen-infrapack)
                         │                          (ts — into its own repo)
                         │
                         └─▶ 3 consumer targets, each wrapping one of them
                               go-cli, go-mcp (go)   py-data (py)
```

> **Just want to build an SDK for your API?** Start with
> [`create-sdkgen`](https://github.com/voxgig/create-sdkgen), which walks
> you (or an agent) from an OpenAPI spec to a tested SDK end-to-end. This
> README is about the generator itself.

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

The full documentation lives in [`docs/`](./docs/README.md):

| | |
| --- | --- |
| **[Tutorial](./docs/tutorial.md)** | Generate your first SDK, end to end. |
| **[How-to guides](./docs/how-to/)** | Add a target/feature, customize templates, author a language, debug, use the API. |
| **[Reference](./docs/reference/)** | [Features](./docs/reference/features.md) · [CLI](./docs/reference/cli.md) · [API](./docs/reference/api.md) · [Model schema](./docs/reference/model.md) · [Layout](./docs/reference/project-layout.md) · [Hooks](./docs/reference/hooks.md). |
| **[Explanation](./docs/explanation/)** | [Architecture](./docs/explanation/architecture.md) · [Components vs templates](./docs/explanation/components-and-templates.md) · [Operation pipeline](./docs/explanation/operation-pipeline.md). |

**Working on the generator itself?** Fix the template or component, never
a generated file (generation overwrites), and mirror a per-language change
across every target that has the same component.
[Debug a failing generated target](./docs/how-to/debug-generation.md) has
the loop.

## What a generated SDK gives you

- One entity class per API entity, with `load` / `list` / `create` /
  `update` / `remove` where supported.
- A staged operation pipeline (`PrePoint → PreSpec → PreRequest →
  PreResponse → PreResult → PreDone`) that **features** plug into —
  without forking the SDK.
- **Eighteen features**, in every language (see below).
- `direct()` / `prepare()` escape hatches for endpoints outside the
  entity model.
- Generated `README.md` and `REFERENCE.md`, and an offline test suite.

## Features: the production behaviour, generated in

The parts of a client library that take the longest to get right are not
the endpoint wrappers. They are retries that back off properly, a cache
that does not serve a consumed response body, idempotency keys that stay
stable across a retry, pagination that stops at the last page, a spend
ceiling an agent cannot blow through. sdkgen
ships those as **features**: opt-in, configurable, and implemented once
per language rather than once per API.

| | |
| --- | --- |
| **Resilience** | `retry` `timeout` `ratelimit` `cache` |
| **Correct writes** | `idempotency` |
| **Large result sets** | `paging` `streaming` |
| **Observability** | `telemetry` `metrics` `audit` `debug` `log` `clienttrack` |
| **Governance** | `rbac` `proxy` `cost` |
| **Credentials** | `secrets` `validate` |
| **Testing** | `test` `netsim` |

```bash
voxgig-sdkgen feature add retry,timeout,idempotency
```

```ts
const client = new MyapiSDK({
  feature: {
    retry:       { active: true, retries: 4, maxDelay: 5000 },
    timeout:     { active: true, ms: 10000 },
    idempotency: { active: true },
  },
})
```

Every feature is off until you switch it on, and every one of them is
implemented for **every bundled language target** — so `retry` means the
same thing in Go as it does in TypeScript.

**→ [The feature catalogue](./docs/reference/features.md)** documents each
one in full: options, defaults, hooks, what it records, and how they
compose.

### Credentials: every sekreto provider is available, and you choose

`secrets` resolves the API credential through a
[sekreto](https://github.com/voxgig/sekreto) provider chain rather than from
a hard-coded `apikey`. **A generated SDK can reach every provider kind
sekreto ships** — the chain is a project decision, made in the model, not a
limit built into the generator.

Four kinds are BUILT IN and always present: `env`, `memory`, `dotenv`,
`file`. Everything else is a **plugin group** — a set of provider modules
that ships only when the project asks for it, because each carries a real
platform cost:

| group | provider kinds | needs |
| --- | --- | --- |
| `vault` | `hashicorp` `boru` | `fs`, `fetch` |
| `cloud` | `gcpsecrets` `azuresecrets` | `fetch` |
| `saas` | `onepassword` `doppler` `infisical` | `fetch` |
| `aws` | `awssecrets` `awsparams` (SigV4 signing) | `fetch`, `crypto` |
| `secretspec` | `secretspec` CLI bridge | `fs` |

Everything is off until asked for. Turn the feature on, activate the groups
your chain names, and declare the chain — all three in `.sdk/model/project.aon`,
the model file that is yours and survives regeneration:

```
main: kit: feature: secrets: {
  active: true
  plugin: vault: active: true
  config: options: {
    name: 'univec'
    providers: [{ kind: 'boru', namespace: 'sdk' }]
  }
}
```

**Why groups rather than everything, always.** Before the split, one import
reached all of them, so an SDK whose chain was `[dotenv, env]` still linked
AWS request signing and seven HTTP vault clients. The trim removes an
inactive group exactly as it removes an inactive feature. A group your chain
names but you did not activate is the one mistake to watch for: the kind is
then unknown to the SDK at run time.

An inactive group costs nothing, and a target that cannot meet a group's
`needs` is refused at generation rather than at the consumer's first lookup.
The feature reaches every target whose container carries a vendored sekreto
— **20 of them** today, and no longer TypeScript alone.

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
lives in `ts/model/` and ships directly from there. Edit that file in place.
This README holds the full documentation; `ts/README.md` is a short
package summary linking here. The license text lives in `ts/LICENSE`.
Content is not mirrored between the repository and package roots.
Always build before testing — tests run against `ts/dist-test/`. `ts/dist/`
is committed; `ts/dist-test/` is not.

## Related projects

- **`@voxgig/apidef`** — parses OpenAPI into the model.
- **`create-sdkgen`** — scaffolds new SDK projects.
- **`@voxgig/model`** — orchestrates a build (calls `SdkGen.makeBuild`).
- **`jostraca`** — the code-generation engine.
- **`aontu`** — data unification.

## License

[MIT](ts/LICENSE) © Richard Rodger
