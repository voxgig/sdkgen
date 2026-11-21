"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentGuideTop = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const facts_1 = require("../helpers/facts");
const AgentGuideContent_1 = require("./AgentGuideContent");
const AgentGuideTopIntro = (0, component_1.cmp)(function AgentGuideTopIntro(props) {
    const { Name, model, targets } = props.s;
    const featureGuides = targets.some((t) => (0, facts_1.fact)(t, 'phase').agentguide && (0, AgentGuideContent_1.writesFeatureGuides)(model, t));
    (0, jostraca_1.Content)(`# ${Name} SDK — Agent Guide

This is a **generated** multi-language SDK project. The client libraries in
each language directory are produced by [@voxgig/sdkgen](https://github.com/voxgig/sdkgen)
from an API model; the generator, model, templates, and components all live in
\`.sdk/\`. Treat the language directories as build output — change the model,
a template, or a component and regenerate.

There are companion guides deeper in the tree: one per language
(\`<lang>/AGENTS.md\`)${featureGuides ? `, and one per feature in a target that keeps each
feature in its own directory (\`<lang>/src/feature/<name>/AGENTS.md\`)` : ''}.

## Project map

`);
});
const AgentGuideTopTargets = (0, component_1.cmp)(function AgentGuideTopTargets(props) {
    const { targets } = props.s;
    if (0 < targets.length) {
        (0, jostraca_1.Content)(`**Targets** (${targets.length}):

| Target | Directory | Build guide |
| --- | --- | --- |
`);
        targets.forEach((t) => {
            const note = (0, AgentGuideContent_1.langCmd)(t.name).note ? ' — ' + (0, AgentGuideContent_1.langCmd)(t.name).note : '';
            (0, jostraca_1.Content)(`| \`${t.name}\` | \`${t.name}/\`${note} | [\`${t.name}/AGENTS.md\`](./${t.name}/AGENTS.md) |
`);
        });
        (0, jostraca_1.Content)(`
`);
    }
});
const AgentGuideTopFeatures = (0, component_1.cmp)(function AgentGuideTopFeatures(props) {
    const { features } = props.s;
    if (0 < features.length) {
        (0, jostraca_1.Content)(`**Features** (${features.length}): `);
        (0, jostraca_1.Content)(features.map((f) => `\`${f.name}\``).join(', ') + `.

Each feature is generated into each SDK target that supports it, and each
target's guide documents where that target keeps its features.

`);
    }
});
const AgentGuideTopEntities = (0, component_1.cmp)(function AgentGuideTopEntities(props) {
    const { entities } = props.s;
    if (0 < entities.length) {
        (0, jostraca_1.Content)(`**Entities** (${entities.length}): `);
        (0, jostraca_1.Content)(entities.map((e) => `\`${e.Name || e.name}\``).join(', ') + `.

`);
    }
});
const AgentGuideTopStation = (0, component_1.cmp)(function AgentGuideTopStation(props) {
    const { features } = props.s;
    // Station paragraph (station design §9.4; declarative design §11
    // item 4), only when the model carries the feature: an agent working
    // on this repo should know the runtime story without leaving
    // AGENTS.md — and, first, that the application's integrations are
    // DECLARED in station.json, so that file is where to look.
    const station = features.find((f) => 'station' === f.name);
    if (null != station) {
        (0, jostraca_1.Content)(`**Station**: this SDK is a
[voxgig/station](https://github.com/voxgig/station) plugin (the
\`station\` feature, ${(0, facts_1.fact)(station, 'on') ? 'on' : 'off'} by default). An application's outbound
integrations are **declared in \`station.json\`** at its repo root —
to learn what the application talks to, read that file: every SDK
instance (\`sdk\`), per-api default (\`api\`), feature setting, and
egress policy is declared there, and never a credential value.
\`station.sdk('<name>')\` builds a declared instance on first ask;
\`station.instances()\` lists them. Bound to an open \`Station\`,
the credential is resolved by sekreto under the instance's secret name
and injected at the transport seam — \`options()\` and
\`prepare()\` output hold only a placeholder, so both are safe to
inspect and log. \`station.tap(...)\`/\`station.events()\` show live
traffic; \`station.plugins()\` lists live descriptors. See the "Use
with Station" README section and \`src/feature/station/\` (or the
target's feature container) for the generated adapter.

`);
    }
});
const AgentGuideTopWorkflow = (0, component_1.cmp)(function AgentGuideTopWorkflow() {
    (0, jostraca_1.Content)((0, AgentGuideContent_1.workflowSection)());
});
const AgentGuideTopFeatureGuide = (0, component_1.cmp)(function AgentGuideTopFeatureGuide() {
    (0, jostraca_1.Content)((0, AgentGuideContent_1.featureSection)());
});
const AgentGuideTopCustomise = (0, component_1.cmp)(function AgentGuideTopCustomise() {
    (0, jostraca_1.Content)((0, AgentGuideContent_1.customiseSection)());
});
const AgentGuideTopAontu = (0, component_1.cmp)(function AgentGuideTopAontu() {
    (0, jostraca_1.Content)((0, AgentGuideContent_1.aontuSection)());
});
const AgentGuideTopLayout = (0, component_1.cmp)(function AgentGuideTopLayout() {
    (0, jostraca_1.Content)(`## Where things live

\`\`\`
.sdk/
  model/          the model: target/, feature/, and index .aontu files
  src/cmp/<lang>/  components — TypeScript that generates API-specific source
  tm/<lang>/       templates — verbatim source copied with placeholders
  dist/            compiled components (npm run build)
<lang>/           generated SDK for each target (build output)
README.md         human-facing overview
Makefile          per-target deploy recipes
\`\`\`

---

Generated by [@voxgig/sdkgen](https://github.com/voxgig/sdkgen). Regenerate
with \`cd .sdk && npm run generate\`.
`);
});
const AgentGuideTop = (0, component_1.cmp)(function AgentGuideTop(props) {
    const { ctx$ } = props;
    const { model } = ctx$;
    if (model.name && !model.Name)
        (0, jostraca_1.names)(model, model.name);
    const Name = (0, AgentGuideContent_1.projectName)(model);
    const targets = (0, AgentGuideContent_1.activeTargets)(model);
    const features = (0, AgentGuideContent_1.activeFeatures)(model);
    const entities = (0, AgentGuideContent_1.activeEntities)(model);
    const s = { Name, model, targets, features, entities };
    (0, jostraca_1.File)({ name: 'AGENTS.md' }, () => {
        AgentGuideTopIntro({ s });
        AgentGuideTopTargets({ s });
        AgentGuideTopFeatures({ s });
        AgentGuideTopEntities({ s });
        AgentGuideTopStation({ s });
        AgentGuideTopWorkflow({ s });
        AgentGuideTopFeatureGuide({ s });
        AgentGuideTopCustomise({ s });
        AgentGuideTopAontu({ s });
        AgentGuideTopLayout({ s });
    });
    (0, jostraca_1.File)({ name: 'CLAUDE.md' }, () => {
        (0, jostraca_1.Content)((0, AgentGuideContent_1.claudePointer)(`${Name} SDK`));
    });
    ctx$.log?.info?.({ point: 'generate-agentguide-top', note: 'name:' + Name });
});
exports.AgentGuideTop = AgentGuideTop;
//# sourceMappingURL=AgentGuideTop.js.map