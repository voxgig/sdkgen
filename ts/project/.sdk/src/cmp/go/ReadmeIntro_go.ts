
import { cmp, Content, introOps } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeIntroBody = cmp(function ReadmeIntroBody(props: any) {
  const { target, ctx$: { model } } = props

  // Derive a real entity accessor from the model for the semantic-entity
  // note (fall back to a generic name if the model has no entities).
  const entity = getModelPath(model, `main.${KIT}.entity`) || {}
  const exampleEntity = Object.values(entity).find((e: any) => e && e.active !== false) as any
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'

  // Go method names are capitalised.
  const cap = (o: string) => o.charAt(0).toUpperCase() + o.slice(1)
  const opList = introOps(model)
    .map((o) => '`' + cap(o) + '`').join(', ')

  Content(`The ${target.title} SDK for the ${model.Name} API — an entity-oriented client using standard Go conventions. No generics required; data flows as \`map[string]any\`.

It exposes the API as capitalised, semantic **Entities** — e.g. \`client.${eName}(nil)\` — each with the same small set of operations (${opList}) instead of raw URL paths and query strings. You call meaning, not endpoints, which keeps the cognitive load low.

`)
})


export {
  ReadmeIntroBody
}
