
import { cmp, Content, entityIdField } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { exampleValue } from './utility_js'


const ReadmeTopTest = cmp(function ReadmeTopTest(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  Content(`\`\`\`js
const client = ${model.const.Name}SDK.test()
`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    // Model-driven id key: null when the entity has no id-like field, in which
    // case the test-mode load takes no match argument.
    const idF = entityIdField(exampleEntity)
    const loadOp = exampleEntity.op && exampleEntity.op.load
    const loadArg = idF ? `{ ${idF}: ${exampleValue(exampleEntity, loadOp, idF, 'test01')} }` : ''
    Content(`const ${eName.toLowerCase()} = await client.${eName}().load(${loadArg})
// ${eName.toLowerCase()} is a bare entity populated with mock data
console.log(${eName.toLowerCase()})
`)
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopTest
}
