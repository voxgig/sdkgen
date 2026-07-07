
import { cmp, Content, entityIdField, entityPrimaryOp, opRequestShape, safeVarName } from '@voxgig/sdkgen'

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
    // Drive the test-mode example off the entity's PRIMARY op (never a
    // hardcoded `load` a create-only entity lacks).
    const primaryOp = entityPrimaryOp(exampleEntity) || 'load'
    // A list() result is an array — name the variable accordingly.
    const eVar = safeVarName(eName.toLowerCase(), 'ts') +
      ('list' === primaryOp ? 's' : '')
    const primaryOpDef = exampleEntity.op && exampleEntity.op[primaryOp]
    const idF = entityIdField(exampleEntity)
    let arg = ''
    if ('load' === primaryOp || 'remove' === primaryOp) {
      // Every REQUIRED match key (id first) — the same shape that generates
      // the op's Match type, so the block type-checks.
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      arg = 0 < items.length
        ? `{ ${items.map((it: any) =>
          `${it.name}: ${exampleValue(exampleEntity, primaryOpDef, it.name,
            it.name === idF ? 'test01' : 'example_' + it.name)}`).join(', ')} }`
        : ''
    } else if ('create' === primaryOp || 'update' === primaryOp) {
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => it.name !== idF && it.name !== 'id')
      const required = items.filter((it: any) => !it.optional)
      const chosen = required.length ? required : items.slice(0, 3)
      arg = `{ ${chosen.map((it: any) =>
        `${it.name}: ${exampleValue(exampleEntity, primaryOpDef, it.name, 'example_' + it.name)}`).join(', ')} }`
    }
    Content(`const ${eVar} = await client.${eName}().${primaryOp}(${arg})
// ${eVar} is ${'list' === primaryOp ? `an array of bare ${eName} records` : `a bare ${eName}`} populated with mock data
console.log(${eVar})
`)
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopTest
}
