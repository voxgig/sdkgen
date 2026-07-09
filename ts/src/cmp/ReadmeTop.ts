
import { cmp, each, names, Content, File } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'

import { requirePath } from '../utility'

import { entityPrimaryOp, entityIdField, opRequestShape } from '../helpers/opShape'
import { canonKey } from '../helpers/canonType'
import { safeVarName } from '../helpers/naming'

import {
  installCommand as pkgInstall,
  packageName,
  registryState,
  vendorCommand,
  apiName,
  nonAffiliation,
  repoInfo,
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

  // Spec-derived (apidef): a short "what this API is" blurb and a link back
  // to the API's own website. Both surface right under the title, before
  // the unofficial-SDK disclosure, so a reader immediately sees what the
  // underlying API is and where it comes from.
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
    ? `Meta data kindly supplied by ` +
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
  const hasJsLike = activeTargets.some((t: any) => t.name === 'ts' || t.name === 'js')

  // Canonical docs order from main.kit.config.docs_order (with a
  // schema-supplied default of ['ts','py','php','go','rb','lua']).
  // Targets present but not listed get appended in spec-defined order,
  // so adding a new target never silently disappears from the docs.
  const docsOrder: string[] = (getModelPath(model, `main.${KIT}.config.docs_order`,
    { only_active: false, required: false }) as any) || []

  const orderOf = (name: string): number => {
    const i = docsOrder.indexOf(name)
    if (i !== -1) return i
    // Unlisted targets go after the languages; keep the CLI then MCP last.
    if (name === 'go-cli') return docsOrder.length + 1
    if (name === 'go-mcp') return docsOrder.length + 2
    return docsOrder.length
  }

  const sdkTargets = activeTargets
    .filter((t: any) => t.name !== 'go-cli' && t.name !== 'go-mcp')
    .slice()
    .sort((a: any, b: any) => orderOf(a.name) - orderOf(b.name))

  // Every installable port for the Packages table — including the go-cli and
  // go-mcp binaries, which publish as Go modules via git tags.
  const pkgTargets = activeTargets
    .slice()
    .sort((a: any, b: any) => orderOf(a.name) - orderOf(b.name))

  const langList = sdkTargets.map((t: any) => t.title).join(', ')
  const leadTarget = pickLeadTarget(sdkTargets)

  File({ name: 'README.md' }, () => {

    // 1. H1 + one-line value prop, then the API's own purpose + website
    // (spec-derived), then the unofficial / non-affiliation disclosure.
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
    if (metaSourceLine) {
      Content(`${metaSourceLine}

`)
    }

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

    // 2b. Entities-first framing: the API surface is a small set of semantic,
    // Capitalised entities — NOT raw URL paths/queries — which is the core
    // mental model the SDK is built around (model-driven; lists real entities).
    if (activeEntities.length > 0) {
      const entNames = activeEntities.map((e: any) => e.Name)
      const entList = entNames.length > 1
        ? entNames.slice(0, -1).join(', ') + ' and ' + entNames[entNames.length - 1]
        : entNames[0]
      const exEnt = activeEntities[0]
      const ex = exEnt.Name
      const exLower = safeVarName(ex.toLowerCase(), 'ts')
      // The example call uses the entity's PRIMARY op — an op it actually
      // exposes (prefer list -> the array, then load -> the record, else a
      // create with its required fields). A create-only entity therefore never
      // shows a phantom .list()/.load() that would not compile. If it exposes
      // only remove (or nothing), the op line is omitted entirely.
      const primaryOp = entityPrimaryOp(exEnt)
      let exCall = ''
      if ('list' === primaryOp) {
        exCall = `const items = await client.${ex}().list()`
      } else if ('load' === primaryOp) {
        exCall = `const ${exLower} = await client.${ex}().load()`
      } else if ('create' === primaryOp || 'update' === primaryOp) {
        const exIdF = entityIdField(exEnt)
        const shapeItems = opRequestShape(exEnt, primaryOp).items
          .filter((it: any) => it.name !== exIdF && it.name !== 'id')
        const required = shapeItems.filter((it: any) => !it.optional)
        // ALL required fields must appear or the literal is not assignable to
        // the typed CreateData/UpdateData; cap only the optional fallback.
        const chosen = required.length ? required : shapeItems.slice(0, 3)
        const bodyLines = chosen.map((it: any) => `  ${it.name}: ${tsExampleLiteral(it.type)},`)
        const body = bodyLines.length ? `\n${bodyLines.join('\n')}\n` : ''
        exCall = `const ${exLower} = await client.${ex}().${primaryOp}({${body}})`
      }
      // Model-driven op list — only the operations the entities actually expose
      // (advice may be list+load only; never claim create/update/remove exist).
      const CANON_OPS = ['list', 'load', 'create', 'update', 'remove']
      const opSet = new Set<string>()
      activeEntities.forEach((e: any) => Object.keys(e.op || {})
        .forEach((o: string) => { if ((e.op as any)[o] && (e.op as any)[o].active !== false) opSet.add(o) }))
      const opNames = CANON_OPS.filter((o) => opSet.has(o)).concat([...opSet].filter((o) => !CANON_OPS.includes(o)))
      const opList = (opNames.length ? opNames : ['list', 'load']).map((o) => '`' + o + '`').join(', ')
      Content(`## Entities, not endpoints

This SDK exposes the API as a small set of **semantic entities** — ${entList} — that you
call directly, instead of assembling URL paths and query strings. Entities are
**Capitalised** to mark them as the primary surface, each with the operations they
support (${opList}):

\`\`\`ts
const client = new ${model.Name}SDK()${exCall ? '\n' + exCall : ''}
\`\`\`

Thinking in entities keeps the mental model small — for people and AI agents alike —
rather than reasoning about raw HTTP routes and query parameters.

`)
    }

    // 2c. Offline unit testing — a headline feature: every SDK ships a mock
    // transport, so it belongs high up, right after the entity model.
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
      const { releasesUrl } = repoInfo(model)
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
          // Tag-only port (go): the vendor command IS the real install.
          cell = '`' + vendorCommand(model, tgt.name) + '`'
        } else {
          // pending / inactive: point at the git tag, never a 404 command.
          cell = `publish pending — [install from git tag](${releasesUrl})`
        }
        Content(`| ${tgt.title} | \`${packageName(model, tgt.name)}\` | ${cell} |
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
        const ops = ent.op || {}
        const opNames = Object.keys(ops).filter((o: string) => (ops as any)[o]?.active !== false)
        // Never emit a blank description cell: fall back to an ops-derived line.
        const entdesc = entityDesc[ent.name] || ent.short || ent.desc ||
          `The ${ent.Name} entity${opNames.length ? ' (' + opNames.join(', ') + ')' : ''}.`
        const points = each(ops).map((op: any) =>
          op.points ? each(op.points) : []
        ).flat()
        const path = points.length > 0
          ? (points[0] as any).orig || ''
          : ''
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

    // 10. Direct and prepare — a common everyday task (the low-level
    // escape hatch for endpoints the entity model doesn't cover).
    Content(`## Direct and prepare

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

    // 11b. Advanced — the pipeline model and feature hooks are internal
    // machinery: useful when extending the SDK, but not part of everyday
    // use, so they live below the task-focused sections above.
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
