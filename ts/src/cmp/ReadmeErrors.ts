
import { cmp, Content } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'

import { entityIdField, pickExampleEntity } from '../helpers/opShape'
import { primaryOpCall } from '../helpers/opExample'
import type { ExampleLang, PrimaryCall } from '../helpers/opExample'
import { safeVarName } from '../helpers/naming'


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
// The entity-op snippet is rendered from the entity's PRIMARY op (never a
// hardcoded `load`, which a create-only entity lacks) with a type-correct
// match id (a numeric id renders `1`, not "example_id"). Targets not listed
// here (ts, js) use DEFAULT_LANG.
type LangErrors = {
  // prose + snippet for the entity-op convention, given the pre-rendered
  // primary-op invocation and its op name.
  entity: (call: PrimaryCall, op: string) => string
  // prose + snippet for the direct()/prepare() convention
  direct: string
}


const DEFAULT_LANG: LangErrors = {
  entity: (call, op) => `Entity operations reject on failure, so wrap them in \`try\` / \`catch\`:

\`\`\`ts
try {
  const ${call.resultVar} = await ${call.expr}
  console.log(${call.resultVar})
} catch (err) {
  console.error('${op} failed:', err)
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
    entity: (call, op) => `Entity operations raise on failure, so wrap them in \`try\` / \`except\`:

\`\`\`python
try:
    ${call.resultVar} = ${call.expr}
    print(${call.resultVar})
except Exception as err:
    print(f"${op} failed: {err}")
\`\`\`

`,
    direct: `\`direct()\` does **not** raise — it returns the result envelope. Branch
on \`ok\`; on failure \`status\` holds the HTTP status (for error responses)
and \`err\` holds a transport error, so read both defensively:

\`\`\`python
result = client.direct({
    "path": "/api/resource/{id}",
    "method": "GET",
    "params": {"id": "example_id"},
})

if not result["ok"]:
    print("request failed:", result.get("status"), result.get("err"))
\`\`\`

`,
  },

  php: {
    entity: (call, op) => `Entity operations throw a \`\\Throwable\` on failure, so wrap them in
\`try\` / \`catch\`:

\`\`\`php
try {
    $${call.resultVar} = ${call.expr};
} catch (\\Throwable $err) {
    echo "Error: " . $err->getMessage();
}
\`\`\`

`,
    direct: `\`direct()\` does **not** throw — it returns the result array. Branch on
\`ok\`; on failure \`status\` holds the HTTP status (for error responses) and
\`err\` holds a transport error, so read both defensively:

\`\`\`php
$result = $client->direct([
    "path" => "/api/resource/{id}",
    "method" => "GET",
    "params" => ["id" => "example_id"],
]);

if (! $result["ok"]) {
    $err = $result["err"] ?? null;
    echo "request failed: " . ($err ? $err->getMessage() : "HTTP " . $result["status"]);
}
\`\`\`

`,
  },

  rb: {
    entity: (call, op) => `Entity operations raise on failure, so rescue them:

\`\`\`ruby
begin
  ${call.resultVar} = ${call.expr}
rescue => err
  warn "${op} failed: #{err}"
end
\`\`\`

`,
    direct: `\`direct\` does **not** raise — it returns the result hash. Branch on
\`ok\`; on failure \`status\` holds the HTTP status (for error responses) and
\`err\` holds a transport error, so read both defensively:

\`\`\`ruby
result = client.direct({
  "path" => "/api/resource/{id}",
  "method" => "GET",
  "params" => { "id" => "example_id" },
})

warn "request failed: #{result["err"] || "HTTP #{result["status"]}"}" unless result["ok"]
\`\`\`

`,
  },

  lua: {
    entity: (call, op) => `Entity operations return \`(value, err)\`. Check \`err\` before using
the value:

\`\`\`lua
local ${call.resultVar}, err = ${call.expr}
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
    entity: (call, op) => `Every entity operation returns \`(value, error)\`. Check \`err\` before
using the value — there is no exception to catch:

\`\`\`go
${call.resultVar}, err := ${call.expr}
if err != nil {
    // handle err
    return
}
_ = ${call.resultVar}
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

  // Pick a real example entity WITH a real op (prefer a read op) so the
  // error-handling snippet never references a phantom entity or fabricates a
  // `.load()` on an op-less one (e.g. Cloudsmith's `Abort`). primaryOp is null
  // only when NO entity exposes any op — then the entity example is skipped
  // and only the direct() error handling (which every SDK has) is shown.
  const entity = getModelPath(model, `main.${KIT}.entity`, { only_active: false, required: false })
  const { entity: ex, primaryOp } = pickExampleEntity(entity || {})

  Content(`
## Error handling

`)

  if (ex && primaryOp) {
    const eName = ex.Name || (ex.name[0].toUpperCase() + ex.name.slice(1))
    // Sanitise the variable name against the target's reserved words (a
    // `Delete` entity must not bind `const delete = ...`).
    const eLower = safeVarName(eName.toLowerCase(), target.name)
    const idF = entityIdField(ex)
    const call = primaryOpCall(target.name as ExampleLang, eName, eLower, primaryOp, idF, ex)
    Content(lang.entity(call, primaryOp))
  }

  Content(lang.direct)
})


export {
  ReadmeErrors
}
