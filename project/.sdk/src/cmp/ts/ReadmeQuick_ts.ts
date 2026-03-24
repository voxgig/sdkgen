
import { cmp, each, Content } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  // Find the first published entity for examples
  const exampleEntity = Object.values(entity).find((e: any) => e.publish) as any

  Content(`
### Create a Client

\`\`\`ts
import { ${model.const.Name}SDK } from '${target.module.name}'

const client = new ${model.const.Name}SDK({
  apikey: process.env.${model.NAME}_APIKEY,
})
\`\`\`
`)


  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('load')) {
      Content(`
### Load a ${eName}

\`\`\`ts
const ${exampleEntity.name} = await client.${eName}().load({ id: '${exampleEntity.name}_id' })
console.log(${exampleEntity.name})
\`\`\`
`)
    }

    if (opnames.includes('list')) {
      Content(`
### List ${eName} Records

\`\`\`ts
const ${exampleEntity.name}s = await client.${eName}().list()
console.log(${exampleEntity.name}s)
\`\`\`
`)
    }

    if (opnames.includes('create')) {
      Content(`
### Create a ${eName}

\`\`\`ts
const created = await client.${eName}().create({
  // Provide ${exampleEntity.name} fields
})
console.log(created)
\`\`\`
`)
    }

    if (opnames.includes('update')) {
      Content(`
### Update a ${eName}

\`\`\`ts
const updated = await client.${eName}().update({
  id: '${exampleEntity.name}_id',
  // Fields to update
})
console.log(updated)
\`\`\`
`)
    }

    if (opnames.includes('remove')) {
      Content(`
### Remove a ${eName}

\`\`\`ts
await client.${eName}().remove({ id: '${exampleEntity.name}_id' })
\`\`\`
`)
    }
  }


  Content(`
### Direct API Access

Use \`client.direct()\` to call any API endpoint directly:

\`\`\`ts
const result = await client.direct({
  path: '/custom/endpoint/{id}',
  method: 'GET',
  params: { id: 'abc123' },
})

if (result.ok) {
  console.log(result.data)
}
\`\`\`

`)

})


export {
  ReadmeQuick
}
