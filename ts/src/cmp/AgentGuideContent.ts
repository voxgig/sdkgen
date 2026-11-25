
import { featureApplies } from '../helpers/applicability'
import { fact } from '../helpers/facts'
import { findFeatureSources } from '../helpers/featureSource'
import { copyMode, MERGE } from '../helpers/copymerge'
import { originName } from '../helpers/packageMeta'
import { definitionName } from '../helpers/text'

import { each } from 'jostraca'

import {
  KIT,
  getModelPath,
} from '../types'


// Build/test commands for a generated target directory. Every SDK target ships
// a Makefile (`make build` / `make test` are the source of truth), so
// `viaMake` targets render those; only the dependency-install step is
// ecosystem-specific. go-cli / go-mcp are non-SDK surfaces (build only).
type LangCmd = { install?: string, build?: string, test?: string, viaMake?: boolean, note?: string }

const LANG_CMD: Record<string, LangCmd> = {
  ts:  { install: 'npm install', viaMake: true },
  js:  { install: 'npm install', viaMake: true },
  go:  { viaMake: true },
  py:  { install: 'pip install -e .', viaMake: true },
  php: { install: 'composer install', viaMake: true },
  rb:  { install: 'bundle install', viaMake: true },
  lua: { install: 'luarocks make', viaMake: true },
  'go-cli': { build: 'go build ./...', note: 'A CLI surface, not an SDK client library.' },
  'go-mcp': { build: 'go build ./...', note: 'An MCP server surface for AI agents, not an SDK client library.' },
  'py-data': {
    install: 'make dev',
    viaMake: true,
    note: 'A pandas/notebook surface layered on the sibling Python SDK, not an SDK client library.',
  },
}


// Keyed by origin, so an alias reads its origin's row.
function langCmd(name: string, model?: any): LangCmd {
  return LANG_CMD[null == model ? name : originName(model, name)] || { viaMake: true }
}


// A fenced shell block of the per-target build/test commands, run **in the
// target directory** (the per-language guide already lives there). Prefers the
// target's Makefile recipes (`make build` / `make test`).
function langCommandsBlock(name: string, model?: any): string {
  const c = langCmd(name, model)
  const lines: string[] = []
  if (c.install) lines.push(c.install)
  if (c.viaMake) {
    lines.push('make build')
    lines.push('make test')
  }
  else {
    if (c.build) lines.push(c.build)
    if (c.test) lines.push(c.test)
  }
  if (0 === lines.length) {
    return `Build and test with \`${name}\`'s standard toolchain.\n`
  }
  return '```bash\n# in this target directory (' + name + '/):\n' + lines.join('\n') + '\n```\n'
}



function featuresEnabled(target: any): boolean {
  return fact(target, 'phase').feature
}

// ts/js lay each feature out as a directory `src/feature/<name>/`, which also
// holds its guide; the other SDK targets (`srcfeature: false`) do not.
function isDirLayout(target: any): boolean {
  return target?.srcfeature !== false
}

// Each feature's runtime template as discovery finds it in the target's tree,
// skipping the empty `src/feature/<name>/` a flat-layout target also keeps.
function featureTemplates(fs: any, target: any, features: any[]): Record<string, string> {
  const dirLayout = isDirLayout(target)
  const out: Record<string, string> = {}
  const found = findFeatureSources(fs, 'tm/' + target.name,
    features.map((f: any) => String(f.name).toLowerCase()))
  for (const s of found) {
    if (!dirLayout && s.path.startsWith('src/feature/')) continue
    if (null == out[s.name]) out[s.name] = s.path + (s.folder ? '/' : '')
  }
  return out
}

function writesFeatureGuides(model: any, target: any): boolean {
  return featuresEnabled(target) && isDirLayout(target) &&
    0 < activeFeatures(model, target).length
}

function featureHooks(feature: any): string[] {
  return each(feature.hook || {})
    .filter((h: any) => h && h.active)
    .map((h: any) => h.name || h.key$)
    .filter(Boolean)
}



function activeTargets(model: any): any[] {
  const target = getModelPath(model, `main.${KIT}.target`) || {}
  return each(target).filter((t: any) => t && t.active !== false)
}

// With a target, also drops features that do not APPLY to it — a guide
// must not document a feature the target has no implementation for.
// Without one (the repo-level guide) every active feature is listed.
function activeFeatures(model: any, target?: any): any[] {
  const feature = getModelPath(model, `main.${KIT}.feature`) || {}
  return each(feature)
    .filter((f: any) => f && f.active !== false)
    .filter((f: any) => null == target || featureApplies(f, target))
}

function activeEntities(model: any): any[] {
  const entity = getModelPath(model, `main.${KIT}.entity`) || {}
  return each(entity).filter((e: any) => e && e.active !== false)
}

function projectName(model: any): string {
  return model.Name || model.const?.Name || model.name || 'SDK'
}



// What a run does to the files it generates, stated once for every guide.
function regenerationStatement(): string {
  return `Each \`npm run generate\` rewrites every file it generates, so an edit
made to generated output is lost, and deletes the files it generated before
and no longer emits. A target or a phase switched off is left as it was.`
}

