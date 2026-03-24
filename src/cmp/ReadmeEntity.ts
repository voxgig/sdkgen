
import { cmp, each, Content } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'


const OP_DESC: Record<string, { method: string, desc: string }> = {
  load: { method: 'load(match)', desc: 'Load a single entity by match criteria.' },
  list: { method: 'list(match)', desc: 'List entities matching the criteria.' },
  create: { method: 'create(data)', desc: 'Create a new entity with the given data.' },
  update: { method: 'update(data)', desc: 'Update an existing entity.' },
  remove: { method: 'remove(match)', desc: 'Remove the matching entity.' },
}


const ReadmeEntity = cmp(function ReadmeEntity(props: any) {
  const { ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

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

    Content(`Create an instance: \`const ${entity.name} = client.${entity.Name}()\`

`)

    // Operations table
    if (opnames.length > 0) {
      Content(`#### Operations

| Method | Description |
| --- | --- |
`)
      opnames.map((opname: string) => {
        const info = OP_DESC[opname]
        if (info) {
          Content(`| \`${info.method}\` | ${info.desc} |
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

  })

})



export {
  ReadmeEntity
}
