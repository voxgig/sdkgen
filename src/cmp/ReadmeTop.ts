
import { cmp, each, names, Content, File } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'

import { requirePath } from '../utility'


const VOXGIG_SDK_HOMEPAGE = 'https://voxgig.com/sdk'
const VOXGIG_SDK_CATALOG = 'https://github.com/voxgig-sdk'
const VOXGIG_DX_CONSULTING = 'https://voxgig.com/consulting/developer-experience'


// Per-language install commands rendered in the top-level "Try it"
// section. The per-language `ReadmeInstall_<lang>.ts` templates exist
// but emit extra prose ("Or install from source: ..."); for the
// landing-page README we want a single copy-paste line per language.
function installCommand(target: any, model: any): string {
  const modname = target.module?.name || model.name
  switch (target.name) {
    case 'ts':
    case 'js':
      return `npm install ${modname}`
    case 'py':
      return `pip install ${model.name}-sdk`
    case 'go':
      return `go get github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk/go`
    case 'go-cli':
      return `go install github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk/go-cli/cmd/${model.name}@latest`
    case 'php':
      return `composer require voxgig/${model.name}-sdk`
    case 'lua':
      return `luarocks install ${model.name}-sdk`
    case 'rb':
      return `gem install ${model.name}-sdk`
    default:
      return ''
  }
}


// Pick the language we lead the README with. TypeScript first if
// present (matches the cold-outbound positioning), otherwise the first
// active target. Returns undefined if there are no targets.
function pickLeadTarget(activeTargets: any[]): any | undefined {
  return activeTargets.find((t: any) => t.name === 'ts')
    || activeTargets.find((t: any) => t.name === 'js')
    || activeTargets[0]
}


const ReadmeTop = cmp(function ReadmeTop(props: any) {
  const { ctx$ } = props
  const { model } = ctx$

  const info = (model.main && model.main.kit && model.main.kit.info) || {}
  const def = (model.main && model.main.def) || {}

  // Plain-text title — prefer the OpenAPI `info.title` when it's
  // recognisably the product name (e.g. "Aare.guru API"), fall back
  // to the normalised SDK Name.
  const productName = info.title || `${model.Name} API`

  const tagline = info.tagline
    || def.tagline
    || `Idiomatic ${productName} client, generated from the OpenAPI spec.`

  const aboutMd = info.about_md || ''
  const licenseMd = info.license_md || ''
  const licenseShort = info.license_short || ''
  const homepage = info.homepage || (info.contact && info.contact.url) || ''
  const docsUrl = info.docs_url || ''
  const requiredParamsMd = info.required_params_md || ''
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

  const sdkTargets = activeTargets.filter((t: any) =>
    t.name !== 'go-cli' && t.name !== 'go-mcp'
  )

  const langList = sdkTargets.map((t: any) => t.title).join(', ')
  const leadTarget = pickLeadTarget(sdkTargets)

  File({ name: 'README.md' }, () => {

    // 1. H1 + one-line value prop
    Content(`# ${model.Name} SDK

${tagline}

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
      Content(`> ${surfaceList} — all generated from one OpenAPI spec by [Voxgig](${VOXGIG_SDK_HOMEPAGE}).

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

    // 3. Try it — copy-paste install per language
    if (sdkTargets.length > 0) {
      Content(`## Try it

`)
      sdkTargets.forEach((tgt: any) => {
        const cmd = installCommand(tgt, model)
        if (!cmd) return
        Content(`**${tgt.title}**
\`\`\`bash
${cmd}
\`\`\`

`)
      })
    }

    // 4. 30-second quickstart in the lead language
    if (leadTarget) {
      Content(`## 30-second quickstart

`)
      if (requiredParamsMd) {
        Content(`${requiredParamsMd.trim()}

`)
      }
      Content(`### ${leadTarget.title}

`)
      const LeadQuick =
        requirePath(ctx$, `./cmp/${leadTarget.name}/ReadmeTopQuick_${leadTarget.name}`, { ignore: true })
      if (LeadQuick) {
        LeadQuick['ReadmeTopQuick']({ target: leadTarget })
      }
      Content(`
See the [${leadTarget.title} README](${leadTarget.name}/README.md) for the
full guide, or scroll down for the same example in other languages.

`)
    }

    // 5. What's in the box — surface table
    if (sdkTargets.length > 0 || hasCli || hasMcp) {
      Content(`## What's in the box

| Surface | Use it for | Path |
| --- | --- | --- |
`)
      if (sdkTargets.length > 0) {
        const paths = sdkTargets.map((t: any) => `\`${t.name}/\``).join(' ')
        Content(`| **SDK** (${langList}) | App integration | ${paths} |
`)
      }
      if (hasCli) {
        Content(`| **CLI** | Scripts, CI, ops, one-off API calls | \`go-cli/\` |
`)
      }
      if (hasMcp) {
        Content(`| **MCP server** | AI agents (Claude, Cursor, Cline) | \`go-mcp/\` |
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

    // 13. API attribution / license (upstream API, not the SDK)
    if (licenseMd || licenseShort || homepage || docsUrl) {
      Content(`## Using the ${productName}

`)
      if (homepage) {
        Content(`- Upstream: [${homepage}](${homepage})
`)
      }
      if (docsUrl && docsUrl !== homepage) {
        Content(`- API docs: [${docsUrl}](${docsUrl})
`)
      }
      if (info.contact && info.contact.email) {
        Content(`- Contact: [${info.contact.email}](mailto:${info.contact.email})
`)
      }
      Content(`
`)
      if (licenseMd) {
        Content(`${licenseMd.trim()}

`)
      } else if (licenseShort) {
        Content(`${licenseShort}

`)
      }
    }

    // 14. Provenance / CTA footer
    Content(`---

Generated by the [Voxgig SDK Generator](${VOXGIG_SDK_HOMEPAGE}) from the
${productName} OpenAPI spec. MIT-licensed — fork it, ship it, own it.

Browse 500+ more generated SDKs at [${VOXGIG_SDK_CATALOG}](${VOXGIG_SDK_CATALOG}).

Want this production-grade for your team? [Voxgig DX consulting](${VOXGIG_DX_CONSULTING}).
`)
  })
})


export {
  ReadmeTop
}
