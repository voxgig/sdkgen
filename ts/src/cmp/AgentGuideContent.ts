// Shared prose for the generated agent guides (AGENTS.md files emitted at the
// project top level, per target language, and per feature). The workflow, the
// two-layer template/component model, and the aontu primer are identical for
// every generated SDK, so they live here once and the three AgentGuide
// components (AgentGuideTop / AgentGuide / AgentGuideFeature) render them.
//
// IMPORTANT: these guides ship INSIDE a generated SDK project, so every path is
// consumer-relative (`.sdk/tm/<lang>/`, `.sdk/src/cmp/<lang>/`,
// `.sdk/model/...`) — NOT the `project/.sdk/...` form used by the sdkgen repo's
// own developer docs.

import { each } from 'jostraca'

import {
  KIT,
  getModelPath,
} from '../types'


// Best-effort build/test commands for a generated target directory. Advisory
// (a guide, not a runner); unknown targets fall back to a generic note.
type LangCmd = { install?: string, build?: string, test?: string, note?: string }

const LANG_CMD: Record<string, LangCmd> = {
  ts:  { install: 'npm install', build: 'npm run build', test: 'npm test' },
  js:  { install: 'npm install', test: 'npm test' },
  go:  { build: 'go build ./...', test: 'go test ./...' },
  py:  { install: 'pip install -e .', test: 'python -m pytest' },
  php: { install: 'composer install', test: 'composer test' },
  rb:  { install: 'bundle install', test: 'rake test' },
  lua: { test: 'busted' },
  'go-cli': { build: 'go build ./...', note: 'A CLI surface, not an SDK client library.' },
  'go-mcp': { build: 'go build ./...', note: 'An MCP server surface for AI agents, not an SDK client library.' },
}


function langCmd(name: string): LangCmd {
  return LANG_CMD[name] || {}
}


// A fenced shell block of the per-target build/test commands, or a generic
// fallback line when the target has none registered.
function langCommandsBlock(name: string): string {
  const c = langCmd(name)
  const lines: string[] = []
  if (c.install) lines.push(c.install)
  if (c.build) lines.push(c.build)
  if (c.test) lines.push(c.test)
  if (0 === lines.length) {
    return `Build and test \`${name}/\` with that language's standard toolchain.\n`
  }
  return '```bash\ncd ' + name + '\n' + lines.join('\n') + '\n```\n'
}


// --- model readers (mirror the active-item pattern in ReadmeTop.ts) ---

function activeTargets(model: any): any[] {
  const target = getModelPath(model, `main.${KIT}.target`) || {}
  return each(target).filter((t: any) => t && t.active !== false)
}

function activeFeatures(model: any): any[] {
  const feature = getModelPath(model, `main.${KIT}.feature`) || {}
  return each(feature).filter((f: any) => f && f.active !== false)
}

function activeEntities(model: any): any[] {
  const entity = getModelPath(model, `main.${KIT}.entity`) || {}
  return each(entity).filter((e: any) => e && e.active !== false)
}

function projectName(model: any): string {
  return model.Name || model.const?.Name || model.name || 'SDK'
}


// --- shared markdown sections -----------------------------------------------

// (a) basic generation & updating.
function workflowSection(): string {
  return `## Generating and updating the SDK

All generation is driven from the \`.sdk/\` directory. The generated language
directories (\`ts/\`, \`go/\`, …) are **build output** — never edit them by
hand; fix the model, a template, or a component and regenerate.

\`\`\`bash
cd .sdk
npm run add-target <lang>     # scaffold a language target (ts js go py php rb lua ...)
npm run add-feature <name>    # scaffold a feature (e.g. log, test)
npm run build                 # compile .sdk/src/cmp -> .sdk/dist
npm run generate              # emit/refresh the SDK into ../<lang>
\`\`\`

\`generate\` **merges** into existing files and does **not** re-apply
placeholder substitution to merged content. If you ever see a literal
\`ProjectName\` or \`GOMODULE\` in generated output, delete that one file and
regenerate it fresh:

\`\`\`bash
rm <lang>/<the-file-with-the-placeholder>
npm run generate
\`\`\`

Note: the \`voxgig-sdkgen\` CLI only *scaffolds* (\`target add\` /
\`feature add\`). Generation itself runs via \`npm run generate\` (backed by
\`@voxgig/model\`) — there is no \`generate\` CLI subcommand.
`
}


