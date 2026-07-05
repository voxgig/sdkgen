
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
//      follow the entity-op convention — in the throwing languages it
//      returns an error value instead.
//
// Each entry below captures both, parameterised by the real example
// entity name so the snippets never reference a phantom entity. Targets
// not listed here (ts, js, ...) use DEFAULT_LANG.
type LangErrors = {
  // prose + snippet for the entity-op convention
  entity: (eName: string, eLower: string) => string
  // prose + snippet for the direct()/prepare() convention
  direct: string
}


const DEFAULT_LANG: LangErrors = {
  entity: (eName, eLower) => `Entity operations reject on failure, so wrap them in \`try\` / \`catch\`:

\`\`\`ts
try {
  const ${eLower} = await client.${eName}().load({ id: 'example_id' })
  console.log(${eLower})
} catch (err) {
  console.error('load failed:', err)
}
\`\`\`

`,
  direct: `The low-level \`direct()\` method does **not** throw — it returns an
\`Error\` value instead, so check the result before using it:

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
    entity: (eName, eLower) => `Entity operations raise on failure, so wrap them in \`try\` / \`except\`:

\`\`\`python
try:
    ${eLower} = client.${eName}().load({"id": "example_id"})
    print(${eLower})
except Exception as err:
    print(f"load failed: {err}")
\`\`\`

`,
    direct: `\`direct()\` does **not** raise — it returns a result dict with an
\`err\` key instead:

\`\`\`python
result = client.direct({
    "path": "/api/resource/{id}",
    "method": "GET",
    "params": {"id": "example_id"},
})

if result["err"]:
    print(result["err"])
\`\`\`

`,
  },

  php: {
    entity: (eName, eLower) => `Entity operations throw a \`\\Throwable\` on failure, so wrap them in
\`try\` / \`catch\`:

\`\`\`php
try {
    $${eLower} = $client->${eName}()->load(["id" => "example_id"]);
} catch (\\Throwable $err) {
    echo "Error: " . $err->getMessage();
}
\`\`\`

`,
    direct: `\`direct()\` does **not** throw — it returns a result array with an
\`err\` key instead:

\`\`\`php
$result = $client->direct([
    "path" => "/api/resource/{id}",
    "method" => "GET",
    "params" => ["id" => "example_id"],
]);

if ($result["err"] !== null) {
    echo $result["err"]->getMessage();
}
\`\`\`

`,
  },

  rb: {
    entity: (eName, eLower) => `Entity operations raise on failure, so rescue them:

\`\`\`ruby
begin
  ${eLower} = client.${eName}.load({ "id" => "example_id" })
rescue => err
  warn "load failed: #{err}"
end
\`\`\`

`,
    direct: `\`direct\` does **not** raise — it returns a result hash with an
\`err\` key instead:

\`\`\`ruby
result = client.direct({
  "path" => "/api/resource/{id}",
  "method" => "GET",
  "params" => { "id" => "example_id" },
})

warn result["err"] if result["err"]
\`\`\`

`,
  },

  lua: {
    entity: (eName, eLower) => `Entity operations return \`(value, err)\`. Check \`err\` before using
the value:

\`\`\`lua
local ${eLower}, err = client:${eName}():load({ id = "example_id" })
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
    entity: (eName, eLower) => `Every entity operation returns \`(value, error)\`. Check \`err\` before
using the value — there is no exception to catch:

\`\`\`go
${eLower}, err := client.${eName}(nil).Load(map[string]any{"id": "example_id"}, nil)
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
}, nil)
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

  Content(`
## Error handling

`)

  Content(lang.entity(eName, eLower))

  Content(lang.direct)
})


export {
  ReadmeErrors
}
