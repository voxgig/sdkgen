
import { cmp, each, Content, isAuthActive, fact, clientOptions, entityOps, entityPath, introOps } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { ocamlVarName } from './utility_ocaml'


const ReadmeModel = cmp(function ReadmeModel(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  // Model-driven op rows for the shared entity interface: emit a row only for
  // operations at least one active entity actually exposes.
  const opUnion = new Set<string>(introOps(model))
  const opRowDefs: Record<string, string> = {
    load: '| `e_load` | `value -> value -> entity_obj` | Load a single entity by match criteria. Resolves to the entity. Raises on error. |',
    list: '| `e_list` | `value -> value -> entity_obj list` | List entities matching the criteria. Resolves to one entity per record. Raises on error. |',
    create: '| `e_create` | `?sources:(string * binary_source) list -> value -> value -> entity_obj` | Create a new entity. Resolves to the entity. Raises on error. |',
    update: '| `e_update` | `?sources:(string * binary_source) list -> value -> value -> entity_obj` | Update an existing entity. Resolves to the entity. Raises on error. |',
    patch: '| `e_patch` | `?sources:(string * binary_source) list -> value -> value -> entity_obj` | Change part of an existing entity. Resolves to the entity. Raises on error. |',
    remove: '| `e_remove` | `value -> value -> entity_obj` | Remove an entity. Resolves to the entity, marked deleted. Raises on error. |',
  }
  const opRows = ['load', 'list', 'create', 'update', 'patch', 'remove']
    .filter((o) => opUnion.has(o)).map((o) => opRowDefs[o] + '\n').join('')
  const listResult = opUnion.has('list') ? ' \u2014 `e_list` to\none entity per record \u2014' : ','
  const removeResult = opUnion.has('remove') ?
    '\n`e_remove` resolves to the entity marked deleted (`e_deleted`); it keeps the\ndata it held.' : ''

  // A closed value union holds no feature instance, so there is no `extend`.
  const OPTION_KIND: Record<string, string> = { string: 'string', map: 'map', list: '' }
  const optionRows = clientOptions(model).filter((o: any) => 'extend' !== o.name)
    .map((o: any) => '| `' + o.name + '` | `' + OPTION_KIND[o.kind] + '` | ' + o.desc + ' |\n').join('')

  Content(`### Sdk_client

\`\`\`ocaml
open Voxgig_struct
open Sdk_helpers
open Sdk_types

let client = Sdk_client.make options
\`\`\`

Creates a new SDK client from a \`value\` options map. Use \`Sdk_client.make0 ()\`
for defaults.

| Option | Type | Description |
| --- | --- | --- |
${optionRows}
### Sdk_client.test

\`\`\`ocaml
let client = Sdk_client.test_with testopts sdkopts
\`\`\`

Creates a test-mode client with mock transport. Both arguments may be \`Noval\`
(\`Sdk_client.test ()\` uses defaults).

### Sdk_client functions

| Function | Signature | Description |
| --- | --- | --- |
| \`make\` | \`value -> sdk_client\` | Construct a client from options. |
| \`make0\` | \`unit -> sdk_client\` | Construct a client with defaults. |
| \`prepare\` | \`sdk_client -> value -> value\` | Build an HTTP request definition without sending. Raises on error. |
| \`direct\` | \`sdk_client -> value -> value\` | Build and send an HTTP request. Returns a result map (branch on \`ok\`). |
`)

  each(entityList, (ent: any) => {
    const fn = ocamlVarName(ent.name)
    const article = /^[aeiou]/i.test(ent.Name) ? 'an' : 'a'
    Content(`| \`${fn}\` | \`sdk_client -> value -> entity_obj\` | ${article.charAt(0).toUpperCase() + article.slice(1)} ${ent.Name} entity accessor. |
`)
  })

  Content(`
### Entity interface

All entities are \`entity_obj\` records sharing the same fields.

| Field | Signature | Description |
| --- | --- | --- |
${opRows}| \`e_data_get\` | \`unit -> value\` | Get entity data. |
| \`e_data_set\` | \`value -> unit\` | Set entity data. |
| \`e_match_get\` | \`unit -> value\` | Get entity match criteria. |
| \`e_match_set\` | \`value -> unit\` | Set entity match criteria. |
| \`e_make\` | \`unit -> entity_obj\` | Create a new instance with the same options. |
| \`e_name\` | \`string\` | The entity name. |

### Result shape

Entity operations resolve to the ENTITY, not the raw record${listResult} and raise \`Sdk_error.E\` on error. The record is
reached through \`e_data_get\`, which returns the entity's data container.${removeResult} Wrap calls in \`try\`/\`with\` to handle failures.

The \`direct\` escape hatch never raises — it returns a result \`value\` map
you branch on via \`getp result "ok"\`:

| Key | Type | Description |
| --- | --- | --- |
| \`ok\` | \`Bool\` | \`Bool true\` if the HTTP status is 2xx. |
| \`status\` | \`Num\` | HTTP status code. |
| \`headers\` | \`Map\` | Response headers. |
| \`data\` | \`value\` | Parsed JSON response body. |

On error, \`ok\` is \`Bool false\` and \`err\` carries the error value.

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

${0 === fields.length ? '' : `| Field | Description |
| --- | --- |
`}`)
    each(fields, (field: any) => {
      Content(`| \`${field.n}\` | ${fact(model.main[KIT], 'field')[ent.name]?.[field.n]?.desc.cell ?? ''} |
`)
    })

    // Each operation is the entity record's e_<op> field.
    Content(`
${0 === opnames.length ? '' : `Operations: ${opnames.map((n: string) => 'e_' + n).join(', ')}.

`}${'' === path ? '' : `API path: \`${path}\`

`}`)
  })

})


export {
  ReadmeModel
}
