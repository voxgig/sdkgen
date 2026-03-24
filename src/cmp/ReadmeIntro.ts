
import { cmp, Content } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'


const ReadmeIntro = cmp(function ReadmeIntro(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const desc = model.main.def.desc || ''
  const entity = getModelPath(model, `main.${KIT}.entity`)

  const entityNames = Object.values(entity)
    .filter((e: any) => e.publish)
    .map((e: any) => `\`${e.Name}\``)

  Content(`
## Introduction

${desc}
`)

  if (entityNames.length > 0) {
    Content(`
This SDK provides an entity-oriented interface for the ${model.Name} API.
The following entities are available: ${entityNames.join(', ')}.

`)
  }

  Content(`
### Features

- Entity-based API: work with business objects directly.
- Type safe: full TypeScript definitions included.
- Direct HTTP access: call any API endpoint using \`client.direct()\`.
- Testable: built-in test mode with mock support.

`)

})




export {
  ReadmeIntro
}
