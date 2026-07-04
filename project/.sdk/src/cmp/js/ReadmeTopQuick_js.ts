
import { cmp, Content, canonKey, isAuthActive, packageName, envName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


// Match the reference (ts) example values by canon type: numbers render
// bare, booleans as `true`, everything else as a quoted placeholder.
function litForField(entity: any, fieldName: string, placeholder: string): string {
  const f = (entity.fields || []).find((x: any) => x.name === fieldName)
  const key = canonKey(f && f.type)
  if ('INTEGER' === key || 'NUMBER' === key) return '1'
  if ('BOOLEAN' === key) return 'true'
  return `'${placeholder}'`
}


const ReadmeTopQuick = cmp(function ReadmeTopQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const ctor = isAuthActive(model)
    ? `new ${model.const.Name}SDK({\n  apikey: process.env.${envName(model)}_APIKEY,\n})`
    : `new ${model.const.Name}SDK()`

  Content(`\`\`\`js
const { ${model.const.Name}SDK } = require('${packageName(model, target.name)}')

const client = ${ctor}

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`// List all ${eName.toLowerCase()}s (returns an array)
const ${eName.toLowerCase()}s = await client.${eName}().list()
for (const ${eName.toLowerCase()} of ${eName.toLowerCase()}s) {
  console.log(${eName.toLowerCase()})
}
`)
    }

    // Find a nested entity for a more interesting example
    const nestedEntity = Object.values(entity).find((e: any) =>
      e.active !== false && e.ancestors && e.ancestors.length > 0
    ) as any

    if (nestedEntity && opnames.includes('load')) {
      const neName = nom(nestedEntity, 'Name')
      const parentFields = (nestedEntity.fields || [])
        .filter((f: any) => f.name !== 'id' && f.name.endsWith('_id'))
      const parentParam = parentFields.length > 0 ? parentFields[0].name : 'parent_id'

      Content(`
// Load a specific ${neName.toLowerCase()} (returns the entity)
const ${neName.toLowerCase()} = await client.${neName}().load({
  ${parentParam}: ${litForField(nestedEntity, parentParam, 'example')},
  id: ${litForField(nestedEntity, 'id', 'example_id')},
})
console.log(${neName.toLowerCase()})
`)
    }
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopQuick
}