// (b) adding a new generated feature.
function featureSection(): string {
  return `## Adding a feature

A **feature** is a pipeline extension: an object of hooks that fire at named
stages of every entity operation (see the feature guides under
\`<lang>/src/feature/<name>/AGENTS.md\`). Built-in features are \`log\` and
\`test\`.

\`\`\`bash
cd .sdk
npm run add-feature <name>    # e.g. log  (comma-separated for several)
npm run build && npm run generate
\`\`\`

To author a **new** feature:

1. Define its model at \`.sdk/model/feature/<name>.jsonic\` — \`name: key()\`,
   \`title\`, \`version\`, \`active\`, \`config.options.active\`, a \`hook\`
   map (\`<Stage>: active: true\`), and per-language \`deps\`.
2. Register it in \`.sdk/model/feature/feature-index.jsonic\` with
   \`@"<name>.jsonic"\`.
3. Provide the per-language runtime at
   \`.sdk/tm/<lang>/src/feature/<name>/\` (the \`FEATURE_Name\` /
   \`FEATURE_VERSION\` placeholders are substituted on \`add-feature\`).
4. \`npm run add-feature <name> && npm run build && npm run generate\`.
`
}


// (c) customising the model and templates (the two-layer mental model).
function customiseSection(): string {
  return `## Customising: model, templates, components

Each language target is generated from **two layers**:

| Layer | Path | Nature |
| --- | --- | --- |
| **Templates** | \`.sdk/tm/<lang>/\` | Plain target-language source, copied verbatim with placeholder substitution. Edit when the file is the **same for every API** (transport, base classes, runtime, utilities). |
| **Components** | \`.sdk/src/cmp/<lang>/\` | TypeScript that **generates** source by walking the model. Edit when the file's shape **depends on the API** (entity classes, the constructor, README, tests). |

> Decision rule: *same for every API → template; depends on the API →
> component.*

Placeholders substituted on copy: \`ProjectName\` (Pascal-case SDK name),
\`GOMODULE\` (Go module path), \`FEATURE_Name\` / \`FEATURE_VERSION\`, and the
\`$$path$$\` interpolation of a model value (such as the name) in \`.jsonic\`.

Propagate a change: edit the template/component → \`npm run build\` (only
needed if you touched a component) → \`npm run generate\`. Target shape and
deps live in \`.sdk/model/target/<lang>.jsonic\`; features in
\`.sdk/model/feature/<name>.jsonic\`.
`
}


// (d) how the aontu model language works.
function aontuSection(): string {
  return `## The model language (aontu \`.jsonic\`)

The model is one structured object assembled by **aontu** (a unification
engine) from three sources: the API model (entities/operations, from the
OpenAPI spec via \`@voxgig/apidef\`), the base schema, and the target/feature
definitions in \`.sdk/model/\`. \`.jsonic\` is a relaxed JSON with unification
semantics:

| Syntax | Meaning |
| --- | --- |
| \`a: b: c: 1\` | Nested-object shorthand for \`a:{b:{c:1}}\`. |
| \`&: { ... }\` | Schema applied to **every** child of a map (one rule, many entries). |
| \`*default \\| type\` | A default value unified against a type (e.g. \`*true \\| boolean\`). |
| \`name: key()\` | Bind a field to its map key (so \`feature: log: {}\` gets \`name: 'log'\`). |
| \`$$path$$\` | Interpolate a model value into a string — e.g. the SDK \`name\`. |
| \`@"file.jsonic"\` | Include another fragment (how the index files work). |
| \`x: .y\` | Reference another path's value (e.g. \`deps: ts: .js\`). |

For example, the schema for every feature entry:

\`\`\`jsonic
main: kit: feature: &: {
  name: key()
  active: *false | boolean
  title: string
  version: *'0.0.1' | string
  hook: &: { active: *false | boolean, await: *false | boolean }
}
\`\`\`

Caveat: literal disjunctions (\`'prod' | 'peer' | 'dev'\`) are fragile in
aontu, so the model uses \`*'prod' | string\` and enforces the enum in code —
do not "fix" these into literal disjunctions.
`
}


// A thin CLAUDE.md that points at the sibling AGENTS.md (same directory).
function claudePointer(title: string): string {
  return `# ${title}

This project uses **AGENTS.md** as the operating guide for coding agents.

See [AGENTS.md](./AGENTS.md).
`
}


export {
  LANG_CMD,
  langCmd,
  langCommandsBlock,
  activeTargets,
  activeFeatures,
  activeEntities,
  projectName,
  workflowSection,
  featureSection,
  customiseSection,
  aontuSection,
  claudePointer,
}
