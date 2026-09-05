# Voxgig SDK Generator — Documentation

`@voxgig/sdkgen` turns an API definition into idiomatic, multi-language
client SDKs (plus a CLI and an MCP server) from a single source of truth.

> **Building an SDK for your own API?** Start at
> [`create-sdkgen`](https://github.com/voxgig/create-sdkgen), which walks
> you from an OpenAPI spec through scaffold, generate, and test. The
> material here documents the generator itself in depth.

This documentation is organised into four kinds of material. Pick the one
that matches what you are trying to do right now:

| If you want to… | Go to | Nature |
| --- | --- | --- |
| **Learn the tool** by building something end-to-end | [Tutorial](./tutorial.md) | Follow the steps; no decisions required |
| **Get a specific job done** (add a language, a feature, debug a build) | [How-to guides](./how-to/) | Goal-oriented recipes |
| **Look something up** (features, CLI flags, API, model schema, hooks) | [Reference](./reference/) | Dry, complete, accurate |
| **Understand how and why it works** | [Explanation](./explanation/) | Background and design |

## Map

### Tutorial
- [Generate your first SDK](./tutorial.md)

### How-to guides
- [Add a language target](./how-to/add-a-target.md)
- [Add a feature](./how-to/add-a-feature.md)
- [Use an sdkgen package](./how-to/use-an-sdkgen-package.md)
- [Use voxgig/station with a generated SDK](./how-to/use-station.md)
- [Author an sdkgen package](./how-to/author-an-sdkgen-package.md)
- [Migrate a bundled target into a package](./how-to/migrate-a-bundled-target.md)
- [Simulate network conditions in offline tests](./how-to/simulate-network.md)
- [Run a generated SDK's live suite](./how-to/run-a-live-suite.md)
- [Customize templates and propagate the change](./how-to/customize-and-propagate-templates.md)
- [Author a brand-new language target](./how-to/author-a-new-language.md)
- [Debug a failing generated target](./how-to/debug-generation.md)
- [Drive generation from code (the API)](./how-to/use-the-api.md)
- [Release and tag](./how-to/release-and-tag.md)

### Reference
- [The feature catalogue](./reference/features.md) — all 18 shipped
  features (retry, timeout, ratelimit, cache, cost, idempotency, paging,
  streaming, proxy, telemetry, metrics, debug, audit, clienttrack, rbac,
  log, test, netsim): what each does, every option and default, and how
  they compose
- [CLI: `voxgig-sdkgen`](./reference/cli.md)
- [Typed models (entity data typing)](./reference/typed-models.md)
- [Programmatic API](./reference/api.md)
- [Model schema (`.aontu`)](./reference/model.md)
- [Station error codes](./reference/station-errors.md)
- [Project layout](./reference/project-layout.md)
- [Operation pipeline and feature hooks](./reference/hooks.md)

### Explanation
- [Architecture and how the pieces fit](./explanation/architecture.md)
- [Components vs templates: the two-layer generator](./explanation/components-and-templates.md)
- [The operation pipeline and the feature model](./explanation/operation-pipeline.md)
- [Regeneration is overwrite, not merge](./explanation/regeneration-overwrite.md)
- [Out-of-tree targets: generating into another repo](./explanation/out-of-tree-targets.md)
  — the mechanism behind `seneca-provider`

### Design notes

Design proposals and plans live beside these pages, under `docs/design/`,
and are working documents: written for the people changing the generator,
argued rather than stated, and revised on the code's schedule. Nothing
listed here depends on them.

[voxgig/station](https://github.com/voxgig/station) is the runtime
companion: generated SDKs register as plugins with a per-language station
library, giving one control surface for outbound integrations (secrets
through [voxgig/sekreto](https://github.com/voxgig/sekreto), policy,
observability, debugging) plus an optional consolidated proxy hosting the
MCP agent surface. [Use voxgig/station with a generated
SDK](./how-to/use-station.md) is the install flow.

## Working on the generator

Every target is generated from two layers, and the layer decides where a
fix goes. A file that is the same for every API is a template
(`ts/project/.sdk/tm/<lang>/`); a file whose shape depends on the
entities and operations is a component (`ts/project/.sdk/src/cmp/<lang>/`).
Fix the template or component, never the generated output, which the next
run overwrites. A change to one language is not done until it is mirrored
across every target that has the same component. The guides on
[propagating a template change](./how-to/customize-and-propagate-templates.md)
and [debugging generation](./how-to/debug-generation.md) carry the loop.
