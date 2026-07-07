
import { cmp, Content, isAuthActive, packageName, envName, entityIdField, safeVarName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { exampleValue } from './utility_js'


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
    const eVar = safeVarName(eName.toLowerCase(), 'js')
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`// List all ${eName.toLowerCase()}s (returns an array)
const ${eVar}s = await client.${eName}().list()
for (const ${eVar} of ${eVar}s) {
  console.log(${eVar})
}
`)
    }

    // Find a nested entity for a more interesting example
    const nestedEntity = Object.values(entity).find((e: any) =>
      e.active !== false && e.ancestors && e.ancestors.length > 0
    ) as any

    if (nestedEntity && opnames.includes('load')) {
      const neName = nom(nestedEntity, 'Name')
      const neVar = safeVarName(neName.toLowerCase(), 'js')
      const parentFields = (nestedEntity.fields || [])
        .filter((f: any) => f.name !== 'id' && f.name.endsWith('_id'))
      const parentParam = parentFields.length > 0 ? parentFields[0].name : 'parent_id'
      const loadOp = nestedEntity.op && nestedEntity.op.load

      // Model-driven id key: only emit an id match line if the nested entity
      // has an id-like key field.
      const neIdF = entityIdField(nestedEntity)
      const neMatchLines = [`  ${parentParam}: ${exampleValue(nestedEntity, loadOp, parentParam, 'example')},`]
      if (neIdF) {
        neMatchLines.push(`  ${neIdF}: ${exampleValue(nestedEntity, loadOp, neIdF, 'example_id')},`)
      }

      Content(`
// Load a specific ${neName.toLowerCase()} (returns the entity)
const ${neVar} = await client.${neName}().load({
${neMatchLines.join('\n')}
})
console.log(${neVar})
`)
    }
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopQuick
}
