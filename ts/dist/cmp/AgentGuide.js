"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentGuide = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const optional_1 = require("../helpers/optional");
const facts_1 = require("../helpers/facts");
const packageMeta_1 = require("../helpers/packageMeta");
const AgentGuideContent_1 = require("./AgentGuideContent");
const AgentGuideFeature_1 = require("./AgentGuideFeature");
// Per-language agent guide. Emitted inside the ambient target folder (the Root
// enters `Folder({ name: target.name })` before calling this, exactly as for
// Readme), so it lands at `<lang>/AGENTS.md`. Then it drives the co-located
// per-feature guides for this target.
const AgentGuide = (0, component_1.cmp)(function AgentGuide(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    const Name = (0, AgentGuideContent_1.projectName)(model);
    const lang = target.name;
    const title = (0, facts_1.fact)(target, 'title');
    const surface = (0, AgentGuideContent_1.langCmd)(lang, model).note;
    const features = (0, AgentGuideContent_1.activeFeatures)(model, target);
    const featuresOn = (0, AgentGuideContent_1.featuresEnabled)(target);
    const dirLayout = (0, AgentGuideContent_1.isDirLayout)(target);
    (0, jostraca_1.File)({ name: 'AGENTS.md' }, () => {
        (0, jostraca_1.Content)(`# ${Name} ${title} — Agent Guide

${surface
            ? surface + '\n\nGenerated from the shared model; see the [project guide](../AGENTS.md) for the full workflow.'
            : `The ${title} client for the ${(0, packageMeta_1.apiName)(model)} API. This directory is **generated** — do not edit it by hand; change the model/template/component in \`.sdk/\` and regenerate. See the [project guide](../AGENTS.md) for the full workflow and the aontu model language.`}

> Paths below (\`.sdk/…\`) are relative to the **project root** — one level up
> from this \`${lang}/\` directory.

## Regenerate this target

\`\`\`bash
cd ../.sdk
npm run build        # only if you changed a component
npm run generate     # refreshes this ${lang}/ directory
\`\`\`

${(0, AgentGuideContent_1.regenerationStatement)()}

Then build and test the generated output:

${(0, AgentGuideContent_1.langCommandsBlock)(lang, model)}

## What generates this target

| Source | Path | Edit when… |
| --- | --- | --- |
| Target definition | \`.sdk/model/target/${lang}.aontu\` | deps, module, extension, phases change |
| Templates | \`.sdk/tm/${lang}/\` | the file is the **same for every API** (runtime, transport, base classes) — copied verbatim with placeholder substitution |
| Components | \`.sdk/src/cmp/${lang}/\` | the file's shape **depends on the API** (entities, constructor, README, tests) — TypeScript that walks the model |

Decision rule: *same for every API → template; depends on the API →
component.* After editing a component run \`npm run build\` before
\`npm run generate\`; template-only edits just need \`npm run generate\`.
${(0, AgentGuideContent_1.copiesStatement)(model)}

`);
        if (featuresOn && 0 < features.length) {
            (0, jostraca_1.Content)(`## Features in this target

`);
            if (dirLayout) {
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
                const templates = (0, AgentGuideContent_1.featureTemplates)(ctx$.fs(), target, features);
                const shared = 0 === Object.keys(templates).length;
                (0, jostraca_1.Content)(`Each feature's hooks and default activation come from
\`.sdk/model/feature/<name>.aontu\`. ${shared
                    ? `This target has no template per
feature: customise its features in the runtime under \`.sdk/tm/${lang}/\`
and regenerate.`
                    : `Its runtime is generated from the template
listed here: customise that and regenerate.`}

| Feature | ${shared ? '' : 'Template | '}Active hooks |
| --- | ${shared ? '' : '--- | '}--- |
`);
                features.forEach((f) => {
                    const template = templates[f.name];
                    const hooks = (0, AgentGuideContent_1.featureHooks)(f);
                    const hookList = hooks.length ? hooks.map((h) => '\`' + h + '\`').join(', ') : '—';
                    const label = f.title ? `**${f.name}** — ${f.title}` : `**${f.name}**`;
                    const where = shared ? '' :
                        (null == template ? '—' : '\`.sdk/tm/' + lang + '/' + template + '\`') + ' | ';
                    (0, jostraca_1.Content)(`| ${label} | ${where}${hookList} |
`);
                });
                (0, jostraca_1.Content)(`
`);
            }
        }
        const AgentGuide_sdk = (0, optional_1.optionalComponent)(ctx$, target, 'AgentGuide');
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
    if ((0, AgentGuideContent_1.writesFeatureGuides)(model, target)) {
        features.forEach((feature) => {
            (0, AgentGuideFeature_1.AgentGuideFeature)({ target, feature });
        });
    }
    ctx$.log?.info?.({ point: 'generate-agentguide', target, note: 'target:' + lang });
});
exports.AgentGuide = AgentGuide;
//# sourceMappingURL=AgentGuide.js.map