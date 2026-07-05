
import { cmp, Content } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeIntro = cmp(function ReadmeIntro(props: any) {
  const { target, ctx$: { model } } = props
  const info = (model.main && model.main.kit && model.main.kit.info) || {}
  const tagline = info.tagline || ''

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'

  Content(`# ${model.Name} ${target.title} SDK

${tagline}

The ${target.title} SDK for the ${model.Name} API — a type-safe, entity-oriented client with full async/await support.

The API is exposed as capitalised, semantic **Entities** — e.g.
\`client.${eName}()\` — each with a small set of operations (\`list\`,
\`load\`, \`create\`, \`update\`, \`remove\`) instead of raw URL paths and
query parameters. This keeps the surface predictable and low-friction for
both humans and AI agents.

> Other languages, the CLI, and MCP server live alongside this one — see
> the [top-level README](../README.md).

`)
})


export {
  ReadmeIntro
}
