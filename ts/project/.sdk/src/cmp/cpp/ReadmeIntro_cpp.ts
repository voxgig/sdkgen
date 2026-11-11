
import { cmp, Content, introOps } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { cppVarName } from './utility_cpp'


const ReadmeIntroBody = cmp(function ReadmeIntroBody(props: any) {
  const { target, ctx$: { model } } = props

  Content(`The ${target.title} SDK for the ${model.Name} API — a header-only,
entity-oriented client following idiomatic modern C++ (C++17) conventions.

`)

  // Emphasise the entity-oriented design: the SDK surfaces the API as
  // capitalised, semantic Entities with a small, uniform verb set rather
  // than raw URL paths and query strings. The example entity accessor is
  // derived from the model, never hardcoded.
  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity || {})
    .find((e: any) => e.active !== false) as any
  const example = exampleEntity
    ? `for example \`client->${cppVarName(exampleEntity.name)}()\` — each`
    : 'each'

  const opList = introOps(model)
    .map((o) => '`' + o + '`').join(', ')

  Content(`The SDK exposes the API as capitalised, semantic **Entities** — ${example}
carrying a small, uniform set of operations (${opList}) instead of raw URL
paths and query strings. You work with named resources and verbs, which
keeps the cognitive load low. Every value flows through a single dynamic
\`sdk::Value\` type (a JSON-like variant), so there is no schema-driven code to
regenerate when the API changes.

`)
})


export {
  ReadmeIntroBody
}
