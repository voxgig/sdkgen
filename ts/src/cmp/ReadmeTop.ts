
import { cmp, each, names, Content, File } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'

import { requirePath } from '../utility'

import {
  installCommand as pkgInstall,
  packageName,
  apiName,
  nonAffiliation,
  SECURITY_EMAIL,
} from '../helpers/packageMeta'


const SDKGEN_REPO = 'https://github.com/voxgig/sdkgen'


// Per-language install commands rendered in the top-level "Try it"
// section. The per-language `ReadmeInstall_<lang>.ts` templates exist
// but emit extra prose ("Or install from source: ..."); for the
// landing-page README we want a single copy-paste line per language.
function installCommand(target: any, model: any): string {
  // Delegate to the single source of truth so the README install command can
  // never drift from the real published package name (see helpers/packageMeta).
  return pkgInstall(model, target.name)
}


// Pick the language we lead the README with — first entry from the
// docs-ordered SDK targets. Returns undefined if there are no targets.
function pickLeadTarget(sdkTargets: any[]): any | undefined {
  return sdkTargets[0]
}


const ReadmeTop = cmp(function ReadmeTop(props: any) {
  const { ctx$ } = props
  const { model } = ctx$

  // Ensure the Name/NAME case variants exist (apidef usually sets these,
  // but guard so the header never renders "undefined SDK"). Entity/feature
  // names are guarded the same way below.
  if (model.name && !model.Name) names(model, model.name)

  const info = (model.main && model.main[KIT] && model.main[KIT].info) || {}
  const def = (model.main && model.main.def) || {}

  // Plain-text title — prefer the OpenAPI `info.title` when it's
  // recognisably the product name (e.g. "Aare.guru API"), fall back
  // to the normalised SDK Name.
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

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const target = getModelPath(model, `main.${KIT}.target`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  each(entity, (ent: any) => { if (!ent.Name) names(ent, ent.name) })
  each(feature, (feat: any) => { if (!feat.Name) names(feat, feat.name) })

  const activeEntities = each(entity).filter((e: any) => e.active !== false)
  const activeTargets = each(target).filter((t: any) => t.active !== false)

  const hasCli = activeTargets.some((t: any) => t.name === 'go-cli')
  const hasMcp = activeTargets.some((t: any) => t.name === 'go-mcp')
  const hasJsLike = activeTargets.some((t: any) => t.name === 'ts' || t.name === 'js')

  // Canonical docs order from main.kit.config.docs_order (with a
  // schema-supplied default of ['ts','py','php','go','rb','lua']).
  // Targets present but not listed get appended in spec-defined order,
  // so adding a new target never silently disappears from the docs.
  const docsOrder: string[] = (getModelPath(model, `main.${KIT}.config.docs_order`,
    { only_active: false, required: false }) as any) || []

  const sdkTargets = activeTargets
    .filter((t: any) => t.name !== 'go-cli' && t.name !== 'go-mcp')
    .slice()
    .sort((a: any, b: any) => {
      const ai = docsOrder.indexOf(a.name)
      const bi = docsOrder.indexOf(b.name)
      const av = ai === -1 ? docsOrder.length : ai
      const bv = bi === -1 ? docsOrder.length : bi
      return av - bv
    })

  const langList = sdkTargets.map((t: any) => t.title).join(', ')
  const leadTarget = pickLeadTarget(sdkTargets)

  File({ name: 'README.md' }, () => {

    // 1. H1 + one-line value prop + unofficial / non-affiliation disclosure
    Content(`# ${model.Name} SDK

${tagline}

${nonAffiliation(model)}

`)

    // Positioning line, only when we actually have multiple SDK targets.
    if (sdkTargets.length > 1) {
      const surfaces = []
      surfaces.push(`${langList} SDKs`)
      if (hasCli) surfaces.push('a CLI')
      if (hasJsLike) surfaces.push('an interactive REPL')
      if (hasMcp) surfaces.push('an MCP server for AI agents')
      const surfaceList = surfaces.length > 1
        ? surfaces.slice(0, -1).join(', ') + ', and ' + surfaces[surfaces.length - 1]
        : surfaces[0]
      Content(`> ${surfaceList} — all generated from one OpenAPI spec by [@voxgig/sdkgen](${SDKGEN_REPO}).

`)
    }

    // 2. About / what the API is
    if (aboutMd) {
      Content(`## About ${productName}

${aboutMd.trim()}

`)
    } else if (def.desc) {
      Content(`${def.desc}

`)
    }

    // 3. Packages — real published package name + install command per ecosystem
    if (sdkTargets.length > 0) {
      Content(`## Packages

| Language | Package | Install |
| --- | --- | --- |
`)
      sdkTargets.forEach((tgt: any) => {
        const cmd = installCommand(tgt, model)
        if (!cmd) return
        Content(`| ${tgt.title} | \`${packageName(model, tgt.name)}\` | \`${cmd}\` |
`)
      })
      Content(`
`)
    }

    // 4. Quickstart in the lead language
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

    // 5. Surface table
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

    // 6. MCP / agent usage — only if MCP target is enabled
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

    // 7. Entities table
    if (activeEntities.length > 0) {
      Content(`## Entities

The API exposes ${activeEntities.length === 1 ? 'one entity' : activeEntities.length + ' entities'}:

| Entity | Description | API path |
| --- | --- | --- |
`)

      activeEntities.map((ent: any) => {
        const entdesc = entityDesc[ent.name] || ent.short || ent.desc || ''
        const ops = ent.op || {}
        const points = each(ops).map((op: any) =>
          op.points ? each(op.points) : []
        ).flat()
        const path = points.length > 0
          ? (points[0] as any).orig || ''
          : ''
        Content(`| **${ent.Name}** | ${entdesc} | \`${path}\` |
`)
      })

      Content(`
Each entity supports the following operations where available: **load**,
**list**, **create**, **update**, and **remove**.

`)
    }

    // 8. Quickstart in the other languages (lead is already covered above)
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

    // 9. Testing — keep, but slim
    if (sdkTargets.length > 0) {
      Content(`## Unit testing in offline mode

Every SDK ships a test mode that swaps the HTTP transport for an
in-memory mock, so unit tests run offline.

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

    // 10. How it works (was: Architecture)
    Content(`## How it works

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

### Direct and Prepare

For endpoints the entity model doesn't cover, use the low-level methods:

- **\`direct(fetchargs)\`** — build and send an HTTP request in one step.
- **\`prepare(fetchargs)\`** — build the request without sending it.

Both accept a map with \`path\`, \`method\`, \`params\`, \`query\`,
\`headers\`, and \`body\`. See the [How-to guides](#how-to-guides) below.

`)

    // 11. How-to guides — keep, useful for the engineer reader
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

    // 12. Per-language docs links
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

    // 13. Upstream API — contact/servers from the OpenAPI info block
    const upstreamUrl = (info.contact && info.contact.url)
      || (info.servers && info.servers[0] && info.servers[0].url)
      || homepage
    if (upstreamUrl || docsUrl) {
      Content(`## Upstream API

This SDK is generated from the upstream OpenAPI specification. It is an
unofficial client and is not affiliated with the API provider.

`)
      if (upstreamUrl) {
        Content(`- Upstream API: [${upstreamUrl}](${upstreamUrl})
`)
      }
      if (docsUrl && docsUrl !== upstreamUrl) {
        Content(`- Documentation: [${docsUrl}](${docsUrl})
`)
      }
      Content(`
`)
    }

    // 13b. Security
    Content(`## Security

Please report security issues to ${SECURITY_EMAIL}. See [SECURITY.md](SECURITY.md).
Do not open public issues for suspected vulnerabilities.

`)

    // 14. Provenance footer
    Content(`---

Generated from the ${productName} OpenAPI spec by [@voxgig/sdkgen](${SDKGEN_REPO}).
`)
  })
})


export {
  ReadmeTop
}
