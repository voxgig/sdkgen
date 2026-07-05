
import { cmp, each, Content, isAuthActive, envName, canonKey, opRequestShape, entityIdField } from '@voxgig/sdkgen'

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

  const ctor = isAuthActive(model)
    ? `sdk.new({\n  apikey = os.getenv("${envName(model)}_APIKEY"),\n})`
    : `sdk.new()`

  Content(`### 1. Create a client

\`\`\`lua
local sdk = require("${model.name}_sdk")

local client = ${ctor}
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const article = /^[aeiou]/i.test(eName) ? "an" : "a"
    const opnames = Object.keys(exampleEntity.op || {})
    // Model-driven id key: null when the entity has no id-like field (a
    // response-wrapped spec). When null, load/remove take no argument and no
    // record id is read off a returned record.
    const idF = entityIdField(exampleEntity)

    // MODEL-DRIVEN display field: the list example must reference a field
    // the entity actually has, not a hardcoded "name". Pick the entity's
    // first non-id string field (falling back to the first non-id field of
    // any type). The id key stays `id` — the SDK renames every id param to
    // `id`, matching the load example and the seeded test fixture.
    const idNames = new Set<string>(['id',
      (exampleEntity.id && exampleEntity.id.field) || 'id'])
    const fields: any[] = Array.isArray(exampleEntity.fields) ? exampleEntity.fields : []
    const isStringField = (f: any) =>
      f && typeof f.type === 'string' && /STRING/i.test(f.type)
    const displayFieldObj =
      fields.find((f: any) => f && !idNames.has(f.name) && isStringField(f)) ||
      fields.find((f: any) => f && !idNames.has(f.name))
    const displayField = displayFieldObj ? displayFieldObj.name : null
    const idCol = idF ? `item["${idF}"]` : null
    const dispCol = displayField ? `item["${displayField}"]` : null
    const printCols = [idCol, dispCol].filter(Boolean).join(', ')
    const printLine = printCols ? `  print(${printCols})` : `  print(item)`

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()} records

Entity operations return \`(value, err)\`. For \`list\`, \`value\` is the
array of records itself — iterate it directly (there is no wrapper).

\`\`\`lua
local ${eName.toLowerCase()}s, err = client:${eName}():list()
if err then error(err) end

for _, item in ipairs(${eName.toLowerCase()}s) do
${printLine}
end
\`\`\`

`)
    }

    if (opnames.includes('load')) {
      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`\`\`lua
local ${eName.toLowerCase()}, err = client:${eName}():load(${idF ? `{ ${idF} = "example_id" }` : ''})
if err then error(err) end
print(${eName.toLowerCase()})
\`\`\`

`)
    }

    // Model-driven example fields: derive the create/update body from the op
    // shape (opRequestShape) so the docs reference REAL writable fields, not a
    // hardcoded "name" the entity may not have. Literals are Lua-typed by the
    // field's canonical type; non-identifier keys use bracket syntax.
    const luaLit = (type: any): string => {
      const k = canonKey(type)
      if ('INTEGER' === k || 'NUMBER' === k) return '1'
      if ('BOOLEAN' === k) return 'true'
      if ('ARRAY' === k || 'OBJECT' === k) return '{}'
      return '"example"'
    }
    const luaKey = (name: string): string =>
      /^[A-Za-z_]\w*$/.test(name) ? name : `["${name}"]`
    const examplePairs = (opname: string): string[] =>
      opRequestShape(exampleEntity, opname).items
        .filter((it: any) => !idNames.has(it.name))
        .slice(0, 2)
        .map((it: any) => `${luaKey(it.name)} = ${luaLit(it.type)}`)

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`lua
`)
      if (opnames.includes('create')) {
        Content(`-- Create
local created, err = client:${eName}():create({ ${examplePairs('create').join(', ')} })
if err then error(err) end

`)
      }
      if (opnames.includes('update')) {
        const updatePairs = (idF ? [`${idF} = created["${idF}"]`] : []).concat(examplePairs('update'))
        Content(`-- Update
client:${eName}():update({ ${updatePairs.join(', ')} })

`)
      }
      if (opnames.includes('remove')) {
        Content(`-- Remove
client:${eName}():remove(${idF ? `{ ${idF} = created["${idF}"] }` : ''})
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
