# Voxgig SDK Generator — Documentation

`@voxgig/sdkgen` turns an API definition into idiomatic, multi-language
client SDKs (plus a CLI and an MCP server) from a single source of truth.

> **Building an SDK for your own API?** Start at
> [`create-sdkgen`'s AGENTS.md](https://github.com/voxgig/create-sdkgen/blob/main/AGENTS.md) for the
> end-to-end spec → scaffold → generate → test onboarding. The material
> below documents the generator itself in depth.

This documentation is organised into four kinds of material. Pick the one
that matches what you are trying to do right now:

| If you want to… | Go to | Nature |
| --- | --- | --- |
| **Learn the tool** by building something end-to-end | [Tutorial](./tutorial.md) | Follow the steps; no decisions required |
| **Get a specific job done** (add a language, a feature, debug a build) | [How-to guides](./how-to/) | Goal-oriented recipes |
| **Look something up** (CLI flags, API, model schema, hooks) | [Reference](./reference/) | Dry, complete, accurate |
| **Understand how and why it works** | [Explanation](./explanation/) | Background and design |

## Map

### Tutorial
- [Generate your first SDK](./tutorial.md)

### How-to guides
- [Add a language target](./how-to/add-a-target.md)
- [Add a feature](./how-to/add-a-feature.md)
- [Use an sdkgen package](./how-to/use-an-sdkgen-package.md)
- [Author an sdkgen package](./how-to/author-an-sdkgen-package.md)
- [Migrate a bundled target into a package](./how-to/migrate-a-bundled-target.md)
- [Simulate network conditions in offline tests](./how-to/simulate-network.md)
- [Customize templates and propagate the change](./how-to/customize-and-propagate-templates.md)
- [Author a brand-new language target](./how-to/author-a-new-language.md)
- [Debug a failing generated target](./how-to/debug-generation.md)
- [Drive generation from code (the API)](./how-to/use-the-api.md)

### Reference
- [CLI: `voxgig-sdkgen`](./reference/cli.md)
- [Typed models (entity data typing)](./reference/typed-models.md)
- [Programmatic API](./reference/api.md)
- [Model schema (`.aontu`)](./reference/model.md)
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
- [The `py-data` target](./design/py-data-target.md) — notebook/analyst-oriented
  Python package layered on the `py` SDK. The design note that preceded the
  target; `py-data` now ships.
- [sdkgen packages](./design/sdkgen-packages.md) — externally-defined
  targets, features and other kinds, added from a local folder, a git
  checkout, or an npm package installed in `.sdk/`. Mostly implemented;
  the status note at the top of the file carries the current line.
- [Feature tags](./design/feature-tags.md) — declaring which targets a
  feature can actually apply to, so `feature-source-missing` means "this
  is a mistake" rather than "this target was never going to take it".
  Proposal.
- [API versioning](./design/api-versioning.md) — compatibility across
  apidef, sdkgen, and aontu: matching SDK versions to API/app versions,
  breaking-change tooling (`apidef breaking`, the aontu G3 subsumption
  route and what it still needs), runtime robustness in generated SDKs,
  and the verified-pairs compatibility matrix. Discussion draft; the
  open questions in §12 gate the plan.
- [voxgig/station](./design/voxgig-station.md) — the runtime companion:
  generated SDKs register as plugins with a per-language station
  library, giving one control surface for outbound integrations —
  secrets (through [voxgig/sekreto](https://github.com/voxgig/sekreto)),
  policy, observability, debugging — plus an optional consolidated
  proxy hosting the MCP agent surface. Proposal.

## For AI coding agents

If you are an automated coding agent, start with
[`../AGENTS.md`](../AGENTS.md). It is the operating manual: build/test
commands, where to make each kind of change, the template-propagation
pipeline, conventions, and the gotchas that will otherwise cost you a
build.
