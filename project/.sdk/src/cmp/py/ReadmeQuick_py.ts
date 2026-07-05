
import { cmp, each, Content, isAuthActive, envName, canonKey, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any
  const nestedEntity = Object.values(entity).find((e: any) =>
    e.active !== false && e.ancestors && e.ancestors.length > 0
  ) as any

  const authActive = isAuthActive(model)
  const apikeyImport = authActive ? `import os\n` : ''
  const ctor = authActive
    ? `${model.const.Name}SDK({\n    "apikey": os.environ.get("${envName(model)}_APIKEY"),\n})`
    : `${model.const.Name}SDK()`

  Content(`### 1. Create a client

\`\`\`python
${apikeyImport}from ${model.const.Name.toLowerCase()}_sdk import ${model.const.Name}SDK

client = ${ctor}
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const article = /^[aeiou]/i.test(eName) ? 'an' : 'a'
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()} records

\`list()\` returns a \`list\` of records (each a \`dict\`) and raises on
error — iterate it directly.

\`\`\`python
try:
    ${eName.toLowerCase()}s = client.${eName}().list()
    for ${eName.toLowerCase()} in ${eName.toLowerCase()}s:
        print(${eName.toLowerCase()})
except Exception as err:
    print(f"list failed: {err}")
\`\`\`

`)
    }

    if (opnames.includes('load')) {
      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`load()\` returns the bare record (a \`dict\`) and raises on error.

\`\`\`python
try:
    ${eName.toLowerCase()} = client.${eName}().load({"id": "example_id"})
    print(${eName.toLowerCase()})
except Exception as err:
    print(f"load failed: {err}")
\`\`\`

`)
    }

    // Model-driven example fields: derive the create/update body from the op
    // shape (opRequestShape) so the docs reference REAL writable fields, not a
    // hardcoded "name" the entity may not have. Literals are Python-typed by
    // the field's canonical type.
    const idField = (exampleEntity.id && exampleEntity.id.field) || 'id'
    const pyLit = (type: any): string => {
      const k = canonKey(type)
      if ('INTEGER' === k || 'NUMBER' === k) return '1'
      if ('BOOLEAN' === k) return 'True'
      if ('ARRAY' === k) return '[]'
      if ('OBJECT' === k) return '{}'
      return '"example"'
    }
    const examplePairs = (opname: string): string[] =>
      opRequestShape(exampleEntity, opname).items
        .filter((it: any) => it.name !== idField && it.name !== 'id')
        .slice(0, 2)
        .map((it: any) => `"${it.name}": ${pyLit(it.type)}`)

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`python
`)
      if (opnames.includes('create')) {
        Content(`# Create — returns the bare created record (a dict)
created = client.${eName}().create({${examplePairs('create').join(', ')}})

`)
      }
      if (opnames.includes('update')) {
        const updatePairs = ['"id": created["id"]'].concat(examplePairs('update'))
        Content(`# Update — the created record's id is a plain dict key
client.${eName}().update({${updatePairs.join(', ')}})

`)
      }
      if (opnames.includes('remove')) {
        Content(`# Remove
client.${eName}().remove({"id": created["id"]})
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
