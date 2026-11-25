"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeTop = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const types_1 = require("../types");
const utility_1 = require("../utility");
const optional_1 = require("../helpers/optional");
const FeatureDocs_1 = require("./FeatureDocs");
const FeatureHook_1 = require("./FeatureHook");
const opShape_1 = require("../helpers/opShape");
const opExample_1 = require("../helpers/opExample");
const mcpTools_1 = require("../helpers/mcpTools");
const canonType_1 = require("../helpers/canonType");
const naming_1 = require("../helpers/naming");
const text_1 = require("../helpers/text");
const facts_1 = require("../helpers/facts");
const surface_1 = require("../helpers/surface");
const copymerge_1 = require("../helpers/copymerge");
const packageMeta_1 = require("../helpers/packageMeta");
const SDKGEN_REPO = 'https://github.com/voxgig/sdkgen';
const VOXGIG_SDK = 'https://voxgig.com/sdk/';
// A type-correct TS example literal for a model field, keyed off its canonical
// type sentinel — mirrors the per-language `exampleValue`, but inline because
// this neutral component renders the intro `ts` block directly.
function tsExampleLiteral(type) {
    const k = (0, canonType_1.canonScalarKey)(type);
    if ('NULL' === k)
        return 'null';
    if ('INTEGER' === k || 'NUMBER' === k)
        return '1';
    if ('BOOLEAN' === k)
        return 'true';
    if ('ARRAY' === k)
        return '[]';
    if ('OBJECT' === k)
        return '{}';
    return `'example'`;
}
function installCommand(target, model) {
    return (0, packageMeta_1.installCommand)(model, target.name);
}
function pickLeadTarget(sdkTargets) {
    return sdkTargets[0];
}
const EXAMPLE_FENCE = {
    ts: 'ts', js: 'js', py: 'python', go: 'go', php: 'php', rb: 'ruby', lua: 'lua',
};
function exampleLang(model, sdkTargets) {
    const langs = sdkTargets.map((t) => (0, packageMeta_1.originName)(model, t.name));
    return opExample_1.EXAMPLE_LANGS.find((lang) => langs.includes(lang));
}
// A client and one call in a language other than ts, whose example
// ReadmeTop builds itself.
function entityExample(lang, Name, call) {
    switch (lang) {
        case 'js': return `const client = new ${Name}SDK()` +
            (call ? `\nconst ${call.resultVar} = await ${call.expr}` : '');
        case 'py': return `client = ${Name}SDK()` +
            (call ? `\n${call.resultVar} = ${call.expr}` : '');
        case 'go': return `client := sdk.New${Name}SDK(nil)` +
            (call ? `\n${call.resultVar}, err := ${call.expr}` : '');
        case 'php': return `$client = new ${Name}SDK();` +
            (call ? `\n$${call.resultVar} = ${call.expr};` : '');
        case 'rb': return `client = ${Name}SDK.new` +
            (call ? `\n${call.resultVar} = ${call.expr}` : '');
        case 'lua': return `local client = sdk.new()` +
            (call ? `\nlocal ${call.resultVar}, err = ${call.expr}` : '');
        default: return '';
    }
}
const ReadmeTopTitle = (0, component_1.cmp)(function ReadmeTopTitle(props) {
    const { model, tagline, apiSummary, websiteLine, metaSourceLine } = props.s;
    (0, jostraca_1.Content)(`# ${model.Name} SDK

${tagline}

`);
    if (apiSummary) {
        (0, jostraca_1.Content)(`${apiSummary}

`);
    }
    if (websiteLine) {
        (0, jostraca_1.Content)(`${websiteLine}

`);
    }
    (0, jostraca_1.Content)(`${(0, packageMeta_1.nonAffiliation)(model)}

`);
    if ((0, packageMeta_1.isDefaultPublisher)(model)) {
        (0, jostraca_1.Content)(`Learn more about Voxgig SDKs at [voxgig.com/sdk](${VOXGIG_SDK}).

`);
    }
    // THE GENERATED SITE, LINKED FROM THE TOP, because the repository was the
    // one place it could not be found from. `docs_url` further down is the
    // UPSTREAM API's documentation, not this, and a reader who lands on the
    // repo rather than arriving from a link had no route to the site at all.
    // Empty unless the project actually publishes one -- see docsSiteUrl.
    const siteUrl = (0, packageMeta_1.docsSiteUrl)(model);
    if (siteUrl) {
        (0, jostraca_1.Content)(`Full documentation for this SDK: [${siteUrl}](${siteUrl})

`);
    }
    if (metaSourceLine) {
        (0, jostraca_1.Content)(`${metaSourceLine}

`);
    }
});
const ReadmeTopSurfaceLine = (0, component_1.cmp)(function ReadmeTopSurfaceLine(props) {
    const { hasCli, hasMcp, sdkTargets, consumerTargets, langList, definition } = props.s;
    if (sdkTargets.length > 1) {
        const surfaces = [];
        surfaces.push(`${langList} SDKs`);
        if (hasCli)
            surfaces.push('a CLI with an interactive REPL');
        if (hasMcp)
            surfaces.push('an MCP server for AI agents');
        consumerTargets.forEach((t) => surfaces.push(`the ${(0, facts_1.fact)(t, 'title')} package`));
        const surfaceList = surfaces.length > 1
            ? surfaces.slice(0, -1).join(', ') + ', and ' + surfaces[surfaces.length - 1]
            : surfaces[0];
        (0, jostraca_1.Content)(`> ${surfaceList} — all generated from one ${definition} by [@voxgig/sdkgen](${SDKGEN_REPO}).

`);
    }
});
const ReadmeTopFeatureLine = (0, component_1.cmp)(function ReadmeTopFeatureLine(props) {
    const { model } = props.s;
    // FEATURES BELONG BESIDE THE TARGETS. What an SDK can do is as much a
    // reason to choose it as which language it is in, and a reader who has to
    // scroll past every language section to discover that retries, caching and
    // tracing are built in has already decided it is a thin HTTP wrapper.
    // Named here, in one line, with the detail left to each target's README.
    const features = (0, FeatureDocs_1.featureDocs)(model);
    if (0 < features.length) {
        const on = features.filter((f) => f.on).map((f) => f.name);
        const state = 0 === on.length ? `opt-in,
> inactive until switched on, and configured per client.` : `configured per client.
> ${(0, FeatureDocs_1.codeList)(on)} ${1 === on.length ? 'runs' : 'run'} by default${on.length < features.length ?
            '; the rest are opt-in, inactive until switched on' : ''}.`;
        (0, jostraca_1.Content)(`> **Features:** ${features.map((f) => '`' + f.name + '`').join(', ')} — ${state} See the Features
> section of any SDK README below for what each one does.

`);
    }
});
const ReadmeTopAbout = (0, component_1.cmp)(function ReadmeTopAbout(props) {
    const { text, productName, aboutMd } = props.s;
    if (aboutMd) {
        (0, jostraca_1.Content)(`## About ${productName}

${aboutMd}

`);
    }
    else if (text.desc.text) {
        (0, jostraca_1.Content)(`${text.desc.text}

`);
    }
});
const ReadmeTopEntityModel = (0, component_1.cmp)(function ReadmeTopEntityModel(props) {
    const { model, activeEntities, sdkTargets } = props.s;
    if (activeEntities.length > 0) {
        const entNames = activeEntities.map((e) => e.Name);
        const entCount = entNames.length;
        const entList = entCount > 1
            ? entNames.slice(0, -1).join(', ') + ' and ' + entNames[entNames.length - 1]
            : entNames[0];
        const NAME_INLINE_MAX = 6;
        const inlineNames = entCount <= NAME_INLINE_MAX;
        const surface = inlineNames
            ? `a small set of **semantic entities** — ${entList} —`
            : `**${entCount} semantic entities**`;
        const seeEntities = inlineNames
            ? ''
            : ' See the [Entities](#entities) table below for the full list.';
        const exEnt = activeEntities[0];
        const ex = exEnt.Name;
        const exLower = (0, naming_1.exampleVarName)(ex.toLowerCase(), 'ts');
        // The example call uses the entity's PRIMARY op — an op it actually
        // exposes (prefer list -> the array, then load -> the record, else a
        // create with its required fields). A create-only entity therefore never
        // shows a phantom .list()/.load() that would not compile. If it exposes
        // only remove (or nothing), the op line is omitted entirely.
        const primaryOp = (0, opShape_1.entityPrimaryOp)(exEnt);
        let exCall = '';
        const exIdField = (0, opShape_1.entityIdField)(exEnt);
        const exListArg = (0, opExample_1.listMatchArg)('ts', exEnt);
        const exLoadArg = (0, opExample_1.matchArg)('ts', exEnt, 'load', exIdField, (0, opExample_1.idLiteral)(exEnt, 'load', exIdField));
        if ('list' === primaryOp) {
            exCall = `const items = await client.${ex}().list(${exListArg})`;
        }
        else if ('load' === primaryOp) {
            exCall = `const ${exLower} = await client.${ex}().load(${exLoadArg})`;
        }
        else if ('create' === primaryOp || 'update' === primaryOp || 'patch' === primaryOp) {
            const exIdF = (0, opShape_1.entityIdField)(exEnt);
            // Drop the id only when the request shape says it is OPTIONAL. It is
            // server-assigned on a normal create, but an op whose id comes from a
            // PATH PARAMETER requires it, and the typed CreateData then rejects a
            // body without it. Same rule as dataArg in helpers/opExample.
            const shapeItems = (0, opExample_1.requestExampleItems)(exEnt, primaryOp)
                .filter((it) => (it.name !== exIdF && it.name !== 'id') || !it.optional);
            const required = shapeItems.filter((it) => !it.optional);
            const chosen = required.length ? required : shapeItems.slice(0, 3);
            const bodyLines = chosen.map((it) => `  ${(0, naming_1.jsKey)(it.name)}: ${tsExampleLiteral(it.type)},`);
            const body = bodyLines.length ? `\n${bodyLines.join('\n')}\n` : '';
            exCall = `const ${exLower} = await client.${ex}().${primaryOp}({${body}})`;
        }
        const CANON_OPS = ['list', 'load', 'create', 'update', 'patch', 'remove'];
        const opSet = new Set();
        activeEntities.forEach((e) => Object.keys(e.op || {})
            .forEach((o) => { if (e.op[o] && e.op[o].active !== false)
            opSet.add(o); }));
        const opNames = CANON_OPS.filter((o) => opSet.has(o)).concat([...opSet].filter((o) => !CANON_OPS.includes(o)));
        const opList = (opNames.length ? opNames : ['list', 'load']).map((o) => '`' + o + '`').join(', ');
        // In the SDK's own language: ts when it has one, else the first the
        // example helpers can write, else no example at all.
        const lang = exampleLang(model, sdkTargets);
        let snippet = '';
        if ('ts' === lang) {
            snippet = `const client = new ${model.Name}SDK()${exCall ? '\n' + exCall : ''}`;
        }
        else if (null != lang) {
            const call = ['list', 'load', 'create', 'update', 'patch'].includes(String(primaryOp))
                ? (0, opExample_1.primaryOpCall)(lang, ex, (0, naming_1.exampleVarName)(ex.toLowerCase(), lang), primaryOp, exIdField, exEnt)
                : null;
            snippet = entityExample(lang, model.Name, call);
        }
        const exBlock = '' === snippet ? '.' :
            `:\n\n\`\`\`${EXAMPLE_FENCE[lang]}\n${snippet}\n\`\`\``;
        (0, jostraca_1.Content)(`## Entities, not endpoints

This SDK exposes the API as ${surface} that you
call directly, instead of assembling URL paths and query strings.${seeEntities} Entities are
**Capitalised** to mark them as the primary surface, each with the operations they
support (${opList})${exBlock}

Thinking in entities keeps the mental model small — for people and AI agents alike —
rather than reasoning about raw HTTP routes and query parameters.

`);
    }
});
const ReadmeTopTesting = (0, component_1.cmp)(function ReadmeTopTesting(props) {
    const { ctx$, sdkTargets } = props.s;
    if (sdkTargets.length > 0) {
        (0, jostraca_1.Content)(`## Offline unit testing

Every SDK ships a built-in **test mode** that swaps the HTTP transport for
an in-memory mock, so your unit tests run fully offline — no server, no
network, and no credentials:

`);
        sdkTargets.forEach((tgt) => {
            const Test = (0, optional_1.optionalComponent)(ctx$, tgt, 'ReadmeTopTest');
            if (Test) {
                (0, jostraca_1.Content)(`### ${(0, facts_1.fact)(tgt, 'title')}

`);
                Test['ReadmeTopTest']({ target: tgt });
                (0, jostraca_1.Content)(`
`);
            }
        });
    }
});
const ReadmeTopPackages = (0, component_1.cmp)(function ReadmeTopPackages(props) {
    const { model, pkgTargets } = props.s;
    // 3. Packages — real published package name + install command per
    // ecosystem. A package that is NOT yet live on its registry (the fleet
    // default: 'pending') must NOT advertise a `npm install ...` that 404s —
    // its Install cell links to the target README's install section instead,
    // as do go-cli and go-mcp, which the Go proxy cannot install.
    if (pkgTargets.length > 0) {
        (0, jostraca_1.Content)(`## Packages

| Language | Package | Install |
| --- | --- | --- |
`);
        pkgTargets.forEach((tgt) => {
            const state = (0, packageMeta_1.registryState)(model, tgt.name);
            const readme = (0, facts_1.fact)(tgt, 'docs').readme;
            let cell;
            if ('active' === state) {
                const cmd = installCommand(tgt, model);
                cell = cmd
                    ? '`' + cmd + '`'
                    : readme ? `see [${tgt.name}/README.md](${tgt.name}/README.md#install)` : `see \`${tgt.name}/\``;
            }
            else if ('tag' === state) {
                const cmd = (0, packageMeta_1.vendorCommand)(model, tgt.name);
                cell = cmd
                    ? '`' + cmd + '`'
                    : 'build from source — ' + (readme ? `[${tgt.name}/README.md](${tgt.name}/README.md)` : `\`${tgt.name}/\``);
            }
            else {
                // The target README always gives a route that works without a
                // tag, which a repository may not have.
                cell = readme ? `publish pending — [install from source](${tgt.name}/README.md#install)` :
                    `publish pending — install from source in \`${tgt.name}/\``;
            }
            (0, jostraca_1.Content)(`| ${(0, facts_1.fact)(tgt, 'title')} | \`${(0, packageMeta_1.packageName)(model, tgt.name)}\` | ${cell} |
`);
        });
        (0, jostraca_1.Content)(`
`);
    }
});
const ReadmeTopQuickstart = (0, component_1.cmp)(function ReadmeTopQuickstart(props) {
    const { model, ctx$, leadTarget } = props.s;
    if (leadTarget) {
        (0, jostraca_1.Content)(`## Quickstart

### ${(0, facts_1.fact)(leadTarget, 'title')}

`);
        const LeadQuick = (0, optional_1.optionalComponent)(ctx$, leadTarget, 'ReadmeTopQuick');
        if (LeadQuick) {
            LeadQuick['ReadmeTopQuick']({ target: leadTarget });
        }
        const placement = (0, utility_1.credentialPlacement)(model);
        (0, jostraca_1.Content)(`
${'' === placement ? '' : placement + '\n\n'}${(0, facts_1.fact)(leadTarget, 'docs').readme ?
            `See the [${(0, facts_1.fact)(leadTarget, 'title')} README](${leadTarget.name}/README.md) for the full guide.` : ''}

`);
    }
});
const ReadmeTopSurfaces = (0, component_1.cmp)(function ReadmeTopSurfaces(props) {
    const { hasCli, hasMcp, cliTargets, mcpTargets, sdkTargets, consumerTargets, langList } = props.s;
    const paths = (targets) => targets.map((t) => `\`${t.name}/\``).join(' ');
    if (sdkTargets.length > 0 || hasCli || hasMcp || consumerTargets.length > 0) {
        (0, jostraca_1.Content)(`## Surfaces

| Surface | Path |
| --- | --- |
`);
        if (sdkTargets.length > 0) {
            (0, jostraca_1.Content)(`| **SDK** (${langList}) | ${paths(sdkTargets)} |
`);
        }
        if (hasCli) {
            (0, jostraca_1.Content)(`| **CLI** | ${paths(cliTargets)} |
`);
        }
        if (hasMcp) {
            (0, jostraca_1.Content)(`| **MCP server** | ${paths(mcpTargets)} |
`);
        }
        consumerTargets.forEach((t) => {
            (0, jostraca_1.Content)(`| **${(0, facts_1.fact)(t, 'title')}** | \`${t.name}/\` |
`);
        });
        (0, jostraca_1.Content)(`
`);
    }
});
const ReadmeTopMcp = (0, component_1.cmp)(function ReadmeTopMcp(props) {
    const { model, hasMcp, mcpTargets } = props.s;
    if (hasMcp) {
        const mcp = mcpTargets[0].name;
        const mcpOps = (0, mcpTools_1.mcpTools)(model, mcp).map((tool) => tool.op);
        const mcpWrite = true === mcpTargets[0].tool?.write;
        const toggle = `\`main: kit: target: '${mcp}': tool: write: true\``;
        const opText = mcpOps.length < 2 ? mcpOps.join('') :
            mcpOps.slice(0, -1).join(', ') + ' and ' + mcpOps[mcpOps.length - 1];
        // What the server reads and writes is what it registers, not the flag.
        const reads = mcpOps.some((op) => mcpTools_1.MCP_WRITE_OPS.includes(op)) ? '' : mcpWrite ?
            ' It only reads, as no entity has a create, update, patch or remove a plain call runs.' :
            ` It only reads: create, update, patch and remove become tools when the SDK's model sets
${toggle}.`;
        (0, jostraca_1.Content)(0 === mcpOps.length ? `## Use it from an AI agent (MCP)

The generated MCP server has no tools for this SDK: no entity has a list or
load a plain call runs${mcpWrite ? ', or a create, update, patch or remove' :
            `, and create, update, patch and remove are off until the SDK's model sets
${toggle}`}.

` : `## Use it from an AI agent (MCP)

The generated MCP server exposes this SDK's ${opText} operations as
[MCP](https://modelcontextprotocol.io) tools that Claude, Cursor or Cline
can call directly.${reads} Build and register it:

\`\`\`bash
cd ${mcp} && go build -o ${model.name}-mcp .
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
});
const ReadmeTopEntities = (0, component_1.cmp)(function ReadmeTopEntities(props) {
    const { activeEntities } = props.s;
    if (activeEntities.length > 0) {
        (0, jostraca_1.Content)(`## Entities

The API exposes ${activeEntities.length === 1 ? 'one entity' : activeEntities.length + ' entities'}:

| Entity | Description | API path |
| --- | --- | --- |
`);
        activeEntities.map((ent) => {
            const ops = ent.op || {};
            const opNames = Object.keys(ops).filter((o) => ops[o]?.active !== false);
            const entdesc = (0, facts_1.fact)(ent, 'desc').cell ||
                `The ${ent.Name} entity${opNames.length ? ' (' + opNames.join(', ') + ')' : ''}.`;
            const path = (0, opShape_1.entityPath)(ent);
            (0, jostraca_1.Content)(`| **${ent.Name}** | ${entdesc} | \`${path}\` |
`);
        });
        const opUnion = new Set();
        activeEntities.forEach((e) => Object.keys(e.op || {})
            .forEach((o) => { if (e.op[o]?.active !== false)
            opUnion.add(o); }));
        const opAvail = ['load', 'list', 'create', 'update', 'patch', 'remove'].filter((o) => opUnion.has(o));
        const opBold = (opAvail.length ? opAvail : ['load', 'list']).map((o) => '**' + o + '**').join(', ');
        (0, jostraca_1.Content)(`
The operations available across these entities are ${opBold} — see each entity's
own list above for exactly which it supports.

`);
    }
});
const ReadmeTopOtherLanguages = (0, component_1.cmp)(function ReadmeTopOtherLanguages(props) {
    const { ctx$, sdkTargets, leadTarget } = props.s;
    const otherTargets = sdkTargets.filter((t) => leadTarget && t.name !== leadTarget.name);
    if (otherTargets.length > 0) {
        (0, jostraca_1.Content)(`## Quickstart in other languages

`);
        otherTargets.forEach((tgt) => {
            const Quick = (0, optional_1.optionalComponent)(ctx$, tgt, 'ReadmeTopQuick');
            if (Quick) {
                (0, jostraca_1.Content)(`### ${(0, facts_1.fact)(tgt, 'title')}

`);
                Quick['ReadmeTopQuick']({ target: tgt });
                (0, jostraca_1.Content)(`
`);
            }
        });
    }
});
const ReadmeTopDirect = (0, component_1.cmp)(function ReadmeTopDirect() {
    (0, jostraca_1.Content)(`## Direct and prepare

For endpoints the entity model doesn't cover, use the low-level methods:

- **\`direct(fetchargs)\`** — build and send an HTTP request in one step.
- **\`prepare(fetchargs)\`** — build the request without sending it.

Both accept a map with \`path\`, \`method\`, \`params\`, \`query\`,
\`headers\`, and \`body\`. See the [How-to guides](#how-to-guides) below.

`);
});
const ReadmeTopHowtoGuides = (0, component_1.cmp)(function ReadmeTopHowtoGuides(props) {
    const { ctx$, sdkTargets } = props.s;
    (0, jostraca_1.Content)(`## How-to guides

### Make a direct API call

When the entity interface does not cover an endpoint, use \`direct\`:

`);
    sdkTargets.forEach((tgt) => {
        const Howto = (0, optional_1.optionalComponent)(ctx$, tgt, 'ReadmeTopHowto');
        if (Howto) {
            Howto['ReadmeTopHowto']({ target: tgt });
        }
    });
});
const ReadmeTopAdvanced = (0, component_1.cmp)(function ReadmeTopAdvanced(props) {
    const { feature } = props.s;
    (0, jostraca_1.Content)(`## Advanced

> Everyday use only needs the sections above. This explains the internals
> behind every call — relevant when writing custom features.

Every entity operation runs the same ${(0, FeatureHook_1.pipelineLength)()}-stage pipeline:

${FeatureHook_1.PIPELINE_STAGES.map((s, i) => (i + 1) + '. **' + s.name + '** — ' + s.purpose).join('\n')}

A feature hook fires before each stage (e.g. \`${FeatureHook_1.PIPELINE_STAGES[0].hook}\`, \`${FeatureHook_1.PIPELINE_STAGES[1].hook}\`,
\`${FeatureHook_1.PIPELINE_STAGES[2].hook}\`), so features can inspect or modify the pipeline without
forking the SDK.

`);
    const active = (0, jostraca_1.each)(feature).filter((feat) => feat.active);
    if (0 < active.length) {
        (0, jostraca_1.Content)(`### Features

| Feature | Purpose |
| --- | --- |
`);
        for (const feat of active) {
            const purpose = (0, facts_1.fact)(feat, 'title').cell || feat.Name || feat.name;
            (0, jostraca_1.Content)(`| **${feat.Name || feat.name}Feature** | ${purpose} |
`);
        }
        (0, jostraca_1.Content)(`
`);
    }
    (0, jostraca_1.Content)(`Pass custom features via the \`extend\` option at construction time.

`);
});
const ReadmeTopCustomizing = (0, component_1.cmp)(function ReadmeTopCustomizing(props) {
    const { model, sdkTargets, docTargets, definition } = props.s;
    // 11c. Customization: model-driven declarations, in-repo templates and
    // components, regeneration that overwrites, customising in `.sdk`, and a
    // map of which paths are the project's to edit. Every SDK repo carries
    // its own generator, so this belongs in every README. A repository that
    // regenerates `.sdk` in full says so, since its copies do not merge.
    const mapTarget = sdkTargets[0] || docTargets[0];
    const targetDir = mapTarget ? `\`<target>/\`, such as \`${mapTarget.name}/\`` : `\`<target>/\``;
    const merging = copymerge_1.MERGE === (0, copymerge_1.copyMode)(model.main?.[types_1.KIT]?.copies);
    const mergeNote = merging ?
        `An add merges toolchain updates into the
  edited copies, and \`voxgig-sdkgen doctor\` reports any drift from what a
  resync would write.` :
        `This repository regenerates \`.sdk\` in full
  (\`main: kit: copies: 'overwrite'\`): set it to \`'merge'\` before
  customising, so that an add merges toolchain updates into the edited
  copies.`;
    const copiesRow = merging ?
        `Yes. They are this project's copies, and \`target add\` merges toolchain updates into your edits.` :
        `Only after setting \`copies\` to \`'merge'\`. This repository regenerates them in full.`;
    (0, jostraca_1.Content)(`## Customizing this SDK

This repository contains its own generator (\`.sdk/\`), so the SDK is
customizable without forking any upstream tool:

- **The model** (\`.sdk/model/\`) is what generation reads: the API's
  entities and operations, the targets, the features, and this project's
  own settings. It is written in [aontu](https://aontu.dev), a JSON-based
  specification language designed for building ontologies: easy to edit
  by hand, and files unify rather than override, so small declarations
  compose into one model. Regeneration re-reads it every time.
- **Templates** (\`.sdk/tm/\`) and **components** (\`.sdk/src/cmp/\`) are
  the two layers of generation, copied into this repo: templates are the
  literal per-language source, components generate the API-shaped parts.
- **Regeneration overwrites.** Each run rewrites every generated file from
  the model, the templates and the components, so an edit made to
  generated output is lost. Say what this project needs in its own model
  (\`.sdk/model/project.aontu\`), or extend a target with a component of its
  own in \`.sdk/src/cmp/<target>/\`, registered with \`registerComponent\`,
  which \`voxgig-sdkgen doctor\` reports as an addition rather than drift.
- **Customise in \`.sdk\`.** Edit the templates and components first. When
  they cannot express a change, write a feature of this project's own, or
  an entire custom target, in \`.sdk/model/\`, \`.sdk/tm/\` and
  \`.sdk/src/cmp/\`, and add it by name (\`voxgig-sdkgen feature add\`,
  \`voxgig-sdkgen target add\`). ${mergeNote}

### Project map

| Path | What it holds | Edit it? |
| --- | --- | --- |
| \`.sdk/model/project.aontu\` | This project's own decisions: package names, versions, features and per-target settings | Yes. The scaffold writes it once and never again. |
| \`.sdk/model/text.aontu\` | The README wording, in \`main.kit.text\`: the tagline, the summary and the entity descriptions | Yes. The scaffold writes it once and never again. |
| \`.sdk/model/guide/guide.aontu\` | How the spec's paths map onto entities and operations | Yes. The scaffold writes it once and never again. |
| \`.sdk/model/\`, the rest | The API model built from the spec, and the target and feature definitions | Not by hand. Generation, \`target add\` and a new scaffold run rewrite it, apart from a feature or target this project defines itself. |
| \`.sdk/def/\` | The ${definition} | Replace it when the API changes. Generation rebuilds the model from it. |
| \`.sdk/src/cmp/<target>/\`, \`.sdk/tm/<target>/\` | The components and templates that generate each target | ${copiesRow} |
| \`.sdk/test/\` | The shared test cases the generated tests run | No. |
| ${targetDir} | One generated SDK per target, with its own tests | No. Generation overwrites it. |
| \`README.md\`, \`LICENSE\`, \`Makefile\` and the other root files | The repository's generated files | No. Generation overwrites them. |

### Common commands

Run these from \`.sdk/\`:

\`\`\`bash
npm run generate               # regenerate every target from the model
npm run add-target <target>    # add a target, or resync one after an sdkgen update
npm run add-feature <feature>  # add a feature to every target
npx voxgig-sdkgen doctor       # report where .sdk/ differs from what a resync writes
\`\`\`

In an SDK directory, \`make test\` runs that SDK's tests.

How-to: [customize and propagate templates](https://github.com/voxgig/sdkgen/blob/main/docs/how-to/customize-and-propagate-templates.md).
The full story: [voxgig.com/sdk/custom](https://voxgig.com/sdk/custom).

`);
});
const ReadmeTopPerLanguage = (0, component_1.cmp)(function ReadmeTopPerLanguage(props) {
    const { docTargets } = props.s;
    if (docTargets.length > 0) {
        (0, jostraca_1.Content)(`## Per-language documentation

`);
        docTargets.filter((tgt) => (0, facts_1.fact)(tgt, 'docs').readme).forEach((tgt) => {
            (0, jostraca_1.Content)(`- [${(0, facts_1.fact)(tgt, 'title')}](${tgt.name}/README.md)
`);
        });
        (0, jostraca_1.Content)(`
`);
    }
});
const ReadmeTopUpstream = (0, component_1.cmp)(function ReadmeTopUpstream(props) {
    const { text, definition, definitionFull } = props.s;
    const upstream = text.upstream;
    const docs = text.docs_url;
    (0, jostraca_1.Content)(`## Upstream API

This SDK is generated from the upstream ${definitionFull}. It is an
unofficial client and is not affiliated with the API provider.

The ${definition}(s) this SDK was generated from are kept in the
[\`.sdk/def/\`](.sdk/def/) folder.

`);
    if (upstream.raw) {
        // A per-tenant server URL carries an OpenAPI server variable —
        // `https://{instance}.dreamapply.com/api` — and is the right thing to
        // SHOW, because it tells the reader the host is theirs to fill in. It is
        // not a thing to LINK: the braces are not a resolvable address, so a
        // markdown link renders as clickable and dead. Show it as code instead.
        const templated = /[{}]/.test(upstream.raw);
        (0, jostraca_1.Content)(templated
            ? `- Upstream API: ${upstream.code}
`
            : `- Upstream API: [${upstream.inline}](${upstream.link})
`);
    }
    if (docs.raw && docs.raw !== upstream.raw) {
        (0, jostraca_1.Content)(`- Documentation: [${docs.inline}](${docs.link})
`);
    }
    (0, jostraca_1.Content)(`
`);
});
const ReadmeTopSecurity = (0, component_1.cmp)(function ReadmeTopSecurity(props) {
    const { model } = props.s;
    (0, jostraca_1.Content)(`## Security

Please report security issues ${(0, packageMeta_1.securityContact)(model)}. See [SECURITY.md](SECURITY.md).
Do not open public issues for suspected vulnerabilities.

`);
});
const ReadmeTopFooter = (0, component_1.cmp)(function ReadmeTopFooter(props) {
    const { productName, definition } = props.s;
    (0, jostraca_1.Content)(`---

Generated from the ${productName} ${definition} by [@voxgig/sdkgen](${SDKGEN_REPO}).
`);
});
const ReadmeTop = (0, component_1.cmp)(function ReadmeTop(props) {
    const { ctx$ } = props;
    const { model } = ctx$;
    if (model.name && !model.Name)
        (0, jostraca_1.names)(model, model.name);
    const info = (0, text_1.modelText)(model);
    const def = (model.main && model.main.def) || {};
    const text = (0, facts_1.fact)(model.main[types_1.KIT], 'text');
    const productName = (0, facts_1.fact)(model.main[types_1.KIT], 'apiName').inline;
    const kind = (0, facts_1.fact)(model.main[types_1.KIT], 'definitionKind');
    const definition = (0, text_1.definitionName)(kind);
    const definitionFull = (0, text_1.definitionName)(kind, true);
    const tagline = text.tagline.inline
        || `${productName} client, generated from the ${definition}.`;
    const aboutMd = text.about_md.text;
    const apiSummary = text.summary.inline;
    const websiteLine = text.website.raw
        ? `Learn more about ${productName} at [${text.website.label}](${text.website.link}).`
        : '';
    // Attribution for API metadata sourced from a third-party catalogue (e.g.
    // freepublicapis.com). Rendered only when the model carries an
    // `info.meta_source` URL, so first-party SDKs never show it. The link points
    // back to the catalogue that kindly supplied the metadata.
    const metaSourceLine = text.meta_source.raw
        ? `Metadata kindly supplied by [${text.meta_source.label}](${text.meta_source.link}).`
        : '';
    const entity = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.entity`);
    const target = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.target`);
    const feature = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.feature`);
    (0, jostraca_1.each)(entity, (ent) => { if (!ent.Name)
        (0, jostraca_1.names)(ent, ent.name); });
    (0, jostraca_1.each)(feature, (feat) => { if (!feat.Name)
        (0, jostraca_1.names)(feat, feat.name); });
    const activeEntities = (0, jostraca_1.each)(entity).filter((e) => e.active !== false);
    const activeTargets = (0, facts_1.fact)(model.main[types_1.KIT], 'active').map((name) => target[name]);
    const cliTargets = activeTargets.filter((t) => 'cli' === (0, surface_1.surfaceOf)(t));
    const mcpTargets = activeTargets.filter((t) => 'mcp' === (0, surface_1.surfaceOf)(t));
    const hasCli = 0 < cliTargets.length;
    const hasMcp = 0 < mcpTargets.length;
    const ordered = (0, surface_1.documentOrder)(model, activeTargets);
    const isCliOrMcp = (t) => ['cli', 'mcp'].includes((0, surface_1.surfaceOf)(t));
    const sdkTargets = ordered.filter((t) => 'sdk' === (0, surface_1.surfaceOf)(t));
    // The CLI and the MCP server have surfaces of their own below.
    const consumerTargets = ordered.filter((t) => 'sdk' !== (0, surface_1.surfaceOf)(t) && !isCliOrMcp(t));
    const docTargets = ordered.filter((t) => !isCliOrMcp(t));
    const pkgTargets = ordered.filter((t) => (0, packageMeta_1.hasPackageName)(model, t.name));
    const langList = sdkTargets.map((t) => (0, facts_1.fact)(t, 'title')).join(', ');
    const leadTarget = pickLeadTarget(sdkTargets);
    const s = {
        model,
        ctx$,
        info,
        def,
        text,
        productName,
        definition,
        definitionFull,
        tagline,
        aboutMd,
        apiSummary,
        websiteLine,
        metaSourceLine,
        feature,
        activeEntities,
        hasCli,
        hasMcp,
        cliTargets,
        mcpTargets,
        sdkTargets,
        consumerTargets,
        docTargets,
        pkgTargets,
        langList,
        leadTarget,
    };
    (0, jostraca_1.File)({ name: 'README.md' }, () => {
        ReadmeTopTitle({ s });
        ReadmeTopSurfaceLine({ s });
        ReadmeTopFeatureLine({ s });
        ReadmeTopAbout({ s });
        ReadmeTopEntityModel({ s });
        ReadmeTopTesting({ s });
        ReadmeTopPackages({ s });
        ReadmeTopQuickstart({ s });
        ReadmeTopSurfaces({ s });
        ReadmeTopMcp({ s });
        ReadmeTopEntities({ s });
        ReadmeTopOtherLanguages({ s });
        ReadmeTopDirect({ s });
        ReadmeTopHowtoGuides({ s });
        ReadmeTopAdvanced({ s });
        ReadmeTopCustomizing({ s });
        ReadmeTopPerLanguage({ s });
        ReadmeTopUpstream({ s });
        ReadmeTopSecurity({ s });
        ReadmeTopFooter({ s });
    });
});
exports.ReadmeTop = ReadmeTop;
//# sourceMappingURL=ReadmeTop.js.map