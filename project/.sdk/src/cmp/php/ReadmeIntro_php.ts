
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

  // Derive a representative entity (and its operations) from the model so the
  // semantic-entity pitch names something real rather than a placeholder.
  const entity = getModelPath(model, `main.${KIT}.entity`) || {}
  const exampleEntity = Object.values(entity).find((e: any) => e && e.active !== false) as any
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : null
  const opnames = exampleEntity
    ? ['list', 'load', 'create', 'update', 'remove']
      .filter((op) => exampleEntity.op && exampleEntity.op[op])
    : []
  const opList = opnames.length > 0 ? opnames.join('`/`') : 'list`/`load`/`create`/`update`/`remove'

  const semantic = eName
    ? `The SDK exposes the API as capitalised, semantic **Entities** — for example \`$client->${eName}()\` — with named operations (\`${opList}\`) instead of raw URL paths and query strings. Working with resources and verbs keeps call sites self-describing and reduces cognitive load.

`
    : ''

  Content(`# ${model.Name} ${target.title} SDK

${tagline}

The ${target.title} SDK for the ${model.Name} API — an entity-oriented client using PHP conventions.

${semantic}> Other languages, the CLI, and MCP server live alongside this one — see
> the [top-level README](../README.md).

`)
})


export {
  ReadmeIntro
}
