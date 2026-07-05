
import { cmp, Content } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { exampleValue } from './utility_ts'


const ReadmeTopTest = cmp(function ReadmeTopTest(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  Content(`\`\`\`ts
const client = ${model.const.Name}SDK.test()
`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const idName = (exampleEntity.id && exampleEntity.id.field) || 'id'
    const loadOp = exampleEntity.op && exampleEntity.op.load
    Content(`const ${eName.toLowerCase()} = await client.${eName}().load({ ${idName}: ${exampleValue(exampleEntity, loadOp, idName, 'test01')} })
// ${eName.toLowerCase()} is a bare ${eName} populated with mock data
console.log(${eName.toLowerCase()})
`)
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopTest
}
