
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

  const ctor = isAuthActive(model)
    ? `new ${model.const.Name}SDK([\n    "apikey" => getenv("${envName(model)}_APIKEY"),\n])`
    : `new ${model.const.Name}SDK()`

  Content(`### 1. Create a client

\`\`\`php
<?php
require_once '${model.const.Name.toLowerCase()}_sdk.php';

$client = ${ctor};
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const article = /^[aeiou]/i.test(eName) ? "an" : "a"
    const opnames = Object.keys(exampleEntity.op || {})

    // Model-driven display field: the entity's first non-id string field
    // (falling back to any non-id field), so the list example prints a real
    // column instead of a hardcoded "name" the entity may not have.
    const fields = exampleEntity.fields || []
    const displayField =
      fields.find((f: any) => f && f.name !== 'id' && f.type === '$STRING') ||
      fields.find((f: any) => f && f.name !== 'id') ||
      null
    const itemPrint = displayField
      ? `$item["id"] . " " . $item[${JSON.stringify(displayField.name)}]`
      : `$item["id"]`

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()} records

\`\`\`php
try {
    // list() returns an array of ${eName} records — iterate directly.
    $${eName.toLowerCase()}s = $client->${eName}()->list();
    foreach ($${eName.toLowerCase()}s as $item) {
        echo ${itemPrint} . "\\n";
    }
} catch (\\Throwable $err) {
    echo "Error: " . $err->getMessage();
}
\`\`\`

`)
    }

    if (opnames.includes('load')) {
      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`\`\`php
try {
    // load() returns the bare ${eName} record (throws on error).
    $${eName.toLowerCase()} = $client->${eName}()->load(["id" => "example_id"]);
    print_r($${eName.toLowerCase()});
} catch (\\Throwable $err) {
    echo "Error: " . $err->getMessage();
}
\`\`\`

`)
    }

    // Model-driven example fields: derive the create/update body from the op
    // shape (opRequestShape) so the docs reference REAL writable fields, not a
    // hardcoded "name" the entity may not have. Literals are PHP-typed by the
    // field's canonical type.
    const idField = (exampleEntity.id && exampleEntity.id.field) || 'id'
    const phpLit = (type: any): string => {
      const k = canonKey(type)
      if ('INTEGER' === k || 'NUMBER' === k) return '1'
      if ('BOOLEAN' === k) return 'true'
      if ('ARRAY' === k || 'OBJECT' === k) return '[]'
      return '"example"'
    }
    const examplePairs = (opname: string): string[] =>
      opRequestShape(exampleEntity, opname).items
        .filter((it: any) => it.name !== idField && it.name !== 'id')
        .slice(0, 2)
        .map((it: any) => `"${it.name}" => ${phpLit(it.type)}`)

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`php
`)
      if (opnames.includes('create')) {
        Content(`// create() returns the bare created ${eName} record.
$created = $client->${eName}()->create([${examplePairs('create').join(', ')}]);

`)
      }
      if (opnames.includes('update')) {
        const updatePairs = ['"id" => $created["id"]'].concat(examplePairs('update'))
        Content(`// Update — index the bare record directly ($created["id"]).
$client->${eName}()->update([${updatePairs.join(', ')}]);

`)
      }
      if (opnames.includes('remove')) {
        Content(`// Remove
$client->${eName}()->remove(["id" => $created["id"]]);
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
