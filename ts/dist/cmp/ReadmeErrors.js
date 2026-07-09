"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeErrors = void 0;
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const opShape_1 = require("../helpers/opShape");
const opExample_1 = require("../helpers/opExample");
const naming_1 = require("../helpers/naming");
const DEFAULT_LANG = {
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
};
const LANGS = {
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
};
const ReadmeErrors = (0, jostraca_1.cmp)(function ReadmeErrors(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    const lang = LANGS[target.name] || DEFAULT_LANG;
    // Pick a real example entity WITH a real op (prefer a read op) so the
    // error-handling snippet never references a phantom entity or fabricates a
    // `.load()` on an op-less one (e.g. Cloudsmith's `Abort`). primaryOp is null
    // only when NO entity exposes any op — then the entity example is skipped
    // and only the direct() error handling (which every SDK has) is shown.
    const entity = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.entity`, { only_active: false, required: false });
    const { entity: ex, primaryOp } = (0, opShape_1.pickExampleEntity)(entity || {});
    (0, jostraca_1.Content)(`
## Error handling

`);
    if (ex && primaryOp) {
        const eName = ex.Name || (ex.name[0].toUpperCase() + ex.name.slice(1));
        // Sanitise the variable name against the target's reserved words (a
        // `Delete` entity must not bind `const delete = ...`).
        const eLower = (0, naming_1.safeVarName)(eName.toLowerCase(), target.name);
        const idF = (0, opShape_1.entityIdField)(ex);
        const call = (0, opExample_1.primaryOpCall)(target.name, eName, eLower, primaryOp, idF, ex);
        (0, jostraca_1.Content)(lang.entity(call, primaryOp));
    }
    (0, jostraca_1.Content)(lang.direct);
});
exports.ReadmeErrors = ReadmeErrors;
//# sourceMappingURL=ReadmeErrors.js.map