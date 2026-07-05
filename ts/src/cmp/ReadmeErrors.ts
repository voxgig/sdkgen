
import { cmp, Content } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'


// Error handling is one of the everyday developer tasks, so it gets its
// own user-facing section rather than being buried in the pipeline
// explanation. The convention differs by language in two ways:
//
//   1. Entity operations (load/list/create/update/remove) either THROW
//      (ts, js, py, php, rb) or return an error value (go, lua).
//   2. The low-level `direct()`/`prepare()` escape hatch does NOT always
//      follow the entity-op convention. In go/lua it returns (value, err);
//      in ts/js it returns the value or an `Error`; in py/php/rb it returns
//      the result envelope — branch on `ok`, and read `err` on failure.
//
// Each entry below captures both, parameterised by the real example entity
// name AND a type-correct example id literal (`1` when the id field is
// integer-typed, else a quoted string) so the snippets both reference a real
// entity and type-check. Targets not listed here (ts, js, ...) use DEFAULT_LANG.
type LangErrors = {
  // prose + snippet for the entity-op convention
  entity: (eName: string, eLower: string, idLit: string) => string
  // prose + snippet for the direct()/prepare() convention
  direct: string
}


const DEFAULT_LANG: LangErrors = {
  entity: (eName, eLower, idLit) => `Entity operations reject on failure, so wrap them in \`try\` / \`catch\`:

\`\`\`ts
try {
  const ${eLower} = await client.${eName}().load({ id: ${idLit} })
  console.log(${eLower})
} catch (err) {
  console.error('load failed:', err)
}
\`\`\`

`,
  direct: `The low-level \`direct()\` method does **not** throw — it returns the
value or an \`Error\`, so check the result before using it:

\`\`\`ts
const result = await client.direct({
  path: '/api/resource/{id}',
  method: 'GET',
  params: { id: 'example_id' },
})

if (result instanceof Error) {
  throw result
}
\`\`\`

`,
}


const LANGS: Record<string, LangErrors> = {
  py: {
    entity: (eName, eLower, idLit) => `Entity operations raise on failure, so wrap them in \`try\` / \`except\`:

\`\`\`python
try:
    ${eLower} = client.${eName}().load({"id": ${idLit}})
    print(${eLower})
except Exception as err:
    print(f"load failed: {err}")
\`\`\`

`,
    direct: `\`direct()\` does **not** raise — it returns the result envelope. Branch
on \`ok\`, and read the \`err\` value on failure:

\`\`\`python
result = client.direct({
    "path": "/api/resource/{id}",
    "method": "GET",
    "params": {"id": "example_id"},
})

if not result["ok"]:
    print(result.get("err"))
\`\`\`

`,
  },

  php: {
    entity: (eName, eLower, idLit) => `Entity operations throw a \`\\Throwable\` on failure, so wrap them in
\`try\` / \`catch\`:

\`\`\`php
try {
    $${eLower} = $client->${eName}()->load(["id" => ${idLit}]);
} catch (\\Throwable $err) {
    echo "Error: " . $err->getMessage();
}
\`\`\`

`,
    direct: `\`direct()\` does **not** throw — it returns the result array. Branch on
\`ok\`, and read the \`err\` value on failure:

\`\`\`php
$result = $client->direct([
    "path" => "/api/resource/{id}",
    "method" => "GET",
    "params" => ["id" => "example_id"],
]);

if (! $result["ok"]) {
    echo $result["err"]->getMessage();
}
\`\`\`

`,
  },

  rb: {
    entity: (eName, eLower, idLit) => `Entity operations raise on failure, so rescue them:

\`\`\`ruby
begin
  ${eLower} = client.${eName}.load({ "id" => ${idLit} })
rescue => err
  warn "load failed: #{err}"
end
\`\`\`

`,
    direct: `\`direct\` does **not** raise — it returns the result hash. Branch on
\`ok\`, and read the \`err\` value on failure:

\`\`\`ruby
result = client.direct({
  "path" => "/api/resource/{id}",
  "method" => "GET",
  "params" => { "id" => "example_id" },
})

warn result["err"] unless result["ok"]
\`\`\`

`,
  },

  lua: {
    entity: (eName, eLower, idLit) => `Entity operations return \`(value, err)\`. Check \`err\` before using
the value:

\`\`\`lua
local ${eLower}, err = client:${eName}():load({ id = ${idLit} })
if err then error(err) end
\`\`\`

`,
    direct: `\`direct\` follows the same \`(value, err)\` convention:

\`\`\`lua
local result, err = client:direct({
  path = "/api/resource/{id}",
  method = "GET",
  params = { id = "example_id" },
})
if err then error(err) end
\`\`\`

`,
  },

  go: {
    entity: (eName, eLower, idLit) => `Every entity operation returns \`(value, error)\`. Check \`err\` before
using the value — there is no exception to catch:

\`\`\`go
${eLower}, err := client.${eName}(nil).Load(map[string]any{"id": ${idLit}}, nil)
if err != nil {
    // handle err
    return
}
_ = ${eLower}
\`\`\`

`,
    direct: `\`Direct\` follows the same \`(value, error)\` convention:

\`\`\`go
result, err := client.Direct(map[string]any{
    "path":   "/api/resource/{id}",
    "method": "GET",
    "params": map[string]any{"id": "example_id"},
})
if err != nil {
    // handle err
}
_ = result
\`\`\`

`,
  },
}


const ReadmeErrors = cmp(function ReadmeErrors(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const lang = LANGS[target.name] || DEFAULT_LANG

  // Derive a real example entity from the model (the same way the sibling
  // Readme components do) so the snippet never references a phantom entity.
  const entity = getModelPath(model, `main.${KIT}.entity`, { only_active: false, required: false })
  const ex = Object.values(entity || {}).find((e: any) => e && e.active !== false) as any
  const eName = ex ? (ex.Name || (ex.name[0].toUpperCase() + ex.name.slice(1))) : 'Entity'
  const eLower = eName.toLowerCase()

  // Type-correct example id literal: a numeric literal when the id field is
  // integer-typed (so a typed load-match like `{ id: number }` compiles), else
  // a double-quoted string (valid in every target, incl. Go).
  const flds = ex && ex.fields ? (Array.isArray(ex.fields) ? ex.fields : Object.values(ex.fields)) : []
  const idField: any = flds.find((f: any) => f && f.name === 'id') || {}
  const idLit = /INTEGER|NUMBER/i.test(String(idField.type || '')) ? '1' : '"example_id"'

  Content(`
## Error handling

`)

  Content(lang.entity(eName, eLower, idLit))

  Content(lang.direct)
})


export {
  ReadmeErrors
}
