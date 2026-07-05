
import { cmp, each, Content, isAuthActive, packageName, envName, opRequestShape, entityIdField } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { exampleValue } from './utility_ts'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  // Find the first published entity for examples
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  // Find a nested entity if available
  const nestedEntity = Object.values(entity).find((e: any) =>
    e.active !== false && e.ancestors && e.ancestors.length > 0
  ) as any

  const ctor = isAuthActive(model)
    ? `new ${model.const.Name}SDK({\n  apikey: process.env.${envName(model)}_APIKEY,\n})`
    : `new ${model.const.Name}SDK()`

  Content(`### 1. Create a client

\`\`\`ts
import { ${model.const.Name}SDK } from '${packageName(model, target.name)}'

const client = ${ctor}
\`\`\`

`)


  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const article = /^[aeiou]/i.test(eName) ? 'an' : 'a'
    const opnames = Object.keys(exampleEntity.op || {})
    // Model-driven id key: `idF` is the entity's id-like field name, or null
    // when it has none (then load/remove match on no argument, and we never
    // read `.id` off a returned entity — both would fail the typed gate).
    const idF = entityIdField(exampleEntity)

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()} records

\`list()\` resolves to an array of ${eName} objects — iterate it directly:

\`\`\`ts
const ${eName.toLowerCase()}s = await client.${eName}().list()

for (const ${eName.toLowerCase()} of ${eName.toLowerCase()}s) {
  console.log(${eName.toLowerCase()})
}
\`\`\`

`)
    }

    if (nestedEntity) {
      const neName = nom(nestedEntity, 'Name')
      const neArticle = /^[aeiou]/i.test(neName) ? 'an' : 'a'
      const parentFields = (nestedEntity.fields || [])
        .filter((f: any) => f.name !== 'id' && f.name.endsWith('_id'))
      const parentParam = parentFields.length > 0 ? parentFields[0].name : 'parent_id'
      const loadOp = nestedEntity.op && nestedEntity.op.load

      // Model-driven id key: only emit an id match line if this nested entity
      // actually has an id-like key field (some response-wrapped specs do not).
      const neIdF = entityIdField(nestedEntity)
      const neMatchLines = [`    ${parentParam}: ${exampleValue(nestedEntity, loadOp, parentParam, 'example')},`]
      if (neIdF) {
        neMatchLines.push(`    ${neIdF}: ${exampleValue(nestedEntity, loadOp, neIdF, 'example_id')},`)
      }

      Content(`### 3. Load ${neArticle} ${neName.toLowerCase()}

${neName} is nested under ${eName}, so provide the \`${parentParam}\`.
\`load()\` returns the entity directly and throws on failure:

\`\`\`ts
try {
  const ${neName.toLowerCase()} = await client.${neName}().load({
${neMatchLines.join('\n')}
  })
  console.log(${neName.toLowerCase()})
} catch (err) {
  console.error('load failed:', err)
}
\`\`\`

`)
    }
    else if (opnames.includes('load')) {
      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`load()\` returns the entity directly and throws on failure:

\`\`\`ts
try {
  const ${eName.toLowerCase()} = await client.${eName}().load(${idF ? `{ ${idF}: ${exampleValue(exampleEntity, exampleEntity.op && exampleEntity.op.load, idF, 'example_id')} }` : ''})
  console.log(${eName.toLowerCase()})
} catch (err) {
  console.error('load failed:', err)
}
\`\`\`

`)
    }

    // CRUD operations. The create/update example payloads are derived from the
    // SAME op shapes that generate the <Name>CreateData / <Name>UpdateData types
    // (opRequestShape), so the snippet always type-checks. Prefer writable
    // non-id fields and render a type-correct literal per field via
    // exampleValue — never a hardcoded field the entity may not have.
    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      const exampleFields = (opname: string): string[] =>
        opRequestShape(exampleEntity, opname).items
          .filter((it: any) => it.name !== idF && it.name !== 'id')
          .slice(0, 2)
          .map((it: any) =>
            `  ${it.name}: ${exampleValue(exampleEntity, exampleEntity.op[opname], it.name, 'example_' + it.name)},`)

      Content(`### 4. Create, update, and remove

\`\`\`ts
`)
      if (opnames.includes('create')) {
        const createLines = exampleFields('create')
        const createBody = createLines.length ? '\n' + createLines.join('\n') + '\n' : ''
        Content(`// Create — returns the created ${eName}
const created = await client.${eName}().create({${createBody}})

`)
      }
      if (opnames.includes('update')) {
        // The id comes straight off the returned entity. Entity fields are
        // optional under the typed-partiality model, so id is `number |
        // undefined`; after a successful create it is present, hence the
        // non-null assertion required by the `number` match type. When the
        // entity has no id-like key (idF === null) the update degrades to the
        // writable fields only — the match type is all-optional.
        const updateLines = (idF ? [`  ${idF}: created.${idF}!,`] : []).concat(exampleFields('update'))
        const updateBody = updateLines.length ? '\n' + updateLines.join('\n') + '\n' : ''
        Content(`// Update${idF ? ' — the id comes straight off the returned entity' : ''}
const updated = await client.${eName}().update({${updateBody}})

`)
      }
      if (opnames.includes('remove')) {
        Content(`// Remove
await client.${eName}().remove(${idF ? `{\n  ${idF}: created.${idF}!,\n}` : ''})
`)
      }
      Content(`\`\`\`

`)
    }
  }

})


export {
  ReadmeQuick
}
