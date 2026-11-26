
import { cmp, each, Content, isAuthActive, entityClassName, entityCollection, fact, clientOptions, entityOps, entityPath, introOps } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const ReadmeModel = cmp(function ReadmeModel(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  // Model-driven op rows for the shared entity interface: emit a
  // load/list/create/update/patch/remove row only for operations at least one active
  // entity actually exposes (a read-only entity has just list+load) — never
  // document an operation no entity has.
  const opUnion = new Set<string>(introOps(model))
  const sameOps = fact(model.main[KIT], 'sharedOps')
  const opRowDefs: Record<string, string> = {
    load: '| `load` | `load(reqmatch?, ctrl?): Promise<Entity>` | Load a single entity by match criteria, and return it. |',
    list: '| `list` | `list(reqmatch?, ctrl?): Promise<Entity[]>` | List entities matching the criteria, one per record. |',
    create: '| `create` | `create(reqdata?, ctrl?): Promise<Entity>` | Create a new entity, and return it. |',
    update: '| `update` | `update(reqdata?, ctrl?): Promise<Entity>` | Update an existing entity, and return it. |',
    patch: '| `patch` | `patch(reqdata?, ctrl?): Promise<Entity>` | Change part of an existing entity, and return it. |',
    remove: '| `remove` | `remove(reqmatch?, ctrl?): Promise<Entity>` | Remove an entity, and return it marked as deleted. |',
  }
  const opRows = ['load', 'list', 'create', 'update', 'patch', 'remove']
    .filter((o) => opUnion.has(o)).map((o) => opRowDefs[o] + '\n').join('')

  // Model-driven return-value bullets: describe only the operations that
  // actually exist (single-object ops among load/create/update, plus
  // list/remove) — never document return semantics for a missing op.
  const singleOps = ['load', 'create', 'update', 'patch'].filter((o) => opUnion.has(o))
    .map((o) => '`' + o + '`')
  const retBullets: string[] = []
  if (singleOps.length) {
    const joined = singleOps.length > 1
      ? singleOps.slice(0, -1).join(', ') + ' and ' + singleOps[singleOps.length - 1]
      : singleOps[0]
    retBullets.push(`- ${joined} ${singleOps.length > 1 ? 'resolve' : 'resolves'} to a single entity object.`)
  }
  if (opUnion.has('list')) {
    retBullets.push('- `list` resolves to an **array** of entity objects (iterate it directly;\n  there is no `.data` and no `.ok`).')
  }
  if (opUnion.has('remove')) {
    retBullets.push('- `remove` resolves to the entity, marked as deleted.')
  }
  const returnBullets = retBullets.join('\n')

  const OPTION_KIND: Record<string, string> = { string: 'string', map: 'object', list: 'Feature[]' }
  const optionRows = clientOptions(model)
    .map((o: any) => '| `' + o.name + '` | `' + OPTION_KIND[o.kind] + '` | ' + o.desc + ' |\n').join('')

  Content(`### ${model.const.Name}SDK

#### Constructor

\`\`\`js
new ${model.const.Name}SDK(options?)
\`\`\`

| Option | Type | Description |
| --- | --- | --- |
${optionRows}
#### Methods

| Method | Returns | Description |
| --- | --- | --- |
| \`options()\` | \`object\` | Deep copy of current SDK options. |
| \`utility()\` | \`Utility\` | Deep copy of the SDK utility object. |
| \`prepare(fetchargs?)\` | \`Promise<FetchDef>\` | Build an HTTP request definition without sending it. |
| \`direct(fetchargs?)\` | \`Promise<DirectResult>\` | Build and send an HTTP request. |
`)

  each(entityList, (ent: any) => {
    const article = /^[aeiou]/i.test(ent.Name) ? 'an' : 'a'
    Content(`| \`${ent.Name}(data?)\` | \`${entityClassName(ent, entityCollection(model))}\` | Create ${article} ${ent.Name} entity instance. |
`)
  })

  Content(`| \`tester(testopts?, sdkopts?)\` | \`${model.const.Name}SDK\` | Create a test-mode client instance. |

#### Static methods

| Method | Returns | Description |
| --- | --- | --- |
| \`${model.const.Name}SDK.test(testopts?, sdkopts?)\` | \`${model.const.Name}SDK\` | Create a test-mode client. |

### Entity interface

${0 === entityList.length ? '' : (sameOps ? 'All entities share the same interface.' :
  'Each entity has only the operations its model declares; see its section below.') + '\n\n'}#### Methods

| Method | Signature | Description |
| --- | --- | --- |
${opRows}| \`data\` | \`data(data?: Partial<Entity>): Entity\` | Get or set entity data. |
| \`match\` | \`match(match?: Partial<Entity>): Partial<Entity>\` | Get or set entity match criteria. |
| \`make\` | \`make(): Entity\` | Create a new instance with the same options. |
| \`client\` | \`client(): ${model.const.Name}SDK\` | Return the parent SDK client. |
| \`entopts\` | \`entopts(): object\` | Return a copy of the entity options. |

#### Return values

Entity operations resolve to the entity itself — there is no result
envelope, and an entity's \`data()\` reads its record${'' === returnBullets ? '.' : `:

${returnBullets}`}

On a failed request these methods **throw**, so wrap calls in
\`try\`/\`catch\` to handle errors. Only \`direct()\` returns the result
envelope described below.

### DirectResult shape

The \`direct()\` method returns:

\`\`\`js
{
  ok: true,
  status: 200,
  headers: {},
  data: {}
}
\`\`\`

On error, \`ok\` is \`false\` and an \`err\` property contains the error.

### FetchDef shape

The \`prepare()\` method returns:

\`\`\`js
{
  url: 'string',
  method: 'string',
  headers: {},
  body: undefined
}
\`\`\`

${0 < entityList.length ? '### Entities\n\n' : ''}`)

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

    Content(`
${0 === opnames.length ? '' : `Operations: ${opnames.join(', ')}.

`}${'' === path ? '' : `API path: \`${path}\`

`}`)
  })

})


export {
  ReadmeModel
}
