# Voxgig SDK Generator — Documentation

`@voxgig/sdkgen` turns an API definition into idiomatic, multi-language
client SDKs (plus a CLI and an MCP server) from a single source of truth.

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
- [Customize templates and propagate the change](./how-to/customize-and-propagate-templates.md)
- [Author a brand-new language target](./how-to/author-a-new-language.md)
- [Debug a failing generated target](./how-to/debug-generation.md)
- [Drive generation from code (the API)](./how-to/use-the-api.md)

### Reference
- [CLI: `voxgig-sdkgen`](./reference/cli.md)
- [Programmatic API](./reference/api.md)
- [Model schema (`.jsonic`)](./reference/model.md)
- [Project layout](./reference/project-layout.md)
- [Operation pipeline and feature hooks](./reference/hooks.md)

### Explanation
- [Architecture and how the pieces fit](./explanation/architecture.md)
- [Components vs templates: the two-layer generator](./explanation/components-and-templates.md)
- [The operation pipeline and the feature model](./explanation/operation-pipeline.md)

## For AI coding agents

If you are an automated coding agent, start with
[`../AGENTS.md`](../AGENTS.md). It is the operating manual: build/test
commands, where to make each kind of change, the template-propagation
pipeline, conventions, and the gotchas that will otherwise cost you a
build.
