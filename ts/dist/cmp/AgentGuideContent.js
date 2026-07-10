"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANG_CMD = void 0;
exports.langCmd = langCmd;
exports.langCommandsBlock = langCommandsBlock;
exports.featuresEnabled = featuresEnabled;
exports.isDirLayout = isDirLayout;
exports.featureBase = featureBase;
exports.featureRuntimeFile = featureRuntimeFile;
exports.featureHooks = featureHooks;
exports.activeTargets = activeTargets;
exports.activeFeatures = activeFeatures;
exports.activeEntities = activeEntities;
exports.projectName = projectName;
exports.workflowSection = workflowSection;
exports.featureSection = featureSection;
exports.customiseSection = customiseSection;
exports.aontuSection = aontuSection;
exports.claudePointer = claudePointer;
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const LANG_CMD = {
    ts: { install: 'npm install', viaMake: true },
    js: { install: 'npm install', viaMake: true },
    go: { viaMake: true },
    py: { install: 'pip install -e .', viaMake: true },
    php: { install: 'composer install', viaMake: true },
    rb: { install: 'bundle install', viaMake: true },
    lua: { install: 'luarocks make', viaMake: true },
    'go-cli': { build: 'go build ./...', note: 'A CLI surface, not an SDK client library.' },
    'go-mcp': { build: 'go build ./...', note: 'An MCP server surface for AI agents, not an SDK client library.' },
};
exports.LANG_CMD = LANG_CMD;
function langCmd(name) {
    return LANG_CMD[name] || { viaMake: true };
}
// A fenced shell block of the per-target build/test commands, run **in the
// target directory** (the per-language guide already lives there). Prefers the
// target's Makefile recipes (`make build` / `make test`).
function langCommandsBlock(name) {
    const c = langCmd(name);
    const lines = [];
    if (c.install)
        lines.push(c.install);
    if (c.viaMake) {
        lines.push('make build');
        lines.push('make test');
    }
    else {
        if (c.build)
            lines.push(c.build);
        if (c.test)
            lines.push(c.test);
    }
    if (0 === lines.length) {
        return `Build and test with \`${name}\`'s standard toolchain.\n`;
    }
    return '```bash\n# in this target directory (' + name + '/):\n' + lines.join('\n') + '\n```\n';
}
// --- feature layout helpers (targets differ) --------------------------------
// Whether a target generates per-feature output at all. go-cli / go-mcp
// disable the feature phase (`phase.feature.active: false`).
function featuresEnabled(target) {
    return target?.phase?.feature?.active !== false;
}
// ts/js lay each feature out as a directory `src/feature/<name>/`; the other
// SDK targets (`srcfeature: false`) use flat files in a shared `feature/`
// package. Drives where feature guides live / are referenced.
function isDirLayout(target) {
    return target?.srcfeature !== false;
}
function featureBase(target) {
    return isDirLayout(target) ? 'src/feature' : 'feature';
}
// The generated runtime file for a feature in a flat-layout target:
// `<name>_feature.<ext>` (go/py/rb/lua) or `<Name>Feature.php` (php).
function featureRuntimeFile(target, feature) {
    const ext = target?.ext || target?.name || '';
    if ('php' === target?.name) {
        return (feature.Name || feature.name) + 'Feature.php';
    }
    return feature.name + '_feature.' + ext;
}
// A feature's active hook-stage names (feature.hook.<Stage>.active === true),
// sorted (each() marks map keys as key$).
function featureHooks(feature) {
    return (0, jostraca_1.each)(feature.hook || {})
        .filter((h) => h && h.active)
        .map((h) => h.name || h.key$)
        .filter(Boolean);
}
// --- model readers (mirror the active-item pattern in ReadmeTop.ts) ---
function activeTargets(model) {
    const target = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.target`) || {};
    return (0, jostraca_1.each)(target).filter((t) => t && t.active !== false);
}
function activeFeatures(model) {
    const feature = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.feature`) || {};
    return (0, jostraca_1.each)(feature).filter((f) => f && f.active !== false);
}
function activeEntities(model) {
    const entity = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.entity`) || {};
    return (0, jostraca_1.each)(entity).filter((e) => e && e.active !== false);
}
function projectName(model) {
    return model.Name || model.const?.Name || model.name || 'SDK';
}
// --- shared markdown sections -----------------------------------------------
// (a) basic generation & updating.
function workflowSection() {
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
`;
}
// (b) adding a new generated feature.
function featureSection() {
    return `## Adding a feature

A **feature** is a pipeline extension: an object of hooks that fire at named
stages of every entity operation (each target's guide documents its
features). Built-in features are \`log\` and \`test\`.

\`\`\`bash
cd .sdk
npm run add-feature <name>    # e.g. log  (comma-separated for several)
npm run build && npm run generate
\`\`\`

To author a **new** feature:

1. Define its model at \`.sdk/model/feature/<name>.aontu\` — \`name: key()\`,
   \`title\`, \`version\`, \`active\`, \`config.options.active\`, a \`hook\`
   map (\`<Stage>: active: true\`), and per-language \`deps\`.
2. Register it in \`.sdk/model/feature/feature-index.aontu\` with
   \`@"<name>.aontu"\`.
3. Provide the per-language runtime under that target's feature template dir
   (\`.sdk/tm/<lang>/src/feature/<name>/\` for ts/js, \`.sdk/tm/<lang>/feature/\`
   otherwise) — the \`FEATURE_Name\` / \`FEATURE_VERSION\` placeholders are
   substituted on \`add-feature\`.
4. \`npm run add-feature <name> && npm run build && npm run generate\`.
`;
}
// (c) customising the model and templates (the two-layer mental model).
function customiseSection() {
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
`;
}
// (d) how the aontu model language works.
function aontuSection() {
    return `## The model language (aontu, \`.aontu\` files)

The model is one structured object assembled by **aontu** (a unification
engine) from three sources: the API model (entities/operations, from the
OpenAPI spec via \`@voxgig/apidef\`), the base schema, and the target/feature
definitions in \`.sdk/model/\`. An \`.aontu\` file is a relaxed JSON (jsonic
syntax) with unification semantics:

| Syntax | Meaning |
| --- | --- |
| \`a: b: c: 1\` | Nested-object shorthand for \`a:{b:{c:1}}\`. |
| \`&: { ... }\` | Schema applied to **every** child of a map (one rule, many entries). |
| \`*default \\| type\` | A default value unified against a type (e.g. \`*true \\| boolean\`). |
| \`name: key()\` | Bind a field to its map key (so \`feature: log: {}\` gets \`name: 'log'\`). |
| \`$$path$$\` | Interpolate a model value into a string — e.g. the SDK \`name\`. |
| \`@"file.aontu"\` | Include another fragment (how the index files work). |
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
`;
}
// A thin CLAUDE.md that points at the sibling AGENTS.md (same directory).
function claudePointer(title) {
    return `# ${title}

This project uses **AGENTS.md** as the operating guide for coding agents.

See [AGENTS.md](./AGENTS.md).
`;
}
//# sourceMappingURL=AgentGuideContent.js.map