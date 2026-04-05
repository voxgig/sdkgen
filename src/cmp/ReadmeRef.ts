
import { cmp, each, Content, File } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'

import { requirePath } from '../utility'


const OP_SIGNATURES_TS: Record<string, { sig: string, returns: string, desc: string }> = {
  load: {
    sig: 'load(match: object, ctrl?: object)',
    returns: 'Promise<object>',
    desc: 'Load a single entity matching the given criteria.',
  },
  list: {
    sig: 'list(match: object, ctrl?: object)',
    returns: 'Promise<object[]>',
    desc: 'List entities matching the given criteria. Returns an array.',
  },
  create: {
    sig: 'create(data: object, ctrl?: object)',
    returns: 'Promise<object>',
    desc: 'Create a new entity with the given data.',
  },
  update: {
    sig: 'update(data: object, ctrl?: object)',
    returns: 'Promise<object>',
    desc: 'Update an existing entity. The data must include the entity `id`.',
  },
  remove: {
    sig: 'remove(match: object, ctrl?: object)',
    returns: 'Promise<void>',
    desc: 'Remove the entity matching the given criteria.',
  },
}

const OP_SIGNATURES_GO: Record<string, { sig: string, returns: string, desc: string }> = {
  load: {
    sig: 'Load(reqmatch, ctrl map[string]any) (any, error)',
    returns: '(any, error)',
    desc: 'Load a single entity matching the given criteria.',
  },
  list: {
    sig: 'List(reqmatch, ctrl map[string]any) (any, error)',
    returns: '(any, error)',
    desc: 'List entities matching the given criteria. Returns an array.',
  },
  create: {
    sig: 'Create(reqdata, ctrl map[string]any) (any, error)',
    returns: '(any, error)',
    desc: 'Create a new entity with the given data.',
  },
  update: {
    sig: 'Update(reqdata, ctrl map[string]any) (any, error)',
    returns: '(any, error)',
    desc: 'Update an existing entity. The data must include the entity `id`.',
  },
  remove: {
    sig: 'Remove(reqmatch, ctrl map[string]any) (any, error)',
    returns: '(any, error)',
    desc: 'Remove the entity matching the given criteria.',
  },
}


