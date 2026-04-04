
import { cmp, each, Content } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'


const OP_DESC: Record<string, { method: string, goMethod: string, desc: string }> = {
  load: { method: 'load(match)', goMethod: 'Load(match, ctrl)', desc: 'Load a single entity by match criteria.' },
  list: { method: 'list(match)', goMethod: 'List(match, ctrl)', desc: 'List entities matching the criteria.' },
  create: { method: 'create(data)', goMethod: 'Create(data, ctrl)', desc: 'Create a new entity with the given data.' },
  update: { method: 'update(data)', goMethod: 'Update(data, ctrl)', desc: 'Update an existing entity.' },
  remove: { method: 'remove(match)', goMethod: 'Remove(match, ctrl)', desc: 'Remove the matching entity.' },
}


const ReadmeEntity = cmp(function ReadmeEntity(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const isGo = target.name === 'go'
  const lang = isGo ? 'go' : 'ts'

  const publishedEntities = each(entity)
    .filter((entity: any) => entity.publish)

  if (0 === publishedEntities.length) {
    return
  }

  Content(`

## Entities

`)

  publishedEntities.map((entity: any) => {
    const opnames = Object.keys(entity.op || {})
    const fields = entity.field || []

    Content(`
### ${entity.Name}

`)

    if (entity.short) {
      Content(`${entity.short}

`)
    }

    if (isGo) {
      Content(`Create an instance: \`${entity.name} := client.${entity.Name}(nil)\`

`)
    }
    else {
      Content(`Create an instance: \`const ${entity.name} = client.${entity.Name}()\`

`)
    }

    // Operations table
    if (opnames.length > 0) {
      Content(`#### Operations

| Method | Description |
| --- | --- |
`)
      opnames.map((opname: string) => {
        const info = OP_DESC[opname]
        if (info) {
          const method = isGo ? info.goMethod : info.method
          Content(`| \`${method}\` | ${info.desc} |
`)
        }
      })

      Content(`
`)
    }

    // Fields table
    if (fields.length > 0) {
      Content(`#### Fields

| Field | Type | Description |
| --- | --- | --- |
`)

      each(fields, (field: any) => {
        const desc = field.short || ''
        Content(`| \`${field.name}\` | \`${field.type || 'any'}\` | ${desc} |
`)
      })

      Content(`
`)
    }

    // Example usage
    if (isGo) {
      if (opnames.includes('load')) {
        Content(`#### Example: Load

\`\`\`go
result, err := client.${entity.Name}(nil).Load(map[string]any{"id": "${entity.name}_id"}, nil)
\`\`\`

`)
      }

      if (opnames.includes('list')) {
        Content(`#### Example: List

\`\`\`go
results, err := client.${entity.Name}(nil).List(nil, nil)
\`\`\`

`)
      }

      if (opnames.includes('create')) {
        Content(`#### Example: Create

\`\`\`go
result, err := client.${entity.Name}(nil).Create(map[string]any{
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
    }
    else {
      if (opnames.includes('load')) {
        Content(`#### Example: Load

\`\`\`ts
const ${entity.name} = await client.${entity.Name}().load({ id: '${entity.name}_id' })
\`\`\`

`)
      }

      if (opnames.includes('list')) {
        Content(`#### Example: List

\`\`\`ts
const ${entity.name}s = await client.${entity.Name}().list()
\`\`\`

`)
      }

      if (opnames.includes('create')) {
        Content(`#### Example: Create

\`\`\`ts
const ${entity.name} = await client.${entity.Name}().create({
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
    }

  })

})



export {
  ReadmeEntity
}
