"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentGuideFeature = void 0;
const jostraca_1 = require("jostraca");
const AgentGuideContent_1 = require("./AgentGuideContent");
function cap(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
// Per-feature agent guide, co-located with the feature's generated runtime.
// Invoked from AgentGuide inside the ambient target folder, so it lands at
// `<lang>/src/feature/<name>/AGENTS.md`.
const AgentGuideFeature = (0, jostraca_1.cmp)(function AgentGuideFeature(props) {
    const { target, feature, ctx$ } = props;
    const name = feature.name;
    const Name = feature.Name || cap(name);
    const title = feature.title || `${Name} feature`;
    const version = feature.version || '0.0.1';
    const lang = target.name;
    // Active hook stages (feature.hook.<Stage>.active === true).
    const hooks = (0, jostraca_1.each)(feature.hook || {})
        .filter((h) => h && h.active)
        .map((h) => h.name || h.key$)
        .filter(Boolean);
    const defaultOn = true === feature?.config?.options?.active;
    (0, jostraca_1.Folder)({ name: 'src/feature/' + name }, () => {
        (0, jostraca_1.File)({ name: 'AGENTS.md' }, () => {
            (0, jostraca_1.Content)(`# ${Name}Feature — Agent Guide

${title} (v${version}).

A **feature** is a pipeline extension: an object of hooks that fire at named
stages of every entity operation (load, list, create, update, remove) and of
the SDK/entity lifecycle. Features are how you inspect or modify the request
pipeline without forking the SDK. This directory holds the **generated**
runtime for the \`${name}\` feature in the ${target.title || lang} target — do
not edit it by hand; change its template/model in \`.sdk/\` and regenerate.

Active by default: **${defaultOn ? 'yes' : 'no'}** (\`config.options.active\`
in the model). ${defaultOn
                ? 'It runs unless disabled.'
                : 'It only runs when explicitly enabled (e.g. the `test` feature is switched on for test mode).'}

`);
            if (0 < hooks.length) {
                (0, jostraca_1.Content)(`## Hooks it fires

${hooks.map((h) => `- \`${h}\``).join('\n')}

Each active hook runs at its pipeline stage in feature-registration order, so a
later feature can override an earlier one.

`);
            }
            (0, jostraca_1.Content)(`## Where it is defined

| Part | Path |
| --- | --- |
| Model definition | \`.sdk/model/feature/${name}.aontu\` (name, title, version, \`config.options.active\`, the \`hook\` map, per-language \`deps\`) |
| Registered in | \`.sdk/model/feature/feature-index.aontu\` (\`@"${name}.aontu"\`) |
| Runtime template | \`.sdk/tm/${lang}/src/feature/${name}/\` (copied here on \`generate\`; \`FEATURE_Name\`/\`FEATURE_VERSION\` substituted) |

(Paths are relative to the **project root** — four levels up from here.)

## Customising this feature

- **Turn hooks on/off**: edit the \`hook\` map in
  \`.sdk/model/feature/${name}.aontu\` (\`<Stage>: active: true|false\`).
- **Change default activation**: set \`config.options.active\` in the same file.
- **Dependencies**: edit \`deps.<lang>\` in the same file.
- **Behaviour**: edit the runtime template under
  \`.sdk/tm/${lang}/src/feature/${name}/\`, then regenerate.

After any change: \`cd ../../../../.sdk && npm run generate\` (add
\`npm run build\` first if you changed a component). If a regenerated file
shows a literal \`FEATURE_Name\`/\`ProjectName\`, delete it and regenerate.

To author a **new** feature, copy this one's model + template shape — see the
[project guide](../../../../AGENTS.md) and the
[${target.title || lang} guide](../../../AGENTS.md).
`);
        });
        (0, jostraca_1.File)({ name: 'CLAUDE.md' }, () => {
            (0, jostraca_1.Content)((0, AgentGuideContent_1.claudePointer)(`${Name}Feature (${lang})`));
        });
    });
    ctx$.log?.info?.({
        point: 'generate-agentguide-feature', target, feature,
        note: 'target:' + lang + ', feature:' + name,
    });
});
exports.AgentGuideFeature = AgentGuideFeature;
//# sourceMappingURL=AgentGuideFeature.js.map