
import { cmp, each, Content, isAuthActive, fact, clientOptions, entityOps, entityPath, introOps } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const ReadmeModel = cmp(function ReadmeModel(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  // Model-driven op rows for the shared entity interface: emit a row only for
  // operations at least one active entity actually exposes — never document an
  // operation no entity has.
  const opUnion = new Set<string>(introOps(model))
  const sameOps = fact(model.main[KIT], 'sharedOps')
  const opRowDefs: Record<string, string> = {
    load: '| `load` | `(ent reqmatch ctrl) -> entity` | Load a single entity by match criteria, and return it. Raises on error. |',
    list: '| `list` | `(ent reqmatch ctrl) -> vector` | List entities matching the criteria, one per record. Raises on error. |',
    create: '| `create` | `(ent reqdata ctrl) -> entity` | Create a new entity, and return it. Raises on error. |',
    update: '| `update` | `(ent reqdata ctrl) -> entity` | Update an existing entity, and return it. Raises on error. |',
    patch: '| `patch` | `(ent reqdata ctrl) -> entity` | Change part of an existing entity, and return it. Raises on error. |',
    remove: '| `remove` | `(ent reqmatch ctrl) -> entity` | Remove an entity, and return it marked as deleted. Raises on error. |',
  }
  const opRows = ['load', 'list', 'create', 'update', 'patch', 'remove']
    .filter((o) => opUnion.has(o)).map((o) => opRowDefs[o] + '\n').join('')
  const listResult = opUnion.has('list') ? ', and `list` to a `vector` of\nentities, one per record' : ''

  const OPTION_KIND: Record<string, string> = { string: 'string', map: 'map', list: 'vector' }
  const optionRows = clientOptions(model)
    .map((o: any) => '| `' + o.name + '` | `' + OPTION_KIND[o.kind] + '` | ' + o.desc + ' |\n').join('')

  Content(`### make-sdk

\`\`\`clojure
(require '[sdk.api :as api]
         '[voxgig.struct :as vs])

(def client (api/make-sdk options))
\`\`\`

Creates a new SDK client. \`options\` is a \`voxgig.struct\` map (or \`nil\`).

| Option | Type | Description |
| --- | --- | --- |
${optionRows}
### test-sdk

\`\`\`clojure
(def client (api/test-sdk testopts sdkopts))
\`\`\`

Creates a test-mode client with mock transport. Both arguments may be \`nil\`.

### Client functions

| Function | Signature | Description |
| --- | --- | --- |
| \`options-map\` | \`(client) -> map\` | Deep copy of current SDK options. |
| \`get-utility\` | \`(client) -> utility\` | Copy of the SDK utility object. |
| \`prepare\` | \`(client fetchargs) -> map\` | Build an HTTP request definition without sending. Raises on error. |
| \`direct\` | \`(client fetchargs) -> map\` | Build and send an HTTP request. Returns a result map (branch on \`ok\`). |
`)

  each(entityList, (ent: any) => {
    const article = /^[aeiou]/i.test(ent.Name) ? 'an' : 'a'
    Content(`| \`${ent.name}\` | \`(client data) -> ${ent.Name} entity\` | Create ${article} ${ent.Name} entity instance. |
`)
  })

  Content(`
### Entity interface

${0 === entityList.length ? '' : (sameOps ? 'All entities share the same interface.' :
  'Each entity has only the operations its model declares; see its section below.') + ' '}Operations are functions in the
entity namespace (\`sdk.entity.<name>\`); state accessors are stored on the
entity map and are called via keyword lookup.

| Member | Signature | Description |
| --- | --- | --- |
${opRows}| \`:data-get\` | \`() -> map\` | Get entity data. |
| \`:data-set\` | \`(data)\` | Set entity data. |
| \`:match-get\` | \`() -> map\` | Get entity match criteria. |
| \`:match-set\` | \`(match)\` | Set entity match criteria. |
| \`:make\` | \`() -> entity\` | Create a new instance with the same options. |
| \`:get-name\` | \`() -> string\` | Return the entity name. |

State accessors are called by looking up the fn and applying it, e.g.
\`((:data-get ent))\` or \`((:data-set ent) (vs/jm "k" "v"))\`.

### Result shape

Entity operations resolve to the entity${listResult}. Read an entity's record with
\`((:data-get ent))\`. They raise (via \`ex-info\`) on error, so wrap calls
in \`try\`/\`catch\` to handle failures.

The \`direct\` escape hatch never raises — it returns a result \`map\` you
branch on via \`(vs/getprop result "ok")\`:

| Key | Type | Description |
| --- | --- | --- |
| \`ok\` | \`boolean\` | \`true\` if the HTTP status is 2xx. |
| \`status\` | \`long\` | HTTP status code. |
| \`headers\` | \`map\` | Response headers. |
| \`data\` | \`any\` | Parsed JSON response body. |

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
