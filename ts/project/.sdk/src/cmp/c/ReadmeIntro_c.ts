
import { cmp, Content, introOps } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { cIdent, cVarName } from './utility_c'


const ReadmeIntroBody = cmp(function ReadmeIntroBody(props: any) {
  const { target, ctx$: { model } } = props

  Content(`The ${target.title} SDK for the ${model.Name} API — an entity-oriented client following idiomatic C conventions (explicit structs, function-pointer vtables, and a trailing \`PNError**\` out-param for errors).

`)

  // Emphasise the entity-oriented design: the SDK surfaces the API as
  // capitalised, semantic Entities with a small, uniform verb set rather
  // than raw URL paths and query strings. The example entity name is
  // derived from the model, never hardcoded.
  const ident = cIdent(model)
  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity || {})
    .find((e: any) => e.active !== false) as any
  const example = exampleEntity
    ? `for example \`${ident}_${cVarName(exampleEntity.name)}(client, NULL)\` — each`
    : 'each'

  const opList = introOps(model)
    .map((o) => '`' + o + '`').join(', ')

  Content(`The SDK exposes the API as capitalised, semantic **Entities** — ${example}
carrying a small, uniform set of operations (${opList}) instead of raw URL
paths and query strings. You work with named resources and verbs, which
keeps the cognitive load low.

`)
})


export {
  ReadmeIntroBody
}
