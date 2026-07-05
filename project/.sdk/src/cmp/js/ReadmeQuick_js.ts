
import { cmp, each, Content, isAuthActive, packageName, envName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { exampleValue } from './utility_js'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  // Find the first published entity for examples
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const ctor = isAuthActive(model)
    ? `new ${model.const.Name}SDK({\n  apikey: process.env.${envName(model)}_APIKEY,\n})`
    : `new ${model.const.Name}SDK()`

  Content(`
### Create a Client

\`\`\`js
const { ${model.const.Name}SDK } = require('${packageName(model, target.name)}')

const client = ${ctor}
\`\`\`
`)


  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const article = /^[aeiou]/i.test(eName) ? 'an' : 'a'
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('load')) {
      Content(`
### Load ${article} ${eName}

\`\`\`js
const ${exampleEntity.name} = await client.${eName}().load({ id: ${exampleValue(exampleEntity, exampleEntity.op && exampleEntity.op.load, 'id', exampleEntity.name + '_id')} })
console.log(${exampleEntity.name})
\`\`\`
`)
    }

    if (opnames.includes('list')) {
      Content(`
### List ${eName} Records

\`\`\`js
const ${exampleEntity.name}s = await client.${eName}().list()
for (const ${exampleEntity.name} of ${exampleEntity.name}s) {
  console.log(${exampleEntity.name})
}
\`\`\`
`)
    }

    if (opnames.includes('create')) {
      Content(`
### Create a ${eName}

\`\`\`js
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

\`\`\`js
const updated = await client.${eName}().update({
  id: ${exampleValue(exampleEntity, exampleEntity.op && exampleEntity.op.update, 'id', exampleEntity.name + '_id')},
  // Fields to update
})
console.log(updated)
\`\`\`
`)
    }

    if (opnames.includes('remove')) {
      Content(`
### Remove a ${eName}

\`\`\`js
await client.${eName}().remove({ id: ${exampleValue(exampleEntity, exampleEntity.op && exampleEntity.op.remove, 'id', exampleEntity.name + '_id')} })
\`\`\`
`)
    }
  }


  Content(`
### Direct API Access

Use \`client.direct()\` to call any API endpoint directly:

\`\`\`js
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
