
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

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const ename = eName.toLowerCase()
    // Model-driven id key: null when the entity has no id-like field, so the
    // seeded record carries no id and the load takes no match argument.
    const idF = entityIdField(exampleEntity)
    const recBody = idF ? `{ "${idF}" => "test01" }` : '{}'
    const loadArg = idF ? `{ "${idF}" => "test01" }` : ''
    Content(`\`\`\`ruby
# Seed fixture data so offline calls resolve without a live server.
client = ${model.const.Name}SDK.test({
  "entity" => { "${ename}" => { "test01" => ${recBody} } },
})
${ename} = client.${eName}.load(${loadArg})
\`\`\`
`)
  } else {
    Content(`\`\`\`ruby
client = ${model.const.Name}SDK.test
\`\`\`
`)
  }

})


export {
  ReadmeTopTest
}
