"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeTop = void 0;
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const utility_1 = require("../utility");
const ReadmeTop = (0, jostraca_1.cmp)(function ReadmeTop(props) {
    const { ctx$ } = props;
    const { model } = ctx$;
    const desc = model.main.def.desc || '';
    const entity = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.entity`);
    const target = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.target`);
    const feature = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.feature`);
    const publishedEntities = (0, jostraca_1.each)(entity).filter((e) => e.publish);
    const activeTargets = (0, jostraca_1.each)(target);
    (0, jostraca_1.File)({ name: 'README.md' }, () => {
        (0, jostraca_1.Content)(`# ${model.Name} SDK

${desc}

`);
        // Target links
        if (activeTargets.length > 0) {
            (0, jostraca_1.Content)(`Available for `);
            const links = activeTargets.map((t) => `[${t.title}](${t.name}/)`);
            (0, jostraca_1.Content)(`${links.join(' and ')}.

`);
        }
        // Entities section
        if (publishedEntities.length > 0) {
            (0, jostraca_1.Content)(`
## Entities

The API exposes ${publishedEntities.length === 1 ? 'one entity' : publishedEntities.length + ' entities'}:

| Entity | Description | API path |
| --- | --- | --- |
`);
            publishedEntities.map((ent) => {
                const desc = ent.short || '';
                const ops = ent.op || {};
                const points = Object.values(ops).map((op) => op.points ? Object.values(op.points) : []).flat();
                const path = points.length > 0
                    ? points[0].path || ''
                    : '';
                (0, jostraca_1.Content)(`| **${ent.Name}** | ${desc} | \`${path}\` |
`);
            });
            (0, jostraca_1.Content)(`
Each entity supports the following operations where available: **load**, **list**, **create**,
**update**, and **remove**.

`);
        }
        // Architecture section
        (0, jostraca_1.Content)(`
## Architecture

### Entity-operation model

Every SDK call follows the same pipeline:

1. **Point** — resolve the API endpoint from the operation definition.
2. **Spec** — build the HTTP specification (URL, method, headers, body).
3. **Request** — send the HTTP request.
4. **Response** — receive and parse the response.
5. **Result** — extract the result data for the caller.

At each stage a feature hook fires (e.g. \`PrePoint\`, \`PreSpec\`,
\`PreRequest\`), allowing features to inspect or modify the pipeline.

### Features

Features are hook-based middleware that extend SDK behaviour.

| Feature | Purpose |
| --- | --- |
`);
        (0, jostraca_1.each)(feature, (feat) => {
            if (!feat.active)
                return;
            const purpose = feat.title || feat.Name;
            (0, jostraca_1.Content)(`| **${feat.Name}Feature** | ${purpose} |
`);
        });
        (0, jostraca_1.Content)(`
You can add custom features by passing them in the \`extend\` option at
construction time.

### Direct and Prepare

For endpoints not covered by the entity model, use the low-level methods:

- **\`direct(fetchargs)\`** — build and send an HTTP request in one step.
- **\`prepare(fetchargs)\`** — build the request without sending it.

Both accept a map with \`path\`, \`method\`, \`params\`, \`query\`, \`headers\`,
and \`body\`.

`);
        // Quick start section with examples from each target
        (0, jostraca_1.Content)(`
## Quick start

`);
        activeTargets.map((tgt) => {
            const ReadmeTopQuick_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${tgt.name}/ReadmeTopQuick_${tgt.name}`, { ignore: true });
            if (ReadmeTopQuick_sdk) {
                (0, jostraca_1.Content)(`### ${tgt.title}

`);
                ReadmeTopQuick_sdk['ReadmeTopQuick']({ target: tgt });
                (0, jostraca_1.Content)(`
`);
            }
        });
        // Testing section
        (0, jostraca_1.Content)(`
## Testing

Both SDKs provide a test mode that replaces the HTTP transport with an
in-memory mock, so tests run without a network connection.

`);
        activeTargets.map((tgt) => {
            const ReadmeTopTest_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${tgt.name}/ReadmeTopTest_${tgt.name}`, { ignore: true });
            if (ReadmeTopTest_sdk) {
                (0, jostraca_1.Content)(`### ${tgt.title}

`);
                ReadmeTopTest_sdk['ReadmeTopTest']({ target: tgt });
                (0, jostraca_1.Content)(`
`);
            }
        });
        // How-to guides
        (0, jostraca_1.Content)(`
## How-to guides

### Make a direct API call

When the entity interface does not cover an endpoint, use \`direct\`:

`);
        activeTargets.map((tgt) => {
            const ReadmeTopHowto_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${tgt.name}/ReadmeTopHowto_${tgt.name}`, { ignore: true });
            if (ReadmeTopHowto_sdk) {
                ReadmeTopHowto_sdk['ReadmeTopHowto']({ target: tgt });
            }
        });
        // Language-specific links
        (0, jostraca_1.Content)(`
## Language-specific documentation

`);
        activeTargets.map((tgt) => {
            (0, jostraca_1.Content)(`- [${tgt.title} SDK](${tgt.name}/README.md)
`);
        });
        (0, jostraca_1.Content)(`
`);
    });
});
exports.ReadmeTop = ReadmeTop;
//# sourceMappingURL=ReadmeTop.js.map