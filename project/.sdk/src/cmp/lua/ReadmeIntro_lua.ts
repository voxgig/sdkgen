
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

  // Derive a real entity accessor from the model for the semantic-entity
  // note (fall back to a generic name if the model has no entities).
  const entity = getModelPath(model, `main.${KIT}.entity`) || {}
  const exampleEntity = Object.values(entity).find((e: any) => e && e.active !== false) as any
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'

  Content(`# ${model.Name} ${target.title} SDK

${tagline}

The ${target.title} SDK for the ${model.Name} API — an entity-oriented client using Lua conventions.

It exposes the API as capitalised, semantic **Entities** — e.g. \`client:${eName}()\` — each with the same small set of operations (\`list\`, \`load\`, \`create\`, \`update\`, \`remove\`) instead of raw URL paths and query strings. You call meaning, not endpoints, which keeps the cognitive load low.

> Other languages, the CLI, and MCP server live alongside this one — see
> the [top-level README](../README.md).

`)
})


export {
  ReadmeIntro
}
