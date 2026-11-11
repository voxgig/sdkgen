
import { cmp, Content, phpEntityAccessor, introOps } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeIntroBody = cmp(function ReadmeIntroBody(props: any) {
  const { target, ctx$: { model } } = props

  // Derive a representative entity (and its operations) from the model so the
  // semantic-entity pitch names something real rather than a placeholder.
  const entity = getModelPath(model, `main.${KIT}.entity`) || {}
  const exampleEntity = Object.values(entity).find((e: any) => e && e.active !== false) as any
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : null
  const opList = introOps(model).join('`/`')

  const semantic = eName
    ? `The SDK exposes the API as capitalised, semantic **Entities** — for example \`$client->${phpEntityAccessor(eName)}()\` — with named operations (\`${opList}\`) instead of raw URL paths and query strings. Working with resources and verbs keeps call sites self-describing and reduces cognitive load.

`
    : ''

  Content(`The ${target.title} SDK for the ${model.Name} API — an entity-oriented client using PHP conventions.

${semantic}`)
})


export {
  ReadmeIntroBody
}
