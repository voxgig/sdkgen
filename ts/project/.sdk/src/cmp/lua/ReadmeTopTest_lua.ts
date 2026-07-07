
import { cmp, Content, canonKey, entityIdField, entityPrimaryOp, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


// A type-correct Lua literal for a field's canonical type.
function luaLit(type: any): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k || 'OBJECT' === k) return '{}'
  return '"example"'
}

function luaKey(name: string): string {
  return /^[A-Za-z_]\w*$/.test(name) ? name : `["${name}"]`
}


const ReadmeTopTest = cmp(function ReadmeTopTest(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  Content(`\`\`\`lua
local client = sdk.test()
`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    // Drive the test-mode example off the entity's PRIMARY op (never a hardcoded
    // `load` a create-only entity lacks).
    const idF = entityIdField(exampleEntity)
    const primaryOp = entityPrimaryOp(exampleEntity) || 'load'
    const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
    let arg = ''
    if (isMatchOp) {
      // Every REQUIRED match key (id first, then parent path params like
      // page_id) — the same shape the runtime resolves path params from.
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      arg = 0 < items.length
        ? `{ ${items.map((it: any) =>
          `${luaKey(it.name)} = ${it.name === idF ? '"test01"' : luaLit(it.type)}`).join(', ')} }`
        : ''
    } else if ('create' === primaryOp || 'update' === primaryOp) {
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => it.name !== idF && it.name !== 'id')
      const required = items.filter((it: any) => !it.optional)
      const chosen = required.length ? required : items.slice(0, 3)
      arg = `{ ${chosen.map((it: any) => `${luaKey(it.name)} = ${luaLit(it.type)}`).join(', ')} }`
    }
    // A list result is an array — name the variable accordingly.
    const rVar = 'list' === primaryOp ? 'results' : 'result'
    Content(`local ${rVar}, err = client:${eName}():${primaryOp}(${arg})
`)
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopTest
}