function copiesStatement(model: any): string {
  return MERGE === copyMode(model?.main?.[KIT]?.copies) ?
    `\`target add\` and \`feature add\` copy templates and components into
\`.sdk/\`, and merge toolchain updates into the copies this project has
edited.` :
    `\`target add\` and \`feature add\` overwrite the templates and components
in \`.sdk/\` (\`main: kit: copies: 'overwrite'\`): set \`copies\` to
\`'merge'\` before customising them, so that an add merges toolchain updates
into the edited copies.`
}


function workflowSection(model: any): string {
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

${regenerationStatement()}
${copiesStatement(model)}

Note: the \`voxgig-sdkgen\` CLI only *scaffolds* (\`target add\` /
\`feature add\`). Generation itself runs via \`npm run generate\` (backed by
\`@voxgig/model\`) — there is no \`generate\` CLI subcommand.

### Two silent failure modes

Generation has two ways of going wrong that **nothing reports**. Neither
breaks a build or a test, so the only symptom is a tree that disagrees with
the model — which is easy to commit past.

**\`voxgig-model --no-config\` writes a REDUCED model.** The
\`.model-config\` build is what registers the generator actions, and an SDK
project loads \`apidef\` and \`sdkgen\` through exactly that mechanism:

\`\`\`
sys: model: action: { apidef: load: 'build/apidef.js', sdkgen: load: 'build/sdkgen.js' }
sys: model: order: action: 'apidef,sdkgen'
\`\`\`

\`--no-config\` skips it, so those actions never run — and the model build
still *writes* the model file, now missing whatever they contribute (the
name case variants, and whole subtrees). A reduced model is a valid model,
so nothing downstream complains. To inspect the model layer **without side
effects**, use \`npm run dry-generate\` (\`-y\`, writes nothing). Never
\`--no-config\` in anything whose output might be committed.

**Dropping a target deletes nothing.** A run deletes only what it no longer
emits from the targets and phases that ran, so a target dropped from the
model, or a phase switched off, leaves its files in the tree, and \`git
status\` is silent because they are committed and unchanged. Delete them by
hand.
`
}


function featureSection(): string {
  return `## Adding a feature

A **feature** is a pipeline extension: an object of hooks that fire at named
stages of every entity operation (each target's guide documents its
features).

\`\`\`bash
cd .sdk
npm run add-feature <name>    # e.g. log  (comma-separated for several)
npm run build && npm run generate
\`\`\`

To author a **new** feature, when editing a template cannot make the change:

1. Define its model at \`.sdk/model/feature/<name>.aontu\` — \`name: key()\`,
   \`title\`, \`version\`, \`active\`, \`config.options.active\`, a \`hook\`
   map (\`<Stage>: active: true\`), and per-language \`deps\`.
2. Provide the per-language runtime under that target's feature template dir
   (\`.sdk/tm/<lang>/src/feature/<name>/\` for ts/js, \`.sdk/tm/<lang>/feature/\`
   otherwise) — the \`FEATURE_Name\` / \`FEATURE_VERSION\` placeholders are
   substituted when \`generate\` copies it.
3. \`npm run add-feature <name> && npm run build && npm run generate\`. No
   package provides the name, so the add registers the feature in
   \`feature-index.aontu\` and copies nothing: the files in \`.sdk\` are its
   source.

A target of the project's own is written the same way:
\`.sdk/model/target/<name>.aontu\`, \`.sdk/src/cmp/<name>/\` and
\`.sdk/tm/<name>/\`, then \`npm run add-target <name>\`. Never put a package
folder such as \`ext/\` inside the project: sdkgen refuses it.
`
}


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
\`$$path$$\` interpolation of a model value (such as the name) in \`.aontu\`.

Propagate a change: edit the template/component → \`npm run build\` (only
needed if you touched a component) → \`npm run generate\`. Target shape and
deps live in \`.sdk/model/target/<lang>.aontu\`; features in
\`.sdk/model/feature/<name>.aontu\`.
`
}


function aontuSection(model: any): string {
  return `## The model language (aontu, \`.aontu\` files)

The model is one structured object assembled by **aontu** (a unification
engine) from three sources: the API model (entities/operations, from the
${definitionName(fact(model.main[KIT], 'definitionKind'))} via \`@voxgig/apidef\`), the base schema, and the target/feature
definitions in \`.sdk/model/\`. An \`.aontu\` file is a relaxed JSON (jsonic
syntax) with unification semantics:

| Syntax | Meaning |
| --- | --- |
| \`a: b: c: 1\` | Nested-object shorthand for \`a:{b:{c:1}}\`. |
| \`&: { ... }\` | Schema applied to **every** child of a map (one rule, many entries). |
| \`*default \\| type\` | A default value unified against a type (e.g. \`*true \\| boolean\`). |
| \`name: key()\` | Bind a field to its map key (so \`feature: log: {}\` gets \`name: 'log'\`). |
| \`$$path$$\` | Interpolate a model value into a string — e.g. the SDK \`name\`. |
| \`@"./file.aontu"\` | Include another fragment (how the index files work). The \`./\` is required on a local path. |
| \`x: .y\` | Reference another path's value (e.g. \`deps: ts: .js\`). |

For example, the schema for every feature entry:

\`\`\`aontu
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
  featuresEnabled,
  isDirLayout,
  featureTemplates,
  writesFeatureGuides,
  featureHooks,
  activeTargets,
  activeFeatures,
  activeEntities,
  projectName,
  workflowSection,
  regenerationStatement,
  copiesStatement,
  featureSection,
  customiseSection,
  aontuSection,
  claudePointer,
}
