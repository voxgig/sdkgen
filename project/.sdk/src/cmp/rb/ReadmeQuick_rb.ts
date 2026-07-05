
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
    ? `${model.const.Name}SDK.new({\n  "apikey" => ENV["${envName(model)}_APIKEY"],\n})`
    : `${model.const.Name}SDK.new`

  Content(`### 1. Create a client

\`\`\`ruby
require_relative "${model.const.Name}_sdk"

client = ${ctor}
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

    // Model-driven display field: the entity's first non-id string field
    // (falling back to any non-id field), so the list example prints a real
    // column instead of a hardcoded "name" the entity may not have.
    const fields = exampleEntity.fields || []
    const displayField =
      fields.find((f: any) => f && f.name !== 'id' && f.type === '$STRING') ||
      fields.find((f: any) => f && f.name !== 'id') ||
      null
    const idCol = idF ? `#{item[${JSON.stringify(idF)}]}` : null
    const dispCol = displayField ? `#{item[${JSON.stringify(displayField.name)}]}` : null
    const itemPrint = [idCol, dispCol].filter(Boolean).join(' ') || '#{item}'

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()} records

\`\`\`ruby
begin
  # list returns an Array of ${eName} records — iterate directly.
  ${eName.toLowerCase()}s = client.${eName}.list
  ${eName.toLowerCase()}s.each do |item|
    puts "${itemPrint}"
  end
rescue => err
  warn "list failed: #{err}"
end
\`\`\`

`)
    }

    if (opnames.includes('load')) {
      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`\`\`ruby
begin
  # load returns the bare ${eName} record (raises on error).
  ${eName.toLowerCase()} = client.${eName}.load(${idF ? `{ "${idF}" => "example_id" }` : ''})
  puts ${eName.toLowerCase()}
rescue => err
  warn "load failed: #{err}"
end
\`\`\`

`)
    }

    // Model-driven example fields: derive the create/update body from the op
    // shape (opRequestShape) so the docs reference REAL writable fields, not a
    // hardcoded "name" the entity may not have. Literals are Ruby-typed by the
    // field's canonical type.
    const idField = (exampleEntity.id && exampleEntity.id.field) || 'id'
    const rbLit = (type: any): string => {
      const k = canonKey(type)
      if ('INTEGER' === k || 'NUMBER' === k) return '1'
      if ('BOOLEAN' === k) return 'true'
      if ('ARRAY' === k) return '[]'
      if ('OBJECT' === k) return '{}'
      return '"example"'
    }
    const examplePairs = (opname: string): string[] =>
      opRequestShape(exampleEntity, opname).items
        .filter((it: any) => it.name !== idField && it.name !== 'id')
        .slice(0, 2)
        .map((it: any) => `"${it.name}" => ${rbLit(it.type)}`)

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`ruby
`)
      if (opnames.includes('create')) {
        Content(`# create returns the bare created ${eName} record.
created = client.${eName}.create({ ${examplePairs('create').join(', ')} })

`)
      }
      if (opnames.includes('update')) {
        const updatePairs = (idF ? [`"${idF}" => created["${idF}"]`] : []).concat(examplePairs('update'))
        Content(`# Update${idF ? ` — index the bare record directly (created["${idF}"]).` : ''}
client.${eName}.update({ ${updatePairs.join(', ')} })

`)
      }
      if (opnames.includes('remove')) {
        Content(`# Remove
client.${eName}.remove(${idF ? `{ "${idF}" => created["${idF}"] }` : ''})
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
