"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeTop = void 0;
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const utility_1 = require("../utility");
const packageMeta_1 = require("../helpers/packageMeta");
const SDKGEN_REPO = 'https://github.com/voxgig/sdkgen';
// Per-language install commands rendered in the top-level "Try it"
// section. The per-language `ReadmeInstall_<lang>.ts` templates exist
// but emit extra prose ("Or install from source: ..."); for the
// landing-page README we want a single copy-paste line per language.
function installCommand(target, model) {
    // Delegate to the single source of truth so the README install command can
    // never drift from the real published package name (see helpers/packageMeta).
    return (0, packageMeta_1.installCommand)(model, target.name);
}
// Pick the language we lead the README with — first entry from the
// docs-ordered SDK targets. Returns undefined if there are no targets.
function pickLeadTarget(sdkTargets) {
    return sdkTargets[0];
}
const ReadmeTop = (0, jostraca_1.cmp)(function ReadmeTop(props) {
    const { ctx$ } = props;
    const { model } = ctx$;
    // Ensure the Name/NAME case variants exist (apidef usually sets these,
    // but guard so the header never renders "undefined SDK"). Entity/feature
    // names are guarded the same way below.
    if (model.name && !model.Name)
        (0, jostraca_1.names)(model, model.name);
    const info = (model.main && model.main[types_1.KIT] && model.main[types_1.KIT].info) || {};
    const def = (model.main && model.main.def) || {};
    // Plain-text title — prefer the OpenAPI `info.title` when it's
    // recognisably the product name (e.g. "Aare.guru API"), fall back
    // to the normalised SDK Name.
    const productName = info.title || `${model.Name} API`;
    const tagline = info.tagline
        || def.tagline
        || `${productName} client, generated from the OpenAPI spec.`;
    const aboutMd = info.about_md || '';
    const licenseMd = info.license_md || '';
    const licenseShort = info.license_short || '';
    const homepage = info.homepage || '';
    const docsUrl = info.docs_url || '';
    const entityDesc = info.entity_desc || {};
    const entity = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.entity`);
    const target = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.target`);
    const feature = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.feature`);
    (0, jostraca_1.each)(entity, (ent) => { if (!ent.Name)
        (0, jostraca_1.names)(ent, ent.name); });
    (0, jostraca_1.each)(feature, (feat) => { if (!feat.Name)
        (0, jostraca_1.names)(feat, feat.name); });
    const activeEntities = (0, jostraca_1.each)(entity).filter((e) => e.active !== false);
    const activeTargets = (0, jostraca_1.each)(target).filter((t) => t.active !== false);
    const hasCli = activeTargets.some((t) => t.name === 'go-cli');
    const hasMcp = activeTargets.some((t) => t.name === 'go-mcp');
    const hasJsLike = activeTargets.some((t) => t.name === 'ts' || t.name === 'js');
    // Canonical docs order from main.kit.config.docs_order (with a
    // schema-supplied default of ['ts','py','php','go','rb','lua']).
    // Targets present but not listed get appended in spec-defined order,
    // so adding a new target never silently disappears from the docs.
    const docsOrder = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.config.docs_order`, { only_active: false, required: false }) || [];
    const sdkTargets = activeTargets
        .filter((t) => t.name !== 'go-cli' && t.name !== 'go-mcp')
        .slice()
        .sort((a, b) => {
        const ai = docsOrder.indexOf(a.name);
        const bi = docsOrder.indexOf(b.name);
        const av = ai === -1 ? docsOrder.length : ai;
        const bv = bi === -1 ? docsOrder.length : bi;
        return av - bv;
    });
    const langList = sdkTargets.map((t) => t.title).join(', ');
    const leadTarget = pickLeadTarget(sdkTargets);
    (0, jostraca_1.File)({ name: 'README.md' }, () => {
        // 1. H1 + one-line value prop + unofficial / non-affiliation disclosure
        (0, jostraca_1.Content)(`# ${model.Name} SDK

${tagline}

${(0, packageMeta_1.nonAffiliation)(model)}

`);
        // Positioning line, only when we actually have multiple SDK targets.
        if (sdkTargets.length > 1) {
            const surfaces = [];
            surfaces.push(`${langList} SDKs`);
            if (hasCli)
                surfaces.push('a CLI');
            if (hasJsLike)
                surfaces.push('an interactive REPL');
            if (hasMcp)
                surfaces.push('an MCP server for AI agents');
            const surfaceList = surfaces.length > 1
                ? surfaces.slice(0, -1).join(', ') + ', and ' + surfaces[surfaces.length - 1]
                : surfaces[0];
            (0, jostraca_1.Content)(`> ${surfaceList} — all generated from one OpenAPI spec by [@voxgig/sdkgen](${SDKGEN_REPO}).

`);
        }
        // 2. About / what the API is
        if (aboutMd) {
            (0, jostraca_1.Content)(`## About ${productName}

${aboutMd.trim()}

`);
        }
        else if (def.desc) {
            (0, jostraca_1.Content)(`${def.desc}

`);
        }
        // 2b. Entities-first framing: the API surface is a small set of semantic,
        // Capitalised entities — NOT raw URL paths/queries — which is the core
        // mental model the SDK is built around (model-driven; lists real entities).
        if (activeEntities.length > 0) {
            const entNames = activeEntities.map((e) => e.Name);
            const entList = entNames.length > 1
                ? entNames.slice(0, -1).join(', ') + ' and ' + entNames[entNames.length - 1]
                : entNames[0];
            const ex = activeEntities[0].Name;
            (0, jostraca_1.Content)(`## Entities, not endpoints

This SDK exposes the API as a small set of **semantic entities** — ${entList} — that you
call directly, instead of assembling URL paths and query strings. Entities are
**Capitalised** to mark them as the primary surface; each offers the standard
operations \`list\`, \`load\`, \`create\`, \`update\`, and \`remove\`:

\`\`\`ts
const client = new ${model.Name}SDK()
const items = await client.${ex}().list()
\`\`\`

Thinking in entities keeps the mental model small — for people and AI agents alike —
rather than reasoning about raw HTTP routes and query parameters.

`);
        }
        // 3. Packages — real published package name + install command per
        // ecosystem. A package that is NOT yet live on its registry (the fleet
        // default: 'pending') must NOT advertise a `npm install ...` that 404s —
        // its Install cell links to the git-tag releases page instead. The go
        // family resolves from the tag directly (`go get <mod>@latest`).
        if (sdkTargets.length > 0) {
            const { releasesUrl } = (0, packageMeta_1.repoInfo)(model);
            (0, jostraca_1.Content)(`## Packages

| Language | Package | Install |
| --- | --- | --- |
`);
            sdkTargets.forEach((tgt) => {
                const state = (0, packageMeta_1.registryState)(model, tgt.name);
                let cell;
                if ('active' === state) {
                    const cmd = installCommand(tgt, model);
                    if (!cmd)
                        return;
                    cell = '`' + cmd + '`';
                }
                else if ('tag' === state) {
                    // Tag-only port (go): the vendor command IS the real install.
                    cell = '`' + (0, packageMeta_1.vendorCommand)(model, tgt.name) + '`';
                }
                else {
                    // pending / inactive: point at the git tag, never a 404 command.
                    cell = `publish pending — [install from git tag](${releasesUrl})`;
                }
                (0, jostraca_1.Content)(`| ${tgt.title} | \`${(0, packageMeta_1.packageName)(model, tgt.name)}\` | ${cell} |
`);
            });
            (0, jostraca_1.Content)(`
`);
        }
        // 4. Quickstart in the lead language
        if (leadTarget) {
            (0, jostraca_1.Content)(`## Quickstart

### ${leadTarget.title}

`);
            const LeadQuick = (0, utility_1.requirePath)(ctx$, `./cmp/${leadTarget.name}/ReadmeTopQuick_${leadTarget.name}`, { ignore: true });
            if (LeadQuick) {
                LeadQuick['ReadmeTopQuick']({ target: leadTarget });
            }
            (0, jostraca_1.Content)(`
See the [${leadTarget.title} README](${leadTarget.name}/README.md) for the full guide.

`);
        }
        // 5. Surface table
        if (sdkTargets.length > 0 || hasCli || hasMcp) {
            (0, jostraca_1.Content)(`## Surfaces

| Surface | Path |
| --- | --- |
`);
            if (sdkTargets.length > 0) {
                const paths = sdkTargets.map((t) => `\`${t.name}/\``).join(' ');
                (0, jostraca_1.Content)(`| **SDK** (${langList}) | ${paths} |
`);
            }
            if (hasCli) {
                (0, jostraca_1.Content)(`| **CLI** | \`go-cli/\` |
`);
            }
            if (hasMcp) {
                (0, jostraca_1.Content)(`| **MCP server** | \`go-mcp/\` |
`);
            }
            (0, jostraca_1.Content)(`
`);
        }
        // 6. MCP / agent usage — only if MCP target is enabled
        if (hasMcp) {
            (0, jostraca_1.Content)(`## Use it from an AI agent (MCP)

The generated MCP server exposes every operation in this SDK as an
[MCP](https://modelcontextprotocol.io) tool that Claude, Cursor or Cline
can call directly. Build and register it:

\`\`\`bash
cd go-mcp && go build -o ${model.name}-mcp .
\`\`\`

Then add it to your agent's MCP config (Claude Desktop, Cursor, etc.):

\`\`\`json
{
  "mcpServers": {
    "${model.name}": {
      "command": "/abs/path/to/${model.name}-mcp"
    }
  }
}
\`\`\`

`);
        }
        // 7. Entities table
        if (activeEntities.length > 0) {
            (0, jostraca_1.Content)(`## Entities

The API exposes ${activeEntities.length === 1 ? 'one entity' : activeEntities.length + ' entities'}:

| Entity | Description | API path |
| --- | --- | --- |
`);
            activeEntities.map((ent) => {
                const ops = ent.op || {};
                const opNames = Object.keys(ops).filter((o) => ops[o]?.active !== false);
                // Never emit a blank description cell: fall back to an ops-derived line.
                const entdesc = entityDesc[ent.name] || ent.short || ent.desc ||
                    `The ${ent.Name} entity${opNames.length ? ' (' + opNames.join(', ') + ')' : ''}.`;
                const points = (0, jostraca_1.each)(ops).map((op) => op.points ? (0, jostraca_1.each)(op.points) : []).flat();
                const path = points.length > 0
                    ? points[0].orig || ''
                    : '';
                (0, jostraca_1.Content)(`| **${ent.Name}** | ${entdesc} | \`${path}\` |
`);
            });
            (0, jostraca_1.Content)(`
Each entity supports the following operations where available: **load**,
**list**, **create**, **update**, and **remove**.

`);
        }
        // 8. Quickstart in the other languages (lead is already covered above)
        const otherTargets = sdkTargets.filter((t) => leadTarget && t.name !== leadTarget.name);
        if (otherTargets.length > 0) {
            (0, jostraca_1.Content)(`## Quickstart in other languages

`);
            otherTargets.forEach((tgt) => {
                const Quick = (0, utility_1.requirePath)(ctx$, `./cmp/${tgt.name}/ReadmeTopQuick_${tgt.name}`, { ignore: true });
                if (Quick) {
                    (0, jostraca_1.Content)(`### ${tgt.title}

`);
                    Quick['ReadmeTopQuick']({ target: tgt });
                    (0, jostraca_1.Content)(`
`);
                }
            });
        }
        // 9. Testing — keep, but slim
        if (sdkTargets.length > 0) {
            (0, jostraca_1.Content)(`## Unit testing in offline mode

Every SDK ships a test mode that swaps the HTTP transport for an
in-memory mock, so unit tests run offline.

`);
            sdkTargets.forEach((tgt) => {
                const Test = (0, utility_1.requirePath)(ctx$, `./cmp/${tgt.name}/ReadmeTopTest_${tgt.name}`, { ignore: true });
                if (Test) {
                    (0, jostraca_1.Content)(`### ${tgt.title}

`);
                    Test['ReadmeTopTest']({ target: tgt });
                    (0, jostraca_1.Content)(`
`);
                }
            });
        }
        // 10. How it works (was: Architecture)
        (0, jostraca_1.Content)(`## How it works

Every SDK call runs the same five-stage pipeline:

1. **Point** — resolve the API endpoint from the operation definition.
2. **Spec** — build the HTTP specification (URL, method, headers, body).
3. **Request** — send the HTTP request.
4. **Response** — receive and parse the response.
5. **Result** — extract the result data for the caller.

A feature hook fires at each stage (e.g. \`PrePoint\`, \`PreSpec\`,
\`PreRequest\`), so features can inspect or modify the pipeline without
forking the SDK.

### Features

`);
        (0, jostraca_1.Content)(`| Feature | Purpose |
| --- | --- |
`);
        (0, jostraca_1.each)(feature, (feat) => {
            if (!feat.active)
                return;
            const purpose = feat.title || feat.Name || feat.name;
            (0, jostraca_1.Content)(`| **${feat.Name || feat.name}Feature** | ${purpose} |
`);
        });
        (0, jostraca_1.Content)(`
Pass custom features via the \`extend\` option at construction time.

### Direct and Prepare

For endpoints the entity model doesn't cover, use the low-level methods:

- **\`direct(fetchargs)\`** — build and send an HTTP request in one step.
- **\`prepare(fetchargs)\`** — build the request without sending it.

Both accept a map with \`path\`, \`method\`, \`params\`, \`query\`,
\`headers\`, and \`body\`. See the [How-to guides](#how-to-guides) below.

`);
        // 11. How-to guides — keep, useful for the engineer reader
        (0, jostraca_1.Content)(`## How-to guides

### Make a direct API call

When the entity interface does not cover an endpoint, use \`direct\`:

`);
        sdkTargets.forEach((tgt) => {
            const Howto = (0, utility_1.requirePath)(ctx$, `./cmp/${tgt.name}/ReadmeTopHowto_${tgt.name}`, { ignore: true });
            if (Howto) {
                Howto['ReadmeTopHowto']({ target: tgt });
            }
        });
        // 12. Per-language docs links
        if (sdkTargets.length > 0) {
            (0, jostraca_1.Content)(`## Per-language documentation

`);
            sdkTargets.forEach((tgt) => {
                (0, jostraca_1.Content)(`- [${tgt.title}](${tgt.name}/README.md)
`);
            });
            (0, jostraca_1.Content)(`
`);
        }
        // 13. Upstream API — contact/servers from the OpenAPI info block
        const upstreamUrl = (info.contact && info.contact.url)
            || (info.servers && info.servers[0] && info.servers[0].url)
            || homepage;
        if (upstreamUrl || docsUrl) {
            (0, jostraca_1.Content)(`## Upstream API

This SDK is generated from the upstream OpenAPI specification. It is an
unofficial client and is not affiliated with the API provider.

`);
            if (upstreamUrl) {
                (0, jostraca_1.Content)(`- Upstream API: [${upstreamUrl}](${upstreamUrl})
`);
            }
            if (docsUrl && docsUrl !== upstreamUrl) {
                (0, jostraca_1.Content)(`- Documentation: [${docsUrl}](${docsUrl})
`);
            }
            (0, jostraca_1.Content)(`
`);
        }
        // 13b. Security
        (0, jostraca_1.Content)(`## Security

Please report security issues to ${packageMeta_1.SECURITY_EMAIL}. See [SECURITY.md](SECURITY.md).
Do not open public issues for suspected vulnerabilities.

`);
        // 14. Provenance footer
        (0, jostraca_1.Content)(`---

Generated from the ${productName} OpenAPI spec by [@voxgig/sdkgen](${SDKGEN_REPO}).
`);
    });
});
exports.ReadmeTop = ReadmeTop;
//# sourceMappingURL=ReadmeTop.js.map