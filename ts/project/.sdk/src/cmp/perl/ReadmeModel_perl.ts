
import { cmp, each, Content, isAuthActive, fact, clientOptions, entityOps, entityPath, introOps } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const ReadmeModel = cmp(function ReadmeModel(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  // Model-driven op rows: emit a row only for operations at least one active
  // entity actually exposes — never document an operation no entity has.
  const opUnion = new Set<string>(introOps(model))
  const sameOps = fact(model.main[KIT], 'sharedOps')
  const opRowDefs: Record<string, string> = {
    load: '| `load` | `($reqmatch, $ctrl) -> entity` | Load a single entity by match criteria, and return it. Dies on error. |',
    list: '| `list` | `($reqmatch, $ctrl) -> arrayref` | List entities matching the criteria, one per record. Dies on error. |',
    create: '| `create` | `($reqdata, $ctrl) -> entity` | Create a new entity, and return it. Dies on error. |',
    update: '| `update` | `($reqdata, $ctrl) -> entity` | Update an existing entity, and return it. Dies on error. |',
    patch: '| `patch` | `($reqdata, $ctrl) -> entity` | Change part of an existing entity, and return it. Dies on error. |',
    remove: '| `remove` | `($reqmatch, $ctrl) -> entity` | Remove an entity, and return it marked as deleted. Dies on error. |',
  }
  const opRows = ['load', 'list', 'create', 'update', 'patch', 'remove']
    .filter((o) => opUnion.has(o)).map((o) => opRowDefs[o] + '\n').join('')
  const listResult = opUnion.has('list') ? ', and `list` an `arrayref` of\nentities, one per record' : ''

  const OPTION_KIND: Record<string, string> = { string: 'string', map: 'hashref', list: 'arrayref' }
  const optionRows = clientOptions(model)
    .map((o: any) => '| `' + o.name + '` | `' + OPTION_KIND[o.kind] + '` | ' + o.desc + ' |\n').join('')

  Content(`### ${model.const.Name}SDK

\`\`\`perl
use lib 'lib';
use ${model.const.Name}SDK;

my $client = ${model.const.Name}SDK->new($options);
\`\`\`

Creates a new SDK client.

| Option | Type | Description |
| --- | --- | --- |
${optionRows}
### test

\`\`\`perl
my $client = ${model.const.Name}SDK->test($testopts, $sdkopts);
\`\`\`

Creates a test-mode client with mock transport. Both arguments may be \`undef\`.

### ${model.const.Name}SDK methods

| Method | Signature | Description |
| --- | --- | --- |
| \`options_map\` | \`() -> hashref\` | Deep copy of current SDK options. |
| \`get_utility\` | \`() -> utility\` | Copy of the SDK utility object. |
| \`prepare\` | \`($fetchargs) -> hashref\` | Build an HTTP request definition without sending. Dies on error. |
| \`direct\` | \`($fetchargs) -> hashref\` | Build and send an HTTP request. Returns a result hashref (branch on \`ok\`). |
`)

  each(entityList, (ent: any) => {
    const article = /^[aeiou]/i.test(ent.Name) ? 'an' : 'a'
    Content(`| \`${ent.Name}\` | \`($data) -> ${ent.Name} entity\` | Create ${article} ${ent.Name} entity instance. |
`)
  })

  Content(`
### Entity interface

${0 === entityList.length ? '' : (sameOps ? 'All entities share the same interface.' :
  'Each entity has only the operations its model declares; see its section below.') + '\n\n'}| Method | Signature | Description |
| --- | --- | --- |
${opRows}| \`data_get\` | \`() -> hashref\` | Get entity data. |
| \`data_set\` | \`($data)\` | Set entity data. |
| \`match_get\` | \`() -> hashref\` | Get entity match criteria. |
| \`match_set\` | \`($match)\` | Set entity match criteria. |
| \`make\` | \`() -> entity\` | Create a new instance with the same options. |
| \`get_name\` | \`() -> string\` | Return the entity name. |

### Result shape

Entity operations return the entity${listResult}; \`data_get\` reads an entity's record (a
\`hashref\`). They die on error, so wrap calls in \`eval { ... }\` and
inspect \`$@\` to handle failures.

The \`direct()\` escape hatch never dies — it returns a result \`hashref\`
you branch on via \`$result->{ok}\`:

| Key | Type | Description |
| --- | --- | --- |
| \`ok\` | \`boolean\` | True if the HTTP status is 2xx. |
| \`status\` | \`integer\` | HTTP status code. |
| \`headers\` | \`hashref\` | Response headers. |
| \`data\` | \`any\` | Parsed JSON response body. |

On error, \`ok\` is false and \`err\` contains the error value.

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
Operations: ${opnames.map((n: string) => n.charAt(0).toUpperCase() + n.slice(1)).join(', ')}.

${'' === path ? '' : `API path: \`${path}\`

`}`)
  })

})


export {
  ReadmeModel
}
