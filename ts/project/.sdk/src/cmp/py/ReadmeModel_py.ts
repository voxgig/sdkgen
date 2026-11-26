
import { cmp, each, Content, isAuthActive, entityClassName, entityCollection, fact, clientOptions, entityOps, introOps } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const ReadmeModel = cmp(function ReadmeModel(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  // Model-driven op rows for the shared entity interface: emit a
  // load/list/create/update/remove row only for operations at least one active
  // entity actually exposes (a read-only entity has just list+load) — never
  // document an operation no entity has.
  const opUnion = new Set<string>(introOps(model))
  const sameOps = fact(model.main[KIT], 'sharedOps')
  const opRowDefs: Record<string, string> = {
    load: '| `load` | `(reqmatch, ctrl) -> any` | Load a single entity by match criteria, and return it. Raises on error. |',
    list: '| `list` | `(reqmatch, ctrl) -> list` | List entities matching the criteria, one per record. Raises on error. |',
    create: '| `create` | `(reqdata, ctrl) -> any` | Create a new entity, and return it. Raises on error. |',
    update: '| `update` | `(reqdata, ctrl) -> any` | Update an existing entity, and return it. Raises on error. |',
    patch: '| `patch` | `(reqdata, ctrl) -> any` | Change part of an existing entity, and return it. Raises on error. |',
    remove: '| `remove` | `(reqmatch, ctrl) -> any` | Remove an entity, and return it marked as deleted. Raises on error. |',
  }
  const opRows = ['load', 'list', 'create', 'update', 'patch', 'remove']
    .filter((o) => opUnion.has(o)).map((o) => opRowDefs[o] + '\n').join('')
  const listResult = opUnion.has('list') ? ', and `list` a `list` of entities, one\nper record' : ''

  const OPTION_KIND: Record<string, string> = { string: 'str', map: 'dict', list: 'list' }
  const optionRows = clientOptions(model)
    .map((o: any) => '| `' + o.name + '` | `' + OPTION_KIND[o.kind] + '` | ' + o.desc + ' |\n').join('')

  Content(`### ${model.const.Name}SDK

\`\`\`python
from ${model.const.Name.toLowerCase()}_sdk import ${model.const.Name}SDK

client = ${model.const.Name}SDK(options)
\`\`\`

Creates a new SDK client.

| Option | Type | Description |
| --- | --- | --- |
${optionRows}
### test

\`\`\`python
client = ${model.const.Name}SDK.test(testopts, sdkopts)
\`\`\`

Creates a test-mode client with mock transport. Both arguments may be \`None\`.

### ${model.const.Name}SDK methods

| Method | Signature | Description |
| --- | --- | --- |
| \`options_map\` | \`() -> dict\` | Deep copy of current SDK options. |
| \`get_utility\` | \`() -> Utility\` | Copy of the SDK utility object. |
| \`prepare\` | \`(fetchargs) -> dict\` | Build an HTTP request definition without sending. Raises on error. |
| \`direct\` | \`(fetchargs) -> dict\` | Build and send an HTTP request. Returns a result dict (branch on \`ok\`). |
`)

  each(entityList, (ent: any) => {
    const article = /^[aeiou]/i.test(ent.Name) ? 'an' : 'a'
    Content(`| \`${ent.Name}\` | \`(data) -> ${entityClassName(ent, entityCollection(model))}\` | Create ${article} ${ent.Name} entity instance. |
`)
  })

  Content(`
### Entity interface

${0 === entityList.length ? '' : (sameOps ? 'All entities share the same interface.' :
  'Each entity has only the operations its model declares; see its section below.') + '\n\n'}| Method | Signature | Description |
| --- | --- | --- |
${opRows}| \`data_get\` | \`() -> dict\` | Get entity data. |
| \`data_set\` | \`(data)\` | Set entity data. |
| \`match_get\` | \`() -> dict\` | Get entity match criteria. |
| \`match_set\` | \`(match)\` | Set entity match criteria. |
| \`make\` | \`() -> Entity\` | Create a new instance with the same options. |
| \`get_name\` | \`() -> str\` | Return the entity name. |

### Result shape

Entity operations return the entity${listResult}; an entity's \`data_get()\` reads its record (a \`dict\`). They raise
on error, so wrap calls in \`try\`/\`except\` to handle failures.

The \`direct()\` escape hatch never raises — it returns a result \`dict\`
you branch on via \`result["ok"]\`:

| Key | Type | Description |
| --- | --- | --- |
| \`ok\` | \`bool\` | \`True\` if the HTTP status is 2xx. |
| \`status\` | \`int\` | HTTP status code. |
| \`headers\` | \`dict\` | Response headers. |
| \`data\` | \`any\` | Parsed JSON response body. |

On error, \`ok\` is \`False\` and \`err\` contains the error value.

`)

  // Entities summary
  if (0 < entityList.length) {
    Content(`### Entities

`)
  }
  each(entityList, (ent: any) => {
    const fields = Object.values(ent.fields || {})
    const opnames = entityOps(ent)
    const ops = ent.op || {}
    const points = each(ops).map((op: any) =>
      op.points ? each(op.points) : []
    ).flat()
    const path = points.length > 0 ? (points[0] as any).o || '' : ''

    Content(`#### ${ent.Name}

| Field | Description |
| --- | --- |
`)
    each(fields, (field: any) => {
      Content(`| \`${field.n}\` | ${fact(model.main[KIT], 'field')[ent.name]?.[field.n]?.desc.cell ?? ''} |
`)
    })

    Content(`
Operations: ${opnames.map((n: string) => n.charAt(0).toUpperCase() + n.slice(1)).join(', ')}.

API path: \`${path}\`

`)
  })

})


export {
  ReadmeModel
}
