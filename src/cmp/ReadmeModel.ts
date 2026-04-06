
import { cmp, each, Content } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'

import { requirePath } from '../utility'


const ReadmeModel = cmp(function ReadmeModel(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  Content(`
## Reference

`)

  // Delegate to target-specific reference summary
  const ReadmeModel_sdk =
    requirePath(ctx$, `./cmp/${target.name}/ReadmeModel_${target.name}`, { ignore: true })

  if (ReadmeModel_sdk) {
    ReadmeModel_sdk['ReadmeModel']({ target })
  }
  else {
    // Fallback: generic reference summary
    ReadmeModelGeneric({ target, model, entityList })
  }
})


const ReadmeModelGeneric = cmp(function ReadmeModelGeneric(props: any) {
  const { target, model, entityList } = props

  Content(`### ${model.Name}SDK

#### Constructor

| Option | Type | Description |
| --- | --- | --- |
| \`apikey\` | \`string\` | API key for authentication. |
| \`base\` | \`string\` | Base URL of the API server. |
| \`prefix\` | \`string\` | URL path prefix prepended to all requests. |
| \`suffix\` | \`string\` | URL path suffix appended to all requests. |
| \`feature\` | \`object\` | Feature activation flags. |
| \`extend\` | \`array\` | Additional Feature instances to load. |

#### Methods

| Method | Returns | Description |
| --- | --- | --- |
`)

  each(entityList, (ent: any) => {
    Content(`| \`${ent.Name}(data?)\` | \`${ent.Name}Entity\` | Create a ${ent.Name} entity instance. |
`)
  })

  Content(`| \`options()\` | \`object\` | Deep copy of current SDK options. |
| \`utility()\` | \`Utility\` | Copy of the SDK utility object. |
| \`prepare(fetchargs?)\` | \`FetchDef\` | Build an HTTP request definition without sending it. |
| \`direct(fetchargs?)\` | \`DirectResult\` | Build and send an HTTP request. |
| \`tester(testopts?, sdkopts?)\` | \`${model.Name}SDK\` | Create a test-mode client instance. |

#### Static methods

| Method | Returns | Description |
| --- | --- | --- |
| \`${model.Name}SDK.test(testopts?, sdkopts?)\` | \`${model.Name}SDK\` | Create a test-mode client. |

### Entity interface

All entities share the same interface.

| Method | Description |
| --- | --- |
| \`load(reqmatch?, ctrl?)\` | Load a single entity by match criteria. |
| \`list(reqmatch?, ctrl?)\` | List entities matching the criteria. |
| \`create(reqdata?, ctrl?)\` | Create a new entity. |
| \`update(reqdata?, ctrl?)\` | Update an existing entity. |
| \`remove(reqmatch?, ctrl?)\` | Remove an entity. |
| \`data(data?)\` | Get or set entity data. |
| \`match(match?)\` | Get or set entity match criteria. |
| \`make()\` | Create a new instance with the same options. |
| \`client()\` | Return the parent SDK client. |
| \`entopts()\` | Return a copy of the entity options. |

`)
})




export {
  ReadmeModel
}
