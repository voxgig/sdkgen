
import { cmp, each, names, Content, File } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'

import { requirePath } from '../utility'
import { featureDocs } from './FeatureDocs'

import {
  entityPrimaryOp, entityIdField, opRequestShape, entityPath, entityActions,
} from '../helpers/opShape'
import { matchArg, idLiteral } from '../helpers/opExample'
import { canonKey } from '../helpers/canonType'
import { safeVarName, exampleVarName } from '../helpers/naming'

import {
  installCommand as pkgInstall,
  packageName,
  registryState,
  vendorCommand,
  apiName,
  nonAffiliation,
  repoInfo,
  docsSiteUrl,
  SECURITY_EMAIL,
} from '../helpers/packageMeta'


const SDKGEN_REPO = 'https://github.com/voxgig/sdkgen'
const VOXGIG_SDK = 'https://voxgig.com/sdk/'


// A type-correct TS example literal for a model field, keyed off its canonical
// type sentinel — mirrors the per-language `exampleValue`, but inline because
// this neutral component renders the intro `ts` block directly.
function tsExampleLiteral(type: any): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k) return '[]'
  if ('OBJECT' === k) return '{}'
  return `'example'`
}


function installCommand(target: any, model: any): string {
  return pkgInstall(model, target.name)
}


function pickLeadTarget(sdkTargets: any[]): any | undefined {
  return sdkTargets[0]
}