const ReadmeRef = cmp(function ReadmeRef(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const publishedEntities = each(entity).filter((e: any) => e.active !== false)

  const isGo = target.name === 'go'
  const lang = isGo ? 'go' : 'ts'
  const OP_SIGNATURES = isGo ? OP_SIGNATURES_GO : OP_SIGNATURES_TS

  File({ name: 'REFERENCE.md' }, () => {

    Content(`# ${model.Name} ${target.title} SDK Reference

Complete API reference for the ${model.Name} ${target.title} SDK.


## ${model.Name}SDK

### Constructor

`)

    if (isGo) {
      Content(`\`\`\`go
func New${model.const.Name}SDK(options map[string]any) *${model.const.Name}SDK
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`options\` | \`map[string]any\` | SDK configuration options. |
| \`options["apikey"]\` | \`string\` | API key for authentication. |
| \`options["base"]\` | \`string\` | Base URL for API requests. |
| \`options["prefix"]\` | \`string\` | URL prefix appended after base. |
| \`options["suffix"]\` | \`string\` | URL suffix appended after path. |
| \`options["headers"]\` | \`map[string]any\` | Custom headers for all requests. |
| \`options["feature"]\` | \`map[string]any\` | Feature configuration. |
| \`options["system"]\` | \`map[string]any\` | System overrides (e.g. custom fetch). |

`)
    }
    else {
      Content(`\`\`\`ts
new ${model.Name}SDK(options?: object)
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`options\` | \`object\` | SDK configuration options. |
| \`options.apikey\` | \`string\` | API key for authentication. |
| \`options.base\` | \`string\` | Base URL for API requests. |
| \`options.prefix\` | \`string\` | URL prefix appended after base. |
| \`options.suffix\` | \`string\` | URL suffix appended after path. |
| \`options.headers\` | \`object\` | Custom headers for all requests. |
| \`options.feature\` | \`object\` | Feature configuration. |
| \`options.system\` | \`object\` | System overrides (e.g. custom fetch). |

`)
    }


    Content(`
### Static Methods

`)

    if (isGo) {
      Content(`#### \`TestSDK(testopts, sdkopts map[string]any) *${model.const.Name}SDK\`

Create a test client with mock features active. Both arguments may be \`nil\`.

\`\`\`go
client := sdk.TestSDK(nil, nil)
\`\`\`

`)
    }
    else {
      Content(`#### \`${model.Name}SDK.test(testopts?, sdkopts?)\`

Create a test client with mock features active.

\`\`\`ts
const client = ${model.Name}SDK.test()
\`\`\`

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`testopts\` | \`object\` | Test feature options. |
| \`sdkopts\` | \`object\` | Additional SDK options merged with test defaults. |

**Returns:** \`${model.Name}SDK\` instance in test mode.

`)
    }


    Content(`
### Instance Methods

`)


    // Entity factory methods
    publishedEntities.map((ent: any) => {
      if (isGo) {
        Content(`#### \`${ent.Name}(data map[string]any) ${model.const.Name}Entity\`

Create a new \`${ent.Name}\` entity instance. Pass \`nil\` for no initial data.

`)
      }
      else {
        Content(`#### \`${ent.Name}(data?: object)\`

Create a new \`${ent.Name}\` entity instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`data\` | \`object\` | Initial entity data. |

**Returns:** \`${ent.Name}Entity\` instance.

`)
      }
    })


    if (isGo) {
      Content(`#### \`OptionsMap() map[string]any\`

Return a deep copy of the current SDK options.

#### \`GetUtility() *Utility\`

Return a copy of the SDK utility object.

#### \`Direct(fetchargs map[string]any) (map[string]any, error)\`

Make a direct HTTP request to any API endpoint.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`fetchargs["path"]\` | \`string\` | URL path with optional \`{param}\` placeholders. |
| \`fetchargs["method"]\` | \`string\` | HTTP method (default: \`"GET"\`). |
| \`fetchargs["params"]\` | \`map[string]any\` | Path parameter values for \`{param}\` substitution. |
| \`fetchargs["query"]\` | \`map[string]any\` | Query string parameters. |
| \`fetchargs["headers"]\` | \`map[string]any\` | Request headers (merged with defaults). |
| \`fetchargs["body"]\` | \`any\` | Request body (maps are JSON-serialized). |
| \`fetchargs["ctrl"]\` | \`map[string]any\` | Control options (e.g. \`map[string]any{"explain": true}\`). |

**Returns:** \`(map[string]any, error)\`

#### \`Prepare(fetchargs map[string]any) (map[string]any, error)\`

Prepare a fetch definition without sending the request. Accepts the
same parameters as \`Direct()\`.

**Returns:** \`(map[string]any, error)\`

`)
    }
    else {
      Content(`#### \`options()\`

Return a deep copy of the current SDK options.

**Returns:** \`object\`

#### \`utility()\`

Return a copy of the SDK utility object.

**Returns:** \`object\`

#### \`direct(fetchargs?: object)\`

Make a direct HTTP request to any API endpoint.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`fetchargs.path\` | \`string\` | URL path with optional \`{param}\` placeholders. |
| \`fetchargs.method\` | \`string\` | HTTP method (default: \`GET\`). |
| \`fetchargs.params\` | \`object\` | Path parameter values for \`{param}\` substitution. |
| \`fetchargs.query\` | \`object\` | Query string parameters. |
| \`fetchargs.headers\` | \`object\` | Request headers (merged with defaults). |
| \`fetchargs.body\` | \`any\` | Request body (objects are JSON-serialized). |
| \`fetchargs.ctrl\` | \`object\` | Control options (e.g. \`{ explain: true }\`). |

**Returns:** \`Promise<{ ok, status, headers, data } | Error>\`

#### \`prepare(fetchargs?: object)\`

Prepare a fetch definition without sending the request. Accepts the
same parameters as \`direct()\`.

**Returns:** \`Promise<{ url, method, headers, body } | Error>\`

#### \`tester(testopts?, sdkopts?)\`

Alias for \`${model.Name}SDK.test()\`.

**Returns:** \`${model.Name}SDK\` instance in test mode.

`)
    }


    // Entity reference sections
    publishedEntities.map((ent: any) => {
      const opnames = Object.keys(ent.op || {})
      const fields = ent.field || []

      Content(`
---

## ${ent.Name}Entity

`)

      if (ent.short) {
        Content(`${ent.short}

`)
      }

      if (isGo) {
        Content(`\`\`\`go
${ent.name} := client.${ent.Name}(nil)
\`\`\`

`)
      }
      else {
        Content(`\`\`\`ts
const ${ent.name} = client.${ent.Name}()
\`\`\`

`)
      }


      // Field schema
      if (fields.length > 0) {
        Content(`### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
`)
        each(fields, (field: any) => {
          const req = field.req ? 'Yes' : 'No'
          const desc = field.short || ''
          Content(`| \`${field.name}\` | \`${field.type || 'any'}\` | ${req} | ${desc} |
`)
        })

        Content(`
`)

        // Field operations breakdown
        const hasFieldOps = fields.some((f: any) => f.op && Object.keys(f.op).length > 0)
        if (hasFieldOps) {
          Content(`### Field Usage by Operation

| Field | load | list | create | update | remove |
| --- | --- | --- | --- | --- | --- |
`)
          each(fields, (field: any) => {
            const fops = field.op || {}
            const cols = ['load', 'list', 'create', 'update', 'remove'].map((op: string) => {
              if (!opnames.includes(op)) return '-'
              const fop = fops[op]
              if (null == fop) return '-'
              if (fop.active === false) return '-'
              return 'Yes'
            })
            Content(`| \`${field.name}\` | ${cols.join(' | ')} |
`)
          })

          Content(`
`)
        }
      }


      // Operation details
      if (opnames.length > 0) {
        Content(`### Operations

`)

        opnames.map((opname: string) => {
          const info = OP_SIGNATURES[opname]
          if (!info) return

          Content(`#### \`${info.sig}\`

${info.desc}

`)

          // Show example
          if (isGo) {
            if ('load' === opname || 'remove' === opname) {
              const goOpName = opname.charAt(0).toUpperCase() + opname.slice(1)
              Content(`\`\`\`go
result, err := client.${ent.Name}(nil).${goOpName}(map[string]any{"id": "${ent.name}_id"}, nil)
\`\`\`

`)
            }
            else if ('list' === opname) {
              Content(`\`\`\`go
results, err := client.${ent.Name}(nil).List(nil, nil)
\`\`\`

`)
            }
            else if ('create' === opname) {
              Content(`\`\`\`go
result, err := client.${ent.Name}(nil).Create(map[string]any{
`)
              each(fields, (field: any) => {
                if ('id' !== field.name && field.req) {
                  Content(`    "${field.name}": /* ${field.type || 'value'} */,
`)
                }
              })
              Content(`}, nil)
\`\`\`

`)
            }
            else if ('update' === opname) {
              Content(`\`\`\`go
result, err := client.${ent.Name}(nil).Update(map[string]any{
    "id": "${ent.name}_id",
    // Fields to update
}, nil)
\`\`\`

`)
            }
          }
          else {
            if ('load' === opname || 'remove' === opname) {
              Content(`\`\`\`ts
const result = await client.${ent.Name}().${opname}({ id: '${ent.name}_id' })
\`\`\`

`)
            }
            else if ('list' === opname) {
              Content(`\`\`\`ts
const results = await client.${ent.Name}().${opname}()
\`\`\`

`)
            }
            else if ('create' === opname) {
              Content(`\`\`\`ts
const result = await client.${ent.Name}().create({
`)
              each(fields, (field: any) => {
                if ('id' !== field.name && field.req) {
                  Content(`  ${field.name}: /* ${field.type || 'value'} */,
`)
                }
              })
              Content(`})
\`\`\`

`)
            }
            else if ('update' === opname) {
              Content(`\`\`\`ts
const result = await client.${ent.Name}().update({
  id: '${ent.name}_id',
  // Fields to update
})
\`\`\`

`)
            }
          }
        })
      }


      // Common methods
      if (isGo) {
        Content(`### Common Methods

#### \`Data(args ...any) any\`

Get or set the entity data. When called with data, sets the entity's
internal data and returns the current data. When called without
arguments, returns a copy of the current data.

#### \`Match(args ...any) any\`

Get or set the entity match criteria. Works the same as \`Data()\`.

#### \`Make() Entity\`

Create a new \`${ent.Name}Entity\` instance with the same client and
options.

#### \`GetName() string\`

Return the entity name.

`)
      }
      else {
        Content(`### Common Methods

#### \`data(data?: object)\`

Get or set the entity data. When called with data, sets the entity's
internal data and returns the current data. When called without
arguments, returns a copy of the current data.

#### \`match(match?: object)\`

Get or set the entity match criteria. Works the same as \`data()\`.

#### \`make()\`

Create a new \`${ent.Name}Entity\` instance with the same client and
options.

#### \`client()\`

Return the parent \`${model.Name}SDK\` instance.

#### \`entopts()\`

Return a copy of the entity options.

`)
      }
    })


    // Features section
    const activeFeatures = each(feature).filter((f: any) => f.active)
    if (activeFeatures.length > 0) {
      Content(`
---

## Features

| Feature | Version | Description |
| --- | --- | --- |
`)

      activeFeatures.map((f: any) => {
        Content(`| \`${f.name}\` | ${f.version || '0.0.1'} | ${f.title || ''} |
`)
      })

      Content(`

Features are activated via the \`feature\` option:

`)

      if (isGo) {
        Content(`\`\`\`go
client := sdk.New${model.const.Name}SDK(map[string]any{
    "feature": map[string]any{
`)
        activeFeatures.map((f: any) => {
          Content(`        "${f.name}": map[string]any{"active": true},
`)
        })
        Content(`    },
})
\`\`\`

`)
      }
      else {
        Content(`\`\`\`ts
const client = new ${model.Name}SDK({
  feature: {
`)
        activeFeatures.map((f: any) => {
          Content(`    ${f.name}: { active: true },
`)
        })
        Content(`  }
})
\`\`\`

`)
      }
    }

  })
})


export {
  ReadmeRef
}
