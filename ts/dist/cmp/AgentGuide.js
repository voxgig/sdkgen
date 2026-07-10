"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentGuide = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const AgentGuideContent_1 = require("./AgentGuideContent");
const AgentGuideFeature_1 = require("./AgentGuideFeature");
// Per-language agent guide. Emitted inside the ambient target folder (the Root
// enters `Folder({ name: target.name })` before calling this, exactly as for
// Readme), so it lands at `<lang>/AGENTS.md`. Then it drives the co-located
// per-feature guides for this target.
const AgentGuide = (0, jostraca_1.cmp)(function AgentGuide(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    const Name = (0, AgentGuideContent_1.projectName)(model);
    const lang = target.name;
    const title = target.title || lang;
    const surface = (0, AgentGuideContent_1.langCmd)(lang).note;
    const features = (0, AgentGuideContent_1.activeFeatures)(model);
    // go-cli/go-mcp disable the feature phase; ts/js lay features out as
    // per-feature directories, the other SDK targets as flat files.
    const featuresOn = (0, AgentGuideContent_1.featuresEnabled)(target);
    const dirLayout = (0, AgentGuideContent_1.isDirLayout)(target);
    (0, jostraca_1.File)({ name: 'AGENTS.md' }, () => {
        (0, jostraca_1.Content)(`# ${Name} ${title} — Agent Guide

${surface
            ? surface + '\n\nGenerated from the shared model; see the [project guide](../AGENTS.md) for the full workflow.'
            : `The ${title} client for the ${Name} API. This directory is **generated** — do not edit it by hand; change the model/template/component in \`.sdk/\` and regenerate. See the [project guide](../AGENTS.md) for the full workflow and the aontu model language.`}

> Paths below (\`.sdk/…\`) are relative to the **project root** — one level up
> from this \`${lang}/\` directory.

## Regenerate this target

\`\`\`bash
cd ../.sdk
npm run build        # only if you changed a component
npm run generate     # refreshes this ${lang}/ directory
\`\`\`

Then build and test the generated output:

${(0, AgentGuideContent_1.langCommandsBlock)(lang)}

## What generates this target

| Source | Path | Edit when… |
| --- | --- | --- |
| Target definition | \`.sdk/model/target/${lang}.aontu\` | deps, module, extension, phases change |
| Templates | \`.sdk/tm/${lang}/\` | the file is the **same for every API** (runtime, transport, base classes) — copied verbatim with placeholder substitution |
| Components | \`.sdk/src/cmp/${lang}/\` | the file's shape **depends on the API** (entities, constructor, README, tests) — TypeScript that walks the model |

Decision rule: *same for every API → template; depends on the API →
component.* After editing a component run \`npm run build\` before
\`npm run generate\`; template-only edits just need \`npm run generate\`.

`);
        if (featuresOn && 0 < features.length) {
            (0, jostraca_1.Content)(`## Features in this target

`);
            if (dirLayout) {
                // ts/js: each feature is a directory under src/feature/ with its own guide.
                features.forEach((f) => {
                    const t = f.title ? ' — ' + f.title : '';
                    (0, jostraca_1.Content)(`- [\`${f.name}\`](./src/feature/${f.name}/AGENTS.md)${t}
`);
                });
                (0, jostraca_1.Content)(`
Each feature's runtime and its own guide live in \`src/feature/<name>/\`.

`);
            }
            else {
                // go/py/php/rb/lua: flat files in the shared \`feature/\` package — no
                // per-feature directory, so features are documented inline here.
                (0, jostraca_1.Content)(`Each feature is a flat file in the \`feature/\` package. Its hooks and
default activation come from \`.sdk/model/feature/<name>.aontu\`; customise
the runtime under \`.sdk/tm/${lang}/feature/\` and regenerate.

| Feature | Runtime file | Active hooks |
| --- | --- | --- |
`);
                features.forEach((f) => {
                    const file = (0, AgentGuideContent_1.featureRuntimeFile)(target, f);
                    const hooks = (0, AgentGuideContent_1.featureHooks)(f);
                    const hookList = hooks.length ? hooks.map((h) => '\`' + h + '\`').join(', ') : '—';
                    const label = f.title ? `**${f.name}** — ${f.title}` : `**${f.name}**`;
                    (0, jostraca_1.Content)(`| ${label} | \`feature/${file}\` | ${hookList} |
`);
                });
                (0, jostraca_1.Content)(`
`);
            }
        }
        // Optional per-language enrichment (build/test specifics, idioms). Neutral
        // content above stands alone; a language may add an AgentGuide_<lang>.
        const AgentGuide_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${lang}/AgentGuide_${lang}`, { ignore: true });
        if (AgentGuide_sdk) {
            AgentGuide_sdk['AgentGuide']({ target });
        }
        (0, jostraca_1.Content)(`---

Generated by [@voxgig/sdkgen](https://github.com/voxgig/sdkgen). See the
[project guide](../AGENTS.md).
`);
    });
    (0, jostraca_1.File)({ name: 'CLAUDE.md' }, () => {
        (0, jostraca_1.Content)((0, AgentGuideContent_1.claudePointer)(`${Name} ${title}`));
    });
    // Co-located per-feature guide files — only for dir-layout targets (ts/js),
    // where each feature has its own directory to hold the guide. Flat-layout
    // targets document features inline above; phase-disabled targets
    // (go-cli/go-mcp) get no feature docs at all.
    if (featuresOn && dirLayout) {
        features.forEach((feature) => {
            (0, AgentGuideFeature_1.AgentGuideFeature)({ target, feature });
        });
    }
    ctx$.log?.info?.({ point: 'generate-agentguide', target, note: 'target:' + lang });
});
exports.AgentGuide = AgentGuide;
//# sourceMappingURL=AgentGuide.js.map