const ReadmeTop = cmp(function ReadmeTop(props: any) {
  const { ctx$ } = props
  const { model } = ctx$

  if (model.name && !model.Name) names(model, model.name)

  const info = (model.main && model.main[KIT] && model.main[KIT].info) || {}
  const def = (model.main && model.main.def) || {}

  const productName = info.title || `${model.Name} API`

  const tagline = info.tagline
    || def.tagline
    || `${productName} client, generated from the OpenAPI spec.`

  const aboutMd = info.about_md || ''
  const licenseMd = info.license_md || ''
  const licenseShort = info.license_short || ''
  const homepage = info.homepage || ''
  const docsUrl = info.docs_url || ''
  const entityDesc = info.entity_desc || {}

  const apiSummary = (info.summary || '').trim()
  const apiWebsite = (info.website || '').trim()
  const websiteLine = apiWebsite
    ? `Learn more about ${productName} at ` +
    `[${apiWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}](${apiWebsite}).`
    : ''

  // Attribution for API metadata sourced from a third-party catalogue (e.g.
  // freepublicapis.com). Rendered only when the model carries an
  // `info.meta_source` URL, so first-party SDKs never show it. The link points
  // back to the catalogue that kindly supplied the metadata.
  const metaSource = (info.meta_source || '').trim()
  const metaSourceLine = metaSource
    ? `Metadata kindly supplied by ` +
    `[${metaSource.replace(/^https?:\/\//, '').replace(/\/$/, '')}](${metaSource}).`
    : ''

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const target = getModelPath(model, `main.${KIT}.target`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  each(entity, (ent: any) => { if (!ent.Name) names(ent, ent.name) })
  each(feature, (feat: any) => { if (!feat.Name) names(feat, feat.name) })

  const activeEntities = each(entity).filter((e: any) => e.active !== false)
  const activeTargets = each(target).filter((t: any) => t.active !== false)

  const hasCli = activeTargets.some((t: any) => t.name === 'go-cli')
  const hasMcp = activeTargets.some((t: any) => t.name === 'go-mcp')


  const docsOrder: string[] = (getModelPath(model, `main.${KIT}.config.docs_order`,
    { only_active: false, required: false }) as any) || []

  const orderOf = (name: string): number => {
    const i = docsOrder.indexOf(name)
    if (i !== -1) return i
    if (name === 'go-cli') return docsOrder.length + 1
    if (name === 'go-mcp') return docsOrder.length + 2
    return docsOrder.length
  }

  const sdkTargets = activeTargets
    .filter((t: any) => t.name !== 'go-cli' && t.name !== 'go-mcp')
    .slice()
    .sort((a: any, b: any) => orderOf(a.name) - orderOf(b.name))

  const pkgTargets = activeTargets
    .slice()
    .sort((a: any, b: any) => orderOf(a.name) - orderOf(b.name))

  const langList = sdkTargets.map((t: any) => t.title).join(', ')
  const leadTarget = pickLeadTarget(sdkTargets)

  File({ name: 'README.md' }, () => {

    Content(`# ${model.Name} SDK

${tagline}

`)
    if (apiSummary) {
      Content(`${apiSummary}

`)
    }
    if (websiteLine) {
      Content(`${websiteLine}

`)
    }
    Content(`${nonAffiliation(model)}

Learn more about Voxgig SDKs at [voxgig.com/sdk](${VOXGIG_SDK}).

`)

    // THE GENERATED SITE, LINKED FROM THE TOP, because the repository was the
    // one place it could not be found from. `docs_url` further down is the
    // UPSTREAM API's documentation, not this, and a reader who lands on the
    // repo rather than arriving from a link had no route to the site at all.
    // Empty unless the project actually publishes one -- see docsSiteUrl.
    const siteUrl = docsSiteUrl(model)
    if (siteUrl) {
      Content(`Full documentation for this SDK: [${siteUrl}](${siteUrl})

`)
    }
    if (metaSourceLine) {
      Content(`${metaSourceLine}

`)
    }

    if (sdkTargets.length > 1) {
      const surfaces = []
      surfaces.push(`${langList} SDKs`)
      if (hasCli) surfaces.push('a CLI with an interactive REPL')
      if (hasMcp) surfaces.push('an MCP server for AI agents')
      const surfaceList = surfaces.length > 1
        ? surfaces.slice(0, -1).join(', ') + ', and ' + surfaces[surfaces.length - 1]
        : surfaces[0]
      Content(`> ${surfaceList} — all generated from one OpenAPI spec by [@voxgig/sdkgen](${SDKGEN_REPO}).

`)
    }

    // FEATURES BELONG BESIDE THE TARGETS. What an SDK can do is as much a
    // reason to choose it as which language it is in, and a reader who has to
    // scroll past every language section to discover that retries, caching and
    // tracing are built in has already decided it is a thin HTTP wrapper.
    // Named here, in one line, with the detail left to each target's README.
    const features = featureDocs(model)
    if (0 < features.length) {
      Content(`> **Features:** ${features.map((f: any) => '`' + f.n + '`').join(', ')} — opt-in,
> inactive until switched on, and configured per client. See the Features
> section of any SDK README below for what each one does.

`)
    }

    if (aboutMd) {
      Content(`## About ${productName}

${aboutMd.trim()}

`)
    } else if (def.desc) {
      Content(`${def.desc}

`)
    }

    if (activeEntities.length > 0) {
      const entNames = activeEntities.map((e: any) => e.Name)
      const entCount = entNames.length
      const entList = entCount > 1
        ? entNames.slice(0, -1).join(', ') + ' and ' + entNames[entNames.length - 1]
        : entNames[0]
      const NAME_INLINE_MAX = 6
      const inlineNames = entCount <= NAME_INLINE_MAX
      const surface = inlineNames
        ? `a small set of **semantic entities** — ${entList} —`
        : `**${entCount} semantic entities**`
      const seeEntities = inlineNames
        ? ''
        : ' See the [Entities](#entities) table below for the full list.'
      const exEnt = activeEntities[0]
      const ex = exEnt.Name
      const exLower = exampleVarName(ex.toLowerCase(), 'ts')
      // The example call uses the entity's PRIMARY op — an op it actually
      // exposes (prefer list -> the array, then load -> the record, else a
      // create with its required fields). A create-only entity therefore never
      // shows a phantom .list()/.load() that would not compile. If it exposes
      // only remove (or nothing), the op line is omitted entirely.
      const primaryOp = entityPrimaryOp(exEnt)
      let exCall = ''
      const exIdField = entityIdField(exEnt)
      const exListArg = matchArg('ts', exEnt, 'list', exIdField,
        idLiteral(exEnt, 'list', exIdField))
      const exLoadArg = matchArg('ts', exEnt, 'load', exIdField,
        idLiteral(exEnt, 'load', exIdField))

      if ('list' === primaryOp) {
        exCall = `const items = await client.${ex}().list(${exListArg})`
      } else if ('load' === primaryOp) {
        exCall = `const ${exLower} = await client.${ex}().load(${exLoadArg})`
      } else if ('create' === primaryOp || 'update' === primaryOp) {
        const exIdF = entityIdField(exEnt)
        // Drop the id only when the request shape says it is OPTIONAL. It is
        // server-assigned on a normal create, but an op whose id comes from a
        // PATH PARAMETER requires it, and the typed CreateData then rejects a
        // body without it. Same rule as dataArg in helpers/opExample.
        const shapeItems = opRequestShape(exEnt, primaryOp).items
          .filter((it: any) =>
            (it.name !== exIdF && it.name !== 'id') || !it.optional)
        const required = shapeItems.filter((it: any) => !it.optional)
        const chosen = required.length ? required : shapeItems.slice(0, 3)
        const bodyLines = chosen.map((it: any) => `  ${it.name}: ${tsExampleLiteral(it.type)},`)
        const body = bodyLines.length ? `\n${bodyLines.join('\n')}\n` : ''
        exCall = `const ${exLower} = await client.${ex}().${primaryOp}({${body}})`
      }
      const CANON_OPS = ['list', 'load', 'create', 'update', 'remove']
      const opSet = new Set<string>()
      activeEntities.forEach((e: any) => Object.keys(e.op || {})
        .forEach((o: string) => { if ((e.op as any)[o] && (e.op as any)[o].active !== false) opSet.add(o) }))
      const opNames = CANON_OPS.filter((o) => opSet.has(o)).concat([...opSet].filter((o) => !CANON_OPS.includes(o)))
      const opList = (opNames.length ? opNames : ['list', 'load']).map((o) => '`' + o + '`').join(', ')
      Content(`## Entities, not endpoints

This SDK exposes the API as ${surface} that you
call directly, instead of assembling URL paths and query strings.${seeEntities} Entities are
**Capitalised** to mark them as the primary surface, each with the operations they
support (${opList}):

\`\`\`ts
const client = new ${model.Name}SDK()${exCall ? '\n' + exCall : ''}
\`\`\`

Thinking in entities keeps the mental model small — for people and AI agents alike —
rather than reasoning about raw HTTP routes and query parameters.

`)
    }

    if (sdkTargets.length > 0) {
      Content(`## Offline unit testing

Every SDK ships a built-in **test mode** that swaps the HTTP transport for
an in-memory mock, so your unit tests run fully offline — no server, no
network, and no credentials:

`)
      sdkTargets.forEach((tgt: any) => {
        const Test =
          requirePath(ctx$, `./cmp/${tgt.name}/ReadmeTopTest_${tgt.name}`, { ignore: true })
        if (Test) {
          Content(`### ${tgt.title}

`)
          Test['ReadmeTopTest']({ target: tgt })
          Content(`
`)
        }
      })
    }

    // 3. Packages — real published package name + install command per
    // ecosystem. A package that is NOT yet live on its registry (the fleet
    // default: 'pending') must NOT advertise a `npm install ...` that 404s —
    // its Install cell links to the git-tag releases page instead. The go
    // family resolves from the tag directly (`go get <mod>@latest`).
    if (pkgTargets.length > 0) {
      const { tagsUrl } = repoInfo(model)
      Content(`## Packages

| Language | Package | Install |
| --- | --- | --- |
`)
      pkgTargets.forEach((tgt: any) => {
        const state = registryState(model, tgt.name)
        let cell: string
        if ('active' === state) {
          const cmd = installCommand(tgt, model)
          if (!cmd) return
          cell = '`' + cmd + '`'
        } else if ('tag' === state) {
          cell = '`' + vendorCommand(model, tgt.name) + '`'
        } else {
          cell = `publish pending — [install from git tag](${tagsUrl})`
        }
        Content(`| ${tgt.title} | \`${packageName(model, tgt.name)}\` | ${cell} |
`)
      })
      Content(`
`)
    }

    if (leadTarget) {
      Content(`## Quickstart

### ${leadTarget.title}

`)
      const LeadQuick =
        requirePath(ctx$, `./cmp/${leadTarget.name}/ReadmeTopQuick_${leadTarget.name}`, { ignore: true })
      if (LeadQuick) {
        LeadQuick['ReadmeTopQuick']({ target: leadTarget })
      }
      Content(`
See the [${leadTarget.title} README](${leadTarget.name}/README.md) for the full guide.

`)
    }

    if (sdkTargets.length > 0 || hasCli || hasMcp) {
      Content(`## Surfaces

| Surface | Path |
| --- | --- |
`)
      if (sdkTargets.length > 0) {
        const paths = sdkTargets.map((t: any) => `\`${t.name}/\``).join(' ')
        Content(`| **SDK** (${langList}) | ${paths} |
`)
      }
      if (hasCli) {
        Content(`| **CLI** | \`go-cli/\` |
`)
      }
      if (hasMcp) {
        Content(`| **MCP server** | \`go-mcp/\` |
`)
      }
      Content(`
`)
    }

    if (hasMcp) {
      Content(`## Use it from an AI agent (MCP)

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

`)
    }

    if (activeEntities.length > 0) {
      Content(`## Entities

The API exposes ${activeEntities.length === 1 ? 'one entity' : activeEntities.length + ' entities'}:

| Entity | Description | API path |
| --- | --- | --- |
`)

      activeEntities.map((ent: any) => {
        const ops = ent.op || {}
        const opNames = Object.keys(ops).filter((o: string) => (ops as any)[o]?.active !== false)
        const entdesc = entityDesc[ent.name] || ent.short || ent.desc ||
          `The ${ent.Name} entity${opNames.length ? ' (' + opNames.join(', ') + ')' : ''}.`
        const path = entityPath(ent)
        Content(`| **${ent.Name}** | ${entdesc} | \`${path}\` |
`)
      })

      const opUnion = new Set<string>()
      activeEntities.forEach((e: any) => Object.keys(e.op || {})
        .forEach((o: string) => { if ((e.op as any)[o]?.active !== false) opUnion.add(o) }))
      const opAvail = ['load', 'list', 'create', 'update', 'remove'].filter((o) => opUnion.has(o))
      const opBold = (opAvail.length ? opAvail : ['load', 'list']).map((o) => '**' + o + '**').join(', ')
      Content(`
The operations available across these entities are ${opBold} — see each entity's
own list above for exactly which it supports.

`)
    }

    const otherTargets = sdkTargets.filter((t: any) => leadTarget && t.name !== leadTarget.name)
    if (otherTargets.length > 0) {
      Content(`## Quickstart in other languages

`)
      otherTargets.forEach((tgt: any) => {
        const Quick =
          requirePath(ctx$, `./cmp/${tgt.name}/ReadmeTopQuick_${tgt.name}`, { ignore: true })
        if (Quick) {
          Content(`### ${tgt.title}

`)
          Quick['ReadmeTopQuick']({ target: tgt })
          Content(`
`)
        }
      })
    }

    Content(`## Direct and prepare

For endpoints the entity model doesn't cover, use the low-level methods:

- **\`direct(fetchargs)\`** — build and send an HTTP request in one step.
- **\`prepare(fetchargs)\`** — build the request without sending it.

Both accept a map with \`path\`, \`method\`, \`params\`, \`query\`,
\`headers\`, and \`body\`. See the [How-to guides](#how-to-guides) below.

`)

    Content(`## How-to guides

### Make a direct API call

When the entity interface does not cover an endpoint, use \`direct\`:

`)

    sdkTargets.forEach((tgt: any) => {
      const Howto =
        requirePath(ctx$, `./cmp/${tgt.name}/ReadmeTopHowto_${tgt.name}`, { ignore: true })
      if (Howto) {
        Howto['ReadmeTopHowto']({ target: tgt })
      }
    })

    Content(`## Advanced

> Everyday use only needs the sections above. This explains the internals
> behind every call — relevant when writing custom features.

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

`)

    Content(`| Feature | Purpose |
| --- | --- |
`)
    each(feature, (feat: any) => {
      if (!feat.active) return
      const purpose = feat.title || feat.Name || feat.name
      Content(`| **${feat.Name || feat.name}Feature** | ${purpose} |
`)
    })

    Content(`
Pass custom features via the \`extend\` option at construction time.

`)

    // 11c. Customization — the generator's whole story for "the output is
    // not quite right": model-driven declarations, in-repo templates and
    // components, merge-aware regeneration, and packages for custom targets
    // and features. Every SDK repo carries its own generator, so this
    // belongs in every README.
    Content(`## Customizing this SDK

This repository contains its own generator (\`.sdk/\`), so the SDK is
customizable without forking any upstream tool:

- **The model** (\`.sdk/model/\`) declares everything this project owns:
  package names, versions, active features, per-target settings. It is
  written in [aontu](https://aontu.dev), a JSON-based
  specification language designed for building ontologies: easy to edit
  by hand, and files unify rather than override, so small declarations
  compose into one model. Regeneration re-reads it every time.
- **Templates** (\`.sdk/tm/\`) and **components** (\`.sdk/src/cmp/\`) are
  the two layers of generation, copied into this repo: templates are the
  literal per-language source, components generate the API-shaped parts.
- **Regeneration merges.** By default, newly generated content is
  three-way merged into existing files, so generator updates and local
  edits usually converge without manual conflict handling. A project can
  opt for plain overwrite instead.
- **Custom features and entire custom targets** arrive through sdkgen
  packages (\`voxgig-sdkgen package add\`), on the same rails as the
  bundled languages, and \`voxgig-sdkgen doctor\` reports any drift from
  what a resync would write.

How-to: [customize and propagate templates](https://github.com/voxgig/sdkgen/blob/main/docs/how-to/customize-and-propagate-templates.md).
The full story: [voxgig.com/sdk/custom](https://voxgig.com/sdk/custom).

`)

    if (sdkTargets.length > 0) {
      Content(`## Per-language documentation

`)
      sdkTargets.forEach((tgt: any) => {
        Content(`- [${tgt.title}](${tgt.name}/README.md)
`)
      })
      Content(`
`)
    }

    const upstreamUrl = (info.contact && info.contact.url)
      || (info.servers && info.servers[0] && info.servers[0].url)
      || homepage
    Content(`## Upstream API

This SDK is generated from the upstream OpenAPI specification. It is an
unofficial client and is not affiliated with the API provider.

The OpenAPI spec(s) this SDK was generated from are kept in the
[\`.sdk/def/\`](.sdk/def/) folder.

`)
    if (upstreamUrl) {
      // A per-tenant server URL carries an OpenAPI server variable —
      // `https://{instance}.dreamapply.com/api` — and is the right thing to
      // SHOW, because it tells the reader the host is theirs to fill in. It is
      // not a thing to LINK: the braces are not a resolvable address, so a
      // markdown link renders as clickable and dead. Show it as code instead.
      const templated = /[{}]/.test(upstreamUrl)
      Content(templated
        ? `- Upstream API: \`${upstreamUrl}\`
`
        : `- Upstream API: [${upstreamUrl}](${upstreamUrl})
`)
    }
    if (docsUrl && docsUrl !== upstreamUrl) {
      Content(`- Documentation: [${docsUrl}](${docsUrl})
`)
    }
    Content(`
`)

    Content(`## Security

Please report security issues to ${SECURITY_EMAIL}. See [SECURITY.md](SECURITY.md).
Do not open public issues for suspected vulnerabilities.

`)

    Content(`---

Generated from the ${productName} OpenAPI spec by [@voxgig/sdkgen](${SDKGEN_REPO}).
`)
  })
})


export {
  ReadmeTop
}
