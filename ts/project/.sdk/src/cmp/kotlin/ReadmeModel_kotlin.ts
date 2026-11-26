
import { cmp, each, Content, isAuthActive, fact, clientOptions, entityOps, entityPath, introOps } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { kotlinVarName } from './utility_kotlin'


const ReadmeModel = cmp(function ReadmeModel(props: any) {
  const { target, ctx$: { model } } = props

  const SDK = model.const.Name + 'SDK'

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  // Model-driven op rows for the shared entity interface: emit a
  // load/list/create/update/remove row only for operations at least one active
  // entity actually exposes — never document an operation no entity has.
  const opUnion = new Set<string>(introOps(model))
  const sameOps = fact(model.main[KIT], 'sharedOps')
  const opRowDefs: Record<string, string> = {
    load: '| `load` | `(reqmatch, ctrl) -> Any?` | Load a single entity by match criteria, and return it. Raises on error. |',
    list: '| `list` | `(reqmatch, ctrl) -> Any?` | List entities matching the criteria, one per record. Raises on error. |',
    create: '| `create` | `(reqdata, ctrl) -> Any?` | Create a new entity, and return it. Raises on error. |',
    update: '| `update` | `(reqdata, ctrl) -> Any?` | Update an existing entity, and return it. Raises on error. |',
    patch: '| `patch` | `(reqdata, ctrl) -> Any?` | Change part of an existing entity, and return it. Raises on error. |',
    remove: '| `remove` | `(reqmatch, ctrl) -> Any?` | Remove an entity, and return it marked as deleted. Raises on error. |',
  }
  const opRows = ['load', 'list', 'create', 'update', 'patch', 'remove']
    .filter((o) => opUnion.has(o)).map((o) => opRowDefs[o] + '\n').join('')
  const listResult = opUnion.has('list') ? ', and `list` a list of entities, one per\nrecord, as `Any?`' : ''

  const OPTION_KIND: Record<string, string> = { string: 'String', map: 'Map', list: 'List' }
  const optionRows = clientOptions(model)
    .map((o: any) => '| `' + o.name + '` | `' + OPTION_KIND[o.kind] + '` | ' + o.desc + ' |\n').join('')

  Content(`### ${SDK}

\`\`\`kotlin
val client = ${SDK}(options)
\`\`\`

Creates a new SDK client. \`options\` is a \`MutableMap<String, Any?>\`.

| Option | Type | Description |
| --- | --- | --- |
${optionRows}
### testSDK

\`\`\`kotlin
val client = ${SDK}.testSDK(testopts, sdkopts)
\`\`\`

Creates a test-mode client with mock transport. Both arguments may be \`null\`.

### ${SDK} methods

| Method | Signature | Description |
| --- | --- | --- |
| \`optionsMap\` | \`() -> MutableMap\` | Deep copy of current SDK options. |
| \`getUtility\` | \`() -> Utility\` | Copy of the SDK utility object. |
| \`prepare\` | \`(fetchargs) -> MutableMap\` | Build an HTTP request definition without sending. Raises on error. |
| \`direct\` | \`(fetchargs) -> MutableMap\` | Build and send an HTTP request. Returns a result map (branch on \`ok\`). |
`)

  each(entityList, (ent: any) => {
    const article = /^[aeiou]/i.test(ent.Name) ? 'an' : 'a'
    Content(`| \`${kotlinVarName(ent.name)}\` | \`(entopts) -> SdkEntity\` | Create ${article} ${ent.Name} entity instance. |
`)
  })

  Content(`
### Entity interface

${0 === entityList.length ? '' : (sameOps ? 'All entities share the same interface.' :
  'Each entity has only the operations its model declares; see its section below.') + '\n\n'}| Method | Signature | Description |
| --- | --- | --- |
${opRows}| \`data\` | \`(vararg newdata) -> Any?\` | Get or set entity data. |
| \`match\` | \`(vararg newmatch) -> Any?\` | Get or set entity match criteria. |
| \`make\` | \`() -> Entity\` | Create a new instance with the same options. |
| \`name\` | \`val: String\` | The entity name. |

### Result shape

Entity operations return the entity${listResult}; an entity is an \`SdkEntity\`, whose \`data()\` reads its
record. They raise on error, so wrap calls in \`try\`/\`catch\` to handle
failures.

The \`direct()\` escape hatch never raises — it returns a result
\`MutableMap<String, Any?>\` you branch on via \`result["ok"]\`:

| Key | Type | Description |
| --- | --- | --- |
| \`ok\` | \`Boolean\` | \`true\` if the HTTP status is 2xx. |
| \`status\` | \`Int\` | HTTP status code. |
| \`headers\` | \`Map\` | Response headers. |
| \`data\` | \`Any?\` | Parsed JSON response body. |

On error, \`ok\` is \`false\` and \`err\` contains the error value.

`)

  // Entities summary
  if (0 < entityList.length) {
    Content(`### Entities

`)
  }
  each(entityList, (ent: any) => {
    const fields = Object.values(ent.fields || {})
    const opnames = entityOps(ent)
    const path = entityPath(ent)

    Content(`#### ${ent.Name}

| Field | Description |
| --- | --- |
`)
    each(fields, (field: any) => {
      Content(`| \`${field.n}\` | ${fact(model.main[KIT], 'field')[ent.name]?.[field.n]?.desc.cell ?? ''} |
`)
    })

    Content(`
${0 === opnames.length ? '' : `Operations: ${opnames.join(', ')}.

`}${'' === path ? '' : `API path: \`${path}\`

`}`)
  })

})


export {
  ReadmeModel
}
