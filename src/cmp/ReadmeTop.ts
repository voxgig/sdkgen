
import { cmp, each, names, Content, File } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'

import { requirePath } from '../utility'


const ReadmeTop = cmp(function ReadmeTop(props: any) {
  const { ctx$ } = props
  const { model } = ctx$

  const desc = model.main.def.desc || ''
  const entity = getModelPath(model, `main.${KIT}.entity`)
  const target = getModelPath(model, `main.${KIT}.target`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  // Ensure names are computed on entities and features
  each(entity, (ent: any) => { if (!ent.Name) names(ent, ent.name) })
  each(feature, (feat: any) => { if (!feat.Name) names(feat, feat.name) })

  const activeEntities = each(entity).filter((e: any) => e.active !== false)
  const activeTargets = each(target)

  File({ name: 'README.md' }, () => {

    Content(`# ${model.Name} SDK

${desc}

`)

    // Target links
    if (activeTargets.length > 0) {
      Content(`Available for `)
      const links = activeTargets.map((t: any) =>
        `[${t.title}](${t.name}/)`
      )
      Content(`${links.join(' and ')}.

`)
    }


    // Entities section
    if (activeEntities.length > 0) {
      Content(`
## Entities

The API exposes ${activeEntities.length === 1 ? 'one entity' : activeEntities.length + ' entities'}:

| Entity | Description | API path |
| --- | --- | --- |
`)

      activeEntities.map((ent: any) => {
        const entdesc = ent.short || ''
        const ops = ent.op || {}
        const points = Object.values(ops).map((op: any) =>
          op.points ? Object.values(op.points) : []
        ).flat()
        const path = points.length > 0
          ? (points[0] as any).path || ''
          : ''
        Content(`| **${ent.Name}** | ${entdesc} | \`${path}\` |
`)
      })

      Content(`
Each entity supports the following operations where available: **load**, **list**, **create**,
**update**, and **remove**.

`)
    }


    // Architecture section
    Content(`
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
`)

    each(feature, (feat: any) => {
      if (!feat.active) return
      const purpose = feat.title || feat.Name || feat.name
      Content(`| **${feat.Name || feat.name}Feature** | ${purpose} |
`)
    })

    Content(`
You can add custom features by passing them in the \`extend\` option at
construction time.

### Direct and Prepare

For endpoints not covered by the entity model, use the low-level methods:

- **\`direct(fetchargs)\`** — build and send an HTTP request in one step.
- **\`prepare(fetchargs)\`** — build the request without sending it.

Both accept a map with \`path\`, \`method\`, \`params\`, \`query\`, \`headers\`,
and \`body\`.

`)


    // Quick start section with examples from each target
    Content(`
## Quick start

`)

    activeTargets.map((tgt: any) => {
      const ReadmeTopQuick_sdk =
        requirePath(ctx$, `./cmp/${tgt.name}/ReadmeTopQuick_${tgt.name}`, { ignore: true })

      if (ReadmeTopQuick_sdk) {
        Content(`### ${tgt.title}

`)
        ReadmeTopQuick_sdk['ReadmeTopQuick']({ target: tgt })
        Content(`
`)
      }
    })


    // Testing section
    Content(`
## Testing

Both SDKs provide a test mode that replaces the HTTP transport with an
in-memory mock, so tests run without a network connection.

`)

    activeTargets.map((tgt: any) => {
      const ReadmeTopTest_sdk =
        requirePath(ctx$, `./cmp/${tgt.name}/ReadmeTopTest_${tgt.name}`, { ignore: true })

      if (ReadmeTopTest_sdk) {
        Content(`### ${tgt.title}

`)
        ReadmeTopTest_sdk['ReadmeTopTest']({ target: tgt })
        Content(`
`)
      }
    })


    // How-to guides
    Content(`
## How-to guides

### Make a direct API call

When the entity interface does not cover an endpoint, use \`direct\`:

`)

    activeTargets.map((tgt: any) => {
      const ReadmeTopHowto_sdk =
        requirePath(ctx$, `./cmp/${tgt.name}/ReadmeTopHowto_${tgt.name}`, { ignore: true })

      if (ReadmeTopHowto_sdk) {
        ReadmeTopHowto_sdk['ReadmeTopHowto']({ target: tgt })
      }
    })


    // Language-specific links
    Content(`
## Language-specific documentation

`)

    activeTargets.map((tgt: any) => {
      Content(`- [${tgt.title} SDK](${tgt.name}/README.md)
`)
    })

    Content(`
`)
  })
})


export {
  ReadmeTop
}
