"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeErrors = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const types_1 = require("../types");
const opShape_1 = require("../helpers/opShape");
const opExample_1 = require("../helpers/opExample");
const naming_1 = require("../helpers/naming");
const exampleCall_1 = require("../helpers/exampleCall");
const packageMeta_1 = require("../helpers/packageMeta");
const TS_ENTITY = (fence) => ({ call, op }) => `Entity operations reject on failure, so wrap them in \`try\` / \`catch\`:

\`\`\`${fence}
try {
  const ${call.resultVar} = await ${call.expr}
  console.log(${'list' === op ? call.resultVar + '.map((item) => item.data())' : call.resultVar + '.data()'})
} catch (err) {
  console.error('${op} failed:', err)
}
\`\`\`

`;
const TS_DIRECT = (fence) => (r) => `The low-level \`direct()\` method does **not** throw — it returns the
result envelope. Branch on \`ok\`; on failure \`status\` holds the HTTP status
(for error responses) and \`err\` holds the error:

\`\`\`${fence}
const result = await client.direct({
  path: '${r.path}',
  method: '${r.method}',
  params: { ${(0, naming_1.jsKey)(r.param)}: 'example_id' },
})

if (!result.ok) {
  console.error('request failed:', result.status, result.err)
}
\`\`\`

`;
// The direct() paragraph every row shares, with its own name for the call and for not failing.
function directLead(call, fails, returns) {
    return `\`${call}\` does **not** ${fails} — it
returns ${returns}. Branch on \`ok\`; on failure \`status\` holds the HTTP
status (for error responses) and \`err\` holds a transport error:

`;
}
// A language with no row writes neutral prose and no code.
const DEFAULT_LANG = {
    direct: `The low-level \`direct\` method does not fail on an error response — it
returns the result envelope. Branch on \`ok\`; on failure \`status\` holds the
HTTP status (for error responses) and \`err\` holds the error.

`,
};
const LANGS = {
    py: {
        entity: ({ call, op }) => `Entity operations raise on failure, so wrap them in \`try\` / \`except\`:

\`\`\`python
try:
    ${call.resultVar} = ${call.expr}
    print(${'list' === op ? '[item.data_get() for item in ' + call.resultVar + ']' : call.resultVar + '.data_get()'})
except Exception as err:
    print(f"${op} failed: {err}")
\`\`\`

`,
        direct: (r) => `\`direct()\` does **not** raise — it returns the result envelope. Branch
on \`ok\`; on failure \`status\` holds the HTTP status (for error responses)
and \`err\` holds a transport error, so read both defensively:

\`\`\`python
result = client.direct({
    "path": "${r.path}",
    "method": "${r.method}",
    "params": {"${r.param}": "example_id"},
})

if not result["ok"]:
    print("request failed:", result.get("status"), result.get("err"))
\`\`\`

`,
    },
    php: {
        entity: ({ call, op }) => `Entity operations throw a \`\\Throwable\` on failure, so wrap them in
\`try\` / \`catch\`:

\`\`\`php
try {
    $${call.resultVar} = ${call.expr};
} catch (\\Throwable $err) {
    echo "Error: " . $err->getMessage();
}
\`\`\`

`,
        direct: (r) => `\`direct()\` does **not** throw — it returns the result array. Branch on
\`ok\`; on failure \`status\` holds the HTTP status (for error responses) and
\`err\` holds a transport error, so read both defensively:

\`\`\`php
$result = $client->direct([
    "path" => "${r.path}",
    "method" => "${r.method}",
    "params" => ["${r.param}" => "example_id"],
]);

if (! $result["ok"]) {
    $err = $result["err"] ?? null;
    echo "request failed: " . ($err ? $err->getMessage() : "HTTP " . $result["status"]);
}
\`\`\`

`,
    },
    rb: {
        entity: ({ call, op }) => `Entity operations raise on failure, so rescue them:

\`\`\`ruby
begin
  ${call.resultVar} = ${call.expr}
rescue => err
  warn "${op} failed: #{err}"
end
\`\`\`

`,
        direct: (r) => `\`direct\` does **not** raise — it returns the result hash. Branch on
\`ok\`; on failure \`status\` holds the HTTP status (for error responses) and
\`err\` holds a transport error, so read both defensively:

\`\`\`ruby
result = client.direct({
  "path" => "${r.path}",
  "method" => "${r.method}",
  "params" => { "${r.param}" => "example_id" },
})

warn "request failed: #{result["err"] || "HTTP #{result["status"]}"}" unless result["ok"]
\`\`\`

`,
    },
    lua: {
        entity: ({ call, op }) => `Entity operations return \`(value, err)\`. Check \`err\` before using
the value:

\`\`\`lua
local ${call.resultVar}, err = ${call.expr}
if err then error(err) end
\`\`\`

`,
        direct: (r) => `\`direct\` follows the same \`(value, err)\` convention:

\`\`\`lua
local result, err = client:direct({
  path = "${r.path}",
  method = "${r.method}",
  params = { ${(0, naming_1.luaKey)(r.param)} = "example_id" },
})
if err then error(err) end
\`\`\`

`,
    },
    go: {
        entity: ({ call, op }) => `Every entity operation returns \`(value, error)\`. Check \`err\` before
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
        direct: (r) => `\`Direct\` follows the same \`(value, error)\` convention:

\`\`\`go
result, err := client.Direct(map[string]any{
    "path":   "${r.path}",
    "method": "${r.method}",
    "params": map[string]any{"${r.param}": "example_id"},
})
if err != nil {
    // handle err
}
_ = result
\`\`\`

`,
    },
    ts: {
        entity: TS_ENTITY('ts'),
        direct: TS_DIRECT('ts'),
    },
    js: {
        entity: TS_ENTITY('js'),
        direct: TS_DIRECT('js'),
    },
    c: {
        entity: (x) => {
            const { v, factory, arg } = (0, exampleCall_1.exampleParts)('c', x);
            const call = `${v}->vt->${x.op}(${v}, ${arg}, NULL, &err)`;
            const ok = 'list' === x.op ? `    for (size_t i = 0; ${v}s[i]; i++) {
        printf("%s\\n", voxgig_to_json(${v}s[i]->vt->data(${v}s[i], NULL)));
    }` : `    printf("%s\\n", voxgig_to_json(${v}->vt->data(${v}, NULL)));`;
            return `Entity operations set \`*err\` on failure, so check \`err\` after each call:

\`\`\`c
Entity* ${v} = ${factory};
PNError* err = NULL;
${'list' === x.op ? `Entity** ${v}s = ${call};` : `${call};`}
if (err) {
    fprintf(stderr, "${x.op} failed: %s\\n", err->msg);
} else {
${ok}
}
\`\`\`

`;
        },
        direct: (r) => directLead('sdk_direct()', 'set `*err` for an error response', 'the result map') +
            `\`\`\`c
PNError* err = NULL;
voxgig_value* result = sdk_direct(client, cmap(3,
    "path", v_str("${r.path}"),
    "method", v_str("${r.method}"),
    "params", cmap(1, "${r.param}", v_str("example_id"))), &err);

if (!voxgig_as_bool(getp(result, "ok"))) {
    fprintf(stderr, "request failed: %lld %s\\n",
        (long long)to_int(getp(result, "status")), voxgig_to_json(getp(result, "err")));
}
\`\`\`

`,
    },
    cpp: {
        entity: (x) => {
            const { v, factory, arg } = (0, exampleCall_1.exampleParts)('cpp', x);
            const call = `${factory}->${x.op}(${arg}, Value::undef())`;
            const body = 'list' === x.op ? `  std::vector<SdkEntityPtr> ${v}s = ${call};
  for (const auto& ${v} : ${v}s) {
    std::cout << Struct::jsonify(${v}->data()) << std::endl;
  }` : `  SdkEntityPtr ${v} = ${call};
  std::cout << Struct::jsonify(${v}->data()) << std::endl;`;
            return `Entity operations throw \`SdkErrorPtr\` on failure, so wrap them in \`try\` / \`catch\`:

\`\`\`cpp
try {
${body}
} catch (const SdkErrorPtr& err) {
  std::cerr << "${x.op} failed: " << err->msg << std::endl;
}
\`\`\`

`;
        },
        direct: (r) => directLead('direct()', 'throw', 'the result `Value`') +
            `\`\`\`cpp
Value result = client->direct(vmap({
    {"path", Value("${r.path}")},
    {"method", Value("${r.method}")},
    {"params", vmap({{"${r.param}", Value("example_id")}})},
}));

if (!(getp(result, "ok") == Value(true))) {
  std::cerr << "request failed: " << Helpers::toInt(getp(result, "status")) << " "
            << Struct::jsonify(getp(result, "err")) << std::endl;
}
\`\`\`

`,
    },
    rust: {
        entity: (x) => {
            const { v, factory, arg } = (0, exampleCall_1.exampleParts)('rust', x);
            const ok = 'list' === x.op ? `    Ok(${v}s) => {
        for ${v} in &${v}s {
            println!("{:?}", ${v}.data(None));
        }
    }` : `    Ok(${v}) => println!("{:?}", ${v}.data(None)),`;
            return `Entity operations return a \`Result\`, so match on \`Ok\` and \`Err\`:

\`\`\`rust
match ${factory}.${x.op}(${arg}, Value::Noval) {
${ok}
    Err(err) => eprintln!("${x.op} failed: {}", err),
}
\`\`\`

`;
        },
        direct: (r) => directLead('direct()', 'return `Err` for an error response', '`Ok` with the result map') +
            `\`\`\`rust
match client.direct(jo(vec![
    ("path", Value::str("${r.path}")),
    ("method", Value::str("${r.method}")),
    ("params", jo(vec![("${r.param}", Value::str("example_id"))])),
])) {
    Ok(result) => {
        if getp(&result, "ok") != Value::Bool(true) {
            eprintln!("request failed: {:?} {:?}", getp(&result, "status"), getp(&result, "err"));
        }
    }
    Err(err) => eprintln!("request failed: {}", err),
}
\`\`\`

`,
    },
    zig: {
        entity: (x) => {
            const { v, factory, arg } = (0, exampleCall_1.exampleParts)('zig', x);
            const ok = 'list' === x.op ? `    .ok => |${v}s| {
        for (${v}s) |${v}| {
            std.debug.print("{s}\\n", .{h.stringify(${v}.asEntity().data(null))});
        }
    },` : ('remove' === x.op ? `    .ok => std.debug.print("removed\\n", .{}),` :
                `    .ok => |${v}| std.debug.print("{s}\\n", .{h.stringify(${v}.asEntity().data(null))}),`);
            return `Entity operations return a union of \`.ok\` and \`.err\`, so \`switch\` on the result:

\`\`\`zig
switch (${factory}.${x.op}(${arg}, h.vnull())) {
${ok}
    .err => |e| std.debug.print("${x.op} failed: {s}\\n", .{e.msg}),
}
\`\`\`

`;
        },
        direct: (r) => directLead('direct()', 'fail on an error response', 'the result map') +
            `\`\`\`zig
const result = client.direct(h.jo(&.{
    .{ "path", h.vstr("${r.path}") },
    .{ "method", h.vstr("${r.method}") },
    .{ "params", h.jo(&.{.{ "${r.param}", h.vstr("example_id") }}) },
}));

if (!(h.get_bool(result, "ok") orelse false)) {
    std.debug.print("request failed: {d} {s}\\n", .{
        h.to_int(h.getp(result, "status")), h.stringify(h.getp(result, "err")),
    });
}
\`\`\`

`,
    },
    ocaml: {
        entity: (x) => {
            const { v, factory, arg } = (0, exampleCall_1.exampleParts)('ocaml', x);
            const body = 'list' === x.op ? `   let ${v}s = ${factory}.e_list ${arg} Noval in
   List.iter (fun e -> print_endline (stringify (e.e_data_get ()))) ${v}s` :
                `   let ${v} = ${factory}.e_${x.op} ${arg} Noval in
   print_endline (stringify (${v}.e_data_get ()))`;
            return `Entity operations raise \`Sdk_error.E\` on failure, so wrap them in \`try\` ... \`with\`:

\`\`\`ocaml
(try
${body}
 with Sdk_error.E err -> Printf.eprintf "${x.op} failed: %s\\n" (Sdk_error.message err))
\`\`\`

`;
        },
        direct: (r) => directLead('Sdk_client.direct', 'raise', 'the result map') +
            `\`\`\`ocaml
let result = Sdk_client.direct client (jo [
    ("path", Str "${r.path}");
    ("method", Str "${r.method}");
    ("params", jo [("${r.param}", Str "example_id")]);
]) in
(match getp result "ok" with
 | Bool true -> ()
 | _ ->
   Printf.eprintf "request failed: %s %s\\n"
     (stringify (getp result "status")) (stringify (getp result "err")))
\`\`\`

`,
    },
    perl: {
        entity: (x) => {
            const { v, factory, arg } = (0, exampleCall_1.exampleParts)('perl', x);
            return `Entity operations die on failure, so wrap them in \`eval\` and check \`$@\`:

\`\`\`perl
my $${'list' === x.op ? v + 's' : v} = eval { ${factory}->${x.op}(${arg}) };
if (my $err = $@) {
    warn "${x.op} failed: $err";
}
\`\`\`

`;
        },
        direct: (r) => directLead('direct', 'die', 'the result hashref') +
            `\`\`\`perl
my $result = $client->direct({
    'path' => '${r.path}',
    'method' => '${r.method}',
    'params' => { '${r.param}' => 'example_id' },
});

unless ($result->{ok}) {
    warn 'request failed: ', ($result->{status} // ''), ' ', ($result->{err} // ''), "\\n";
}
\`\`\`

`,
    },
    java: {
        entity: (x) => {
            const { v, factory, arg } = (0, exampleCall_1.exampleParts)('java', x);
            const body = 'list' === x.op ? `    List<?> ${v}s = (List<?>) ${factory}.list(${arg}, null);
    for (Object item : ${v}s) {
        System.out.println(((SdkEntity) item).data());
    }` : `    SdkEntity ${v} = (SdkEntity) ${factory}.${x.op}(${arg}, null);
    System.out.println(${v}.data());`;
            return `Entity operations throw a \`RuntimeException\` on failure, so wrap them in
\`try\` / \`catch\`:

\`\`\`java
try {
${body}
}
catch (RuntimeException err) {
    System.out.println("${x.op} failed: " + err.getMessage());
}
\`\`\`

`;
        },
        direct: (r) => directLead('direct()', 'throw', 'the result map') +
            `\`\`\`java
Map<String, Object> result = client.direct(Map.of(
    "path", "${r.path}",
    "method", "${r.method}",
    "params", Map.of("${r.param}", "example_id")));

if (!Boolean.TRUE.equals(result.get("ok"))) {
    System.out.println("request failed: " + result.get("status") + " " + result.get("err"));
}
\`\`\`

`,
    },
    kotlin: {
        entity: (x) => {
            const { v, factory, arg } = (0, exampleCall_1.exampleParts)('kotlin', x);
            const body = 'list' === x.op ? `    val ${v}s = ${factory}.list(${arg}, null) as List<*>
    for (item in ${v}s) {
        println((item as SdkEntity).data())
    }` : `    val ${v} = ${factory}.${x.op}(${arg}, null) as SdkEntity
    println(${v}.data())`;
            return `Entity operations throw a \`RuntimeException\` on failure, so wrap them in
\`try\` / \`catch\`:

\`\`\`kotlin
try {
${body}
}
catch (err: RuntimeException) {
    println("${x.op} failed: " + err.message)
}
\`\`\`

`;
        },
        direct: (r) => directLead('direct()', 'throw', 'the result map') +
            `\`\`\`kotlin
val result = client.direct(mutableMapOf<String, Any?>(
    "path" to "${r.path}",
    "method" to "${r.method}",
    "params" to mapOf("${r.param}" to "example_id")))

if (result["ok"] != true) {
    println("request failed: " + result["status"] + " " + result["err"])
}
\`\`\`

`,
    },
    scala: {
        entity: (x) => {
            const { v, factory, arg } = (0, exampleCall_1.exampleParts)('scala', x);
            const body = 'list' === x.op ? `    val ${v}s = ${factory}.list(${arg}, null).asInstanceOf[java.util.List[SdkEntity]]
    ${v}s.forEach(item => println(item.data()))` :
                `    val ${v} = ${factory}.${x.op}(${arg}, null).asInstanceOf[SdkEntity]
    println(${v}.data())`;
            return `Entity operations throw a \`RuntimeException\` on failure, so wrap them in
\`try\` / \`catch\`:

\`\`\`scala
try {
${body}
}
catch {
    case err: RuntimeException => println("${x.op} failed: " + err.getMessage)
}
\`\`\`

`;
        },
        direct: (r) => directLead('direct()', 'throw', 'the result map') +
            `\`\`\`scala
val result = client.direct(java.util.Map.of(
    "path", "${r.path}",
    "method", "${r.method}",
    "params", java.util.Map.of("${r.param}", "example_id")))

if (java.lang.Boolean.TRUE != result.get("ok")) {
    println("request failed: " + result.get("status") + " " + result.get("err"))
}
\`\`\`

`,
    },
    csharp: {
        entity: (x) => {
            const { v, factory, arg } = (0, exampleCall_1.exampleParts)('csharp', x);
            const method = x.op.charAt(0).toUpperCase() + x.op.slice(1);
            const body = 'list' === x.op ? `    var ${v}List = (List<object?>)${factory}.List(${arg})!;
    foreach (var ${v}Item in ${v}List)
    {
        Console.WriteLine(StructUtils.Jsonify(((IEntity)${v}Item!).Data()));
    }` : `    var ${v} = (IEntity)${factory}.${method}(${arg})!;
    Console.WriteLine(StructUtils.Jsonify(${v}.Data()));`;
            return `Entity operations throw on failure, so wrap them in \`try\` / \`catch\`:

\`\`\`csharp
try
{
${body}
}
catch (Exception err)
{
    Console.WriteLine($"${x.op} failed: {err.Message}");
}
\`\`\`

`;
        },
        direct: (r) => directLead('Direct()', 'throw', 'the result dictionary') +
            `\`\`\`csharp
var result = client.Direct(new Dictionary<string, object?>
{
    ["path"] = "${r.path}",
    ["method"] = "${r.method}",
    ["params"] = new Dictionary<string, object?> { ["${r.param}"] = "example_id" },
});

if (!Equals(result["ok"], true))
{
    result.TryGetValue("status", out var status);
    result.TryGetValue("err", out var err);
    Console.WriteLine($"request failed: {status} {err}");
}
\`\`\`

`,
    },
    swift: {
        entity: (x) => {
            const { v, factory, arg } = (0, exampleCall_1.exampleParts)('swift', x);
            const body = 'list' === x.op ? `    let ${v}List = try ${factory}.list(${arg}, nil)
    for ${v}Item in ${v}List.asList?.items ?? [] {
        if let ${v}Entity = ${v}Item.asNative as? Entity {
            print(${v}Entity.data())
        }
    }` : `    let ${v} = try ${factory}.${x.op}(${arg}, nil)
    if let ${v}Entity = ${v}.asNative as? Entity {
        print(${v}Entity.data())
    }`;
            return `Entity operations throw on failure, so call them with \`try\` inside \`do\` / \`catch\`:

\`\`\`swift
do {
${body}
}
catch {
    print("${x.op} failed: \\(error)")
}
\`\`\`

`;
        },
        direct: (r) => directLead('direct()', 'throw', 'the result map') +
            `\`\`\`swift
let result = client.direct(VMap([
    ("path", .string("${r.path}")),
    ("method", .string("${r.method}")),
    ("params", .map([("${r.param}", .string("example_id"))])),
]))

if result.entries["ok"] != .bool(true) {
    print("request failed:", result.entries["status"] ?? .noval, result.entries["err"] ?? .noval)
}
\`\`\`

`,
    },
    elixir: {
        entity: (x) => {
            const { v, factory, arg } = (0, exampleCall_1.exampleParts)('elixir', x);
            const mod = `${x.model.const.Name}.Entity.${(0, exampleCall_1.entityName)(x.ent)}`;
            const args = '' === arg ? v : `${v}, ${arg}`;
            const body = 'list' === x.op ? `  ${v}s = ${mod}.list(${args})
  for i <- 0..(Voxgig.Struct.size(${v}s) - 1)//1 do
    IO.puts(Voxgig.Struct.jsonify(${mod}.data_get(Voxgig.Struct.getelem(${v}s, i))))
  end` : `  ${v} = ${mod}.${x.op}(${args})
  IO.puts(Voxgig.Struct.jsonify(${mod}.data_get(${v})))`;
            return `Entity operations raise on failure, so wrap them in \`try\` / \`rescue\`:

\`\`\`elixir
try do
  ${v} = ${factory}
${body}
rescue
  err -> IO.puts("${x.op} failed: " <> inspect(err))
end
\`\`\`

`;
        },
        direct: (r, model) => directLead('direct/2', 'raise', 'a result node') +
            `\`\`\`elixir
result = ${model.const.Name}.direct(sdk, ${model.const.Name}.Helpers.deep(%{
  "path" => "${r.path}",
  "method" => "${r.method}",
  "params" => %{"${r.param}" => "example_id"}
}))

unless Voxgig.Struct.getprop(result, "ok") do
  IO.puts("request failed: " <> inspect(Voxgig.Struct.getprop(result, "status")) <>
    " " <> inspect(Voxgig.Struct.getprop(result, "err")))
end
\`\`\`

`,
    },
    clojure: {
        entity: (x) => {
            const { v, factory, arg } = (0, exampleCall_1.exampleParts)('clojure', x);
            const ns = 'e-' + x.ent.name;
            const body = 'list' === x.op ? `  (doseq [${v} (${ns}/list ${factory} ${arg} nil)]
    (println ((:data-get ${v}))))` : `  (let [${v} (${ns}/${x.op} ${factory} ${arg} nil)]
    (println ((:data-get ${v}))))`;
            return `Entity operations throw on failure, so wrap them in \`try\` / \`catch\`:

\`\`\`clojure
(require '[sdk.api :as api]
         '[sdk.entity.${x.ent.name} :as ${ns}]
         '[voxgig.struct :as vs])

(try
${body}
  (catch Exception err
    (println "${x.op} failed:" (.getMessage err))))
\`\`\`

`;
        },
        direct: (r) => directLead('api/direct', 'throw', 'the result map') +
            `\`\`\`clojure
(def result
  (api/direct client
    (vs/jm "path" "${r.path}"
           "method" "${r.method}"
           "params" (vs/jm "${r.param}" "example_id"))))

(when-not (vs/getprop result "ok")
  (println "request failed:" (vs/getprop result "status") (vs/getprop result "err")))
\`\`\`

`,
    },
};
const ReadmeErrors = (0, component_1.cmp)(function ReadmeErrors(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    // An alias writes its origin's row.
    const origin = (0, packageMeta_1.originName)(model, target.name);
    const lang = LANGS[origin] || DEFAULT_LANG;
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
    if (ex && primaryOp && lang.entity) {
        const eName = (0, exampleCall_1.entityName)(ex);
        const eLower = (0, naming_1.exampleVarName)(eName.toLowerCase(), origin);
        const idF = (0, opShape_1.entityIdField)(ex);
        const call = (0, opExample_1.primaryOpCall)((0, opExample_1.helperLang)(origin), eName, eLower, primaryOp, idF, ex);
        (0, jostraca_1.Content)(lang.entity({ model, ent: ex, op: primaryOp, idF, call }));
    }
    (0, jostraca_1.Content)('function' === typeof lang.direct ? lang.direct((0, opShape_1.directRoute)(model), model) : lang.direct);
});
exports.ReadmeErrors = ReadmeErrors;
//# sourceMappingURL=ReadmeErrors.js.map