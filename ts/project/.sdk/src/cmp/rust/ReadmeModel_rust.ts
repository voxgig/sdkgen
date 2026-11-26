
import { cmp, each, Content, isAuthActive, entityClassName, entityCollection, fact, clientOptions, entityOps, introOps } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { crateIdent, rustVarName, rustMethodName } from './utility_rust'


const ReadmeModel = cmp(function ReadmeModel(props: any) {
  const { target, ctx$: { model } } = props

  const rustcrate = crateIdent(model)
  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  // Model-driven op rows for the shared entity interface: emit a row only for
  // operations at least one active entity actually exposes.
  const opUnion = new Set<string>(introOps(model))
  const opRowDefs: Record<string, string> = {
    load: '| `load` | `(reqmatch: Value, ctrl: Value) -> Result<Rc<Self>, ' + model.const.Name + 'Error>` | Load a single entity by match criteria. |',
    list: '| `list` | `(reqmatch: Value, ctrl: Value) -> Result<Vec<Rc<Self>>, ' + model.const.Name + 'Error>` | List entities matching the criteria, one per record. |',
    create: '| `create` | `(reqdata: Value, ctrl: Value) -> Result<Rc<Self>, ' + model.const.Name + 'Error>` | Create a new entity. |',
    update: '| `update` | `(reqdata: Value, ctrl: Value) -> Result<Rc<Self>, ' + model.const.Name + 'Error>` | Update an existing entity. |',
    patch: '| `patch` | `(reqdata: Value, ctrl: Value) -> Result<Rc<Self>, ' + model.const.Name + 'Error>` | Change part of an existing entity. |',
    remove: '| `remove` | `(reqmatch: Value, ctrl: Value) -> Result<Rc<Self>, ' + model.const.Name + 'Error>` | Remove an entity, which is returned marked as deleted. |',
  }
  const opRows = ['load', 'list', 'create', 'update', 'patch', 'remove']
    .filter((o) => opUnion.has(o)).map((o) => opRowDefs[o]).join('\n')
  const listResult = opUnion.has('list') ? ', and `list` a `Vec` of\nentities, one per record' : ''

  // A closed value union holds no feature instance, so there is no `extend`.
  const OPTION_KIND: Record<string, string> = { string: 'string', map: 'map', list: '' }
  const optionRows = clientOptions(model).filter((o: any) => 'extend' !== o.name)
    .map((o: any) => '| `' + o.name + '` | `' + OPTION_KIND[o.kind] + '` | ' + o.desc + ' |\n').join('')

  Content(`### ${model.const.Name}SDK

\`\`\`rust
use ${rustcrate}::{${model.const.Name}SDK, Value};

let client = ${model.const.Name}SDK::new(options);
\`\`\`

Creates a new SDK client. \`options\` is a \`Value\` map (\`Value::Noval\` for
none) carrying any of the following keys:

| Option | Value type | Description |
| --- | --- | --- |
${optionRows}
### test_sdk

\`\`\`rust
use ${rustcrate}::{test_sdk, Value};

let client = test_sdk(testopts, sdkopts);
\`\`\`

Creates a test-mode client with mock transport. Both arguments may be
\`Value::Noval\`.

### ${model.const.Name}SDK methods

| Method | Signature | Description |
| --- | --- | --- |
| \`options_map\` | \`() -> Value\` | Deep copy of the current SDK options. |
| \`get_utility\` | \`() -> Rc<Utility>\` | Copy of the SDK utility object. |
| \`prepare\` | \`(fetchargs: Value) -> Result<Value, ${model.const.Name}Error>\` | Build an HTTP request definition without sending. |
| \`direct\` | \`(fetchargs: Value) -> Result<Value, ${model.const.Name}Error>\` | Build and send an HTTP request. \`Ok\` is a result map (branch on \`ok\`). |
`)

  each(entityList, (ent: any) => {
    const article = /^[aeiou]/i.test(ent.Name) ? 'an' : 'a'
    Content(`| \`${rustMethodName(ent.name)}\` | \`(entopts: Value) -> Rc<${entityClassName(ent, entityCollection(model))}>\` | Create ${article} ${ent.Name} entity instance. |
`)
  })

  Content(`
### Entity interface

All entities share the same interface.

| Method | Signature | Description |
| --- | --- | --- |
${opRows}
| \`data\` | \`(args: Option<&Value>) -> Value\` | Get entity data (pass \`Some(&map)\` to set). |
| \`matchv\` | \`(args: Option<&Value>) -> Value\` | Get entity match criteria (pass \`Some(&map)\` to set). |
| \`make\` | \`() -> Rc<dyn Entity>\` | Create a new instance with the same options. |
| \`get_name\` | \`() -> String\` | Return the entity name. |

### Result shape

Entity operations return the entity on \`Ok\`${listResult}; \`data(None)\` reads an entity's record. \`Err\` is
the branded error. The operations are methods of the
\`${model.const.Name}EntityBase\` trait and \`data\` of the \`Entity\` trait, so
import both.

The \`direct()\` escape hatch resolves to \`Ok\` even on a non-2xx response —
it returns a result \`Value::Map\` you branch on via \`getp(&result, "ok")\`:

| Key | Type | Description |
| --- | --- | --- |
| \`ok\` | \`bool\` | \`true\` if the HTTP status is 2xx. |
| \`status\` | \`number\` | HTTP status code. |
| \`headers\` | \`map\` | Response headers. |
| \`data\` | \`any\` | Parsed JSON response body. |

On error, \`ok\` is \`false\` and \`err\` carries the error value.

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
