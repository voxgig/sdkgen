"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeErrors = void 0;
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const opShape_1 = require("../helpers/opShape");
const DEFAULT_LANG = {
    entity: (eName, eLower, idLit, idF) => `Entity operations reject on failure, so wrap them in \`try\` / \`catch\`:

\`\`\`ts
try {
  const ${eLower} = await client.${eName}().load(${idF ? `{ ${idF}: ${idLit} }` : ''})
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
};
const LANGS = {
    py: {
        entity: (eName, eLower, idLit, idF) => `Entity operations raise on failure, so wrap them in \`try\` / \`except\`:

\`\`\`python
try:
    ${eLower} = client.${eName}().load(${idF ? `{"${idF}": ${idLit}}` : ''})
    print(${eLower})
except Exception as err:
    print(f"load failed: {err}")
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
        entity: (eName, eLower, idLit, idF) => `Entity operations throw a \`\\Throwable\` on failure, so wrap them in
\`try\` / \`catch\`:

\`\`\`php
try {
    $${eLower} = $client->${eName}()->load(${idF ? `["${idF}" => ${idLit}]` : ''});
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
        entity: (eName, eLower, idLit, idF) => `Entity operations raise on failure, so rescue them:

\`\`\`ruby
begin
  ${eLower} = client.${eName}.load(${idF ? `{ "${idF}" => ${idLit} }` : ''})
rescue => err
  warn "load failed: #{err}"
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
        entity: (eName, eLower, idLit, idF) => `Entity operations return \`(value, err)\`. Check \`err\` before using
the value:

\`\`\`lua
local ${eLower}, err = client:${eName}():load(${idF ? `{ ${idF} = ${idLit} }` : ''})
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
        entity: (eName, eLower, idLit, idF) => `Every entity operation returns \`(value, error)\`. Check \`err\` before
using the value — there is no exception to catch:

\`\`\`go
${eLower}, err := client.${eName}(nil).Load(${idF ? `map[string]any{"${idF}": ${idLit}}` : 'nil'}, nil)
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
};
const ReadmeErrors = (0, jostraca_1.cmp)(function ReadmeErrors(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    const lang = LANGS[target.name] || DEFAULT_LANG;
    // Derive a real example entity from the model (the same way the sibling
    // Readme components do) so the snippet never references a phantom entity.
    const entity = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.entity`, { only_active: false, required: false });
    const ex = Object.values(entity || {}).find((e) => e && e.active !== false);
    const eName = ex ? (ex.Name || (ex.name[0].toUpperCase() + ex.name.slice(1))) : 'Entity';
    const eLower = eName.toLowerCase();
    // The entity's id-like key field name, or null when it has none (a
    // response-wrapped spec can model an entity with no id). Drives whether the
    // load example keys on an id at all.
    const idF = (0, opShape_1.entityIdField)(ex);
    // Type-correct example id literal: a numeric literal when the id field is
    // integer-typed (so a typed load-match like `{ id: number }` compiles), else
    // a double-quoted string (valid in every target, incl. Go).
    const flds = ex && ex.fields ? (Array.isArray(ex.fields) ? ex.fields : Object.values(ex.fields)) : [];
    const idField = flds.find((f) => f && f.name === (idF || 'id')) || {};
    const idLit = /INTEGER|NUMBER/i.test(String(idField.type || '')) ? '1' : '"example_id"';
    (0, jostraca_1.Content)(`
## Error handling

`);
    (0, jostraca_1.Content)(lang.entity(eName, eLower, idLit, idF));
    (0, jostraca_1.Content)(lang.direct);
});
exports.ReadmeErrors = ReadmeErrors;
//# sourceMappingURL=ReadmeErrors.js.map