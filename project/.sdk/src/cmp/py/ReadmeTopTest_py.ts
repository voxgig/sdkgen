
import { cmp, Content, entityIdField } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeTopTest = cmp(function ReadmeTopTest(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  Content(`\`\`\`python
client = ${model.const.Name}SDK.test()
`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    // Model-driven id key: null when the entity has no id-like field, so the
    // test-mode load takes no match argument.
    const idF = entityIdField(exampleEntity)
    Content(`${eName.toLowerCase()} = client.${eName}().load(${idF ? `{"${idF}": "test01"}` : ''})
print(${eName.toLowerCase()})
`)
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopTest
}
