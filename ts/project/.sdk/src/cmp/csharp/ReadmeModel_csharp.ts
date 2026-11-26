
import { cmp, each, Content, isAuthActive, fact, clientOptions, entityOps, introOps } from '@voxgig/sdkgen'

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
  // entity actually exposes — never document an operation no entity has.
  const opUnion = new Set<string>(introOps(model))
  const sameOps = fact(model.main[KIT], 'sharedOps')
  const opRowDefs: Record<string, string> = {
    load: '| `Load` | `(reqmatch, ctrl) -> object?` | Load a single entity by match criteria, and return it. Raises on error. |',
    list: '| `List` | `(reqmatch, ctrl) -> object?` | List entities matching the criteria, one per record. Raises on error. |',
    create: '| `Create` | `(reqdata, ctrl) -> object?` | Create a new entity, and return it. Raises on error. |',
    update: '| `Update` | `(reqdata, ctrl) -> object?` | Update an existing entity, and return it. Raises on error. |',
    patch: '| `Patch` | `(reqdata, ctrl) -> object?` | Change part of an existing entity, and return it. Raises on error. |',
    remove: '| `Remove` | `(reqmatch, ctrl) -> object?` | Remove an entity, and return it marked as deleted. Raises on error. |',
  }
  const opRows = ['load', 'list', 'create', 'update', 'patch', 'remove']
    .filter((o) => opUnion.has(o)).map((o) => opRowDefs[o]).join('\n')
  const listResult = opUnion.has('list') ? ', and `List` a list of entities, one per\nrecord, as `object?`' : ''

  const OPTION_KIND: Record<string, string> = { string: 'string', map: 'Dictionary', list: 'List' }
  const optionRows = clientOptions(model)
    .map((o: any) => '| `' + o.name + '` | `' + OPTION_KIND[o.kind] + '` | ' + o.desc + ' |\n').join('')

  Content(`### ${model.const.Name}SDK

\`\`\`csharp
using ${model.const.Name}Sdk;

var client = new ${model.const.Name}SDK(options);
\`\`\`

Creates a new SDK client. \`options\` is a \`Dictionary<string, object?>\`.

| Option | Type | Description |
| --- | --- | --- |
${optionRows}
### TestSDK

\`\`\`csharp
var client = ${model.const.Name}SDK.TestSDK(testopts, sdkopts);
\`\`\`

Creates a test-mode client with mock transport. Both arguments may be \`null\`.

### ${model.const.Name}SDK methods

| Method | Signature | Description |
| --- | --- | --- |
| \`OptionsMap\` | \`() -> Dictionary\` | Deep copy of current SDK options. |
| \`GetUtility\` | \`() -> Utility\` | Copy of the SDK utility object. |
| \`Prepare\` | \`(fetchargs) -> Dictionary\` | Build an HTTP request definition without sending. Raises on error. |
| \`Direct\` | \`(fetchargs) -> Dictionary\` | Build and send an HTTP request. Returns a result dictionary (branch on \`ok\`). |
`)

  each(entityList, (ent: any) => {
    const article = /^[aeiou]/i.test(ent.Name) ? 'an' : 'a'
    Content(`| \`${ent.Name}\` | \`(entopts) -> ${model.const.Name}EntityBase\` | Create ${article} ${ent.Name} entity instance. |
`)
  })

  Content(`
### Entity interface

${sameOps ? 'All entities share the same interface.' : 'Each entity has only the operations its model declares; see its section below.'}

| Method | Signature | Description |
| --- | --- | --- |
${opRows}
| \`Data\` | \`(newdata) -> object?\` | Get or set entity data. |
| \`Match\` | \`(newmatch) -> object?\` | Get or set entity match criteria. |
| \`Make\` | \`() -> IEntity\` | Create a new instance with the same options. |
| \`GetName\` | \`() -> string\` | Return the entity name. |

### Result shape

Entity operations return the entity${listResult}; an entity is an \`IEntity\`, whose \`Data()\` reads its
record. They raise on error, so wrap calls in \`try\`/\`catch\` to handle
failures.

The \`Direct()\` escape hatch never raises — it returns a result
\`Dictionary<string, object?>\` you branch on via \`result["ok"]\`:

| Key | Type | Description |
| --- | --- | --- |
| \`ok\` | \`bool\` | \`true\` if the HTTP status is 2xx. |
| \`status\` | \`int\` | HTTP status code. |
| \`headers\` | \`Dictionary\` | Response headers. |
| \`data\` | \`object?\` | Parsed JSON response body. |

On error, \`ok\` is \`false\` and \`err\` contains the error value.

`)

  // Entities summary
  Content(`### Entities

`)
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
