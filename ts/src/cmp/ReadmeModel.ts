
import { each, names, Content } from 'jostraca'
import { cmp } from '../helpers/component'

import {
  KIT,
  getModelPath
} from '../types'

import { fact } from '../helpers/facts'
import { entityClassName, entityCollection, introOps } from '../helpers/opShape'
import { optionalComponent } from '../helpers/optional'


const ReadmeModel = cmp(function ReadmeModel(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  // Guard the Name case variant so the reference header never renders
  // "undefinedSDK" if apidef did not populate it.
  if (model.name && !model.Name) names(model, model.name)

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  Content(`
## Reference

`)

  // Delegate to target-specific reference summary
  const ReadmeModel_sdk =
    optionalComponent(ctx$, target, 'ReadmeModel')

  if (ReadmeModel_sdk) {
    ReadmeModel_sdk['ReadmeModel']({ target })
  }
  else {
    // Fallback: generic reference summary
    ReadmeModelGeneric({ target, model, entityList, authActive: fact(model.main[KIT], 'auth').apikey })
  }
})


const GENERIC_OP_ROWS: Record<string, string> = {
  load: '| `load(reqmatch?, ctrl?)` | Load a single entity by match criteria. |',
  list: '| `list(reqmatch?, ctrl?)` | List entities matching the criteria. |',
  create: '| `create(reqdata?, ctrl?)` | Create a new entity. |',
  update: '| `update(reqdata?, ctrl?)` | Update an existing entity. |',
  patch: '| `patch(reqdata?, ctrl?)` | Change part of an existing entity. |',
  remove: '| `remove(reqmatch?, ctrl?)` | Remove an entity. |',
}


const ReadmeModelGeneric = cmp(function ReadmeModelGeneric(props: any) {
  const { target, model, entityList, authActive } = props
  const apikeyRow = authActive
    ? '| `apikey` | `string` | API key for authentication. |\n'
    : ''

  Content(`### ${model.Name}SDK

#### Constructor

| Option | Type | Description |
| --- | --- | --- |
${apikeyRow}| \`base\` | \`string\` | Base URL of the API server. |
| \`prefix\` | \`string\` | URL path prefix prepended to all requests. |
| \`suffix\` | \`string\` | URL path suffix appended to all requests. |
| \`feature\` | \`object\` | Feature activation flags. |
| \`extend\` | \`array\` | Additional Feature instances to load. |

#### Methods

| Method | Returns | Description |
| --- | --- | --- |
`)

  each(entityList, (ent: any) => {
    const article = /^[aeiou]/i.test(ent.Name) ? 'an' : 'a'
    Content(`| \`${ent.Name}(data?)\` | \`${entityClassName(ent, entityCollection(model))}\` | Create ${article} ${ent.Name} entity instance. |
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

${fact(model.main[KIT], 'sharedOps') ? 'All entities share the same interface.' :
    'Each entity has only the operations its model declares; see its section below.'}

| Method | Description |
| --- | --- |
${introOps(model).map((op: string) => GENERIC_OP_ROWS[op] + '\n').join('')}| \`data(data?)\` | Get or set entity data. |
| \`match(match?)\` | Get or set entity match criteria. |
| \`make()\` | Create a new instance with the same options. |
| \`client()\` | Return the parent SDK client. |
| \`entopts()\` | Return a copy of the entity options. |

`)
})




export {
  ReadmeModel
}
