"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeErrors = void 0;
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const DEFAULT_LANG = {
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
};
const LANGS = {
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
    (0, jostraca_1.Content)(`
## Error handling

`);
    (0, jostraca_1.Content)(lang.entity(eName, eLower));
    (0, jostraca_1.Content)(lang.direct);
});
exports.ReadmeErrors = ReadmeErrors;
//# sourceMappingURL=ReadmeErrors.js.map