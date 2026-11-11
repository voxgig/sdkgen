
import { cmp, Content, introOps } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeIntroBody = cmp(function ReadmeIntroBody(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'

  const opList = introOps(model)
    .map((o) => '`' + o + '`').join(', ')

  Content(`The ${target.title} SDK for the ${model.Name} API — a type-safe, entity-oriented client with full async/await support.

The API is exposed as capitalised, semantic **Entities** — e.g.
\`client.${eName}()\` — each with a small set of operations (${opList})
instead of raw URL paths and query parameters. This keeps the surface
predictable and low-friction for both humans and AI agents.

`)
})


export {
  ReadmeIntroBody
}
