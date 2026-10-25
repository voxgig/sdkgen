
import { cmp, Content, isAuthActive, envName, canonKey, canonScalarKey, entityIdField, pickExampleEntity, requiredItems, matchExampleItems, targetFeatures, requestExampleItems } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { cIdent, cVarName, cString } from './utility_c'


// A type-correct C expression constructing a voxgig struct Value.
function cLit(type: any): string {
  const k = canonScalarKey(type)
  if ('NULL' === k) return 'v_null()'
  if ('INTEGER' === k || 'NUMBER' === k) return 'v_num(1)'
  if ('BOOLEAN' === k) return 'v_bool(true)'
  if ('ARRAY' === k) return 'v_list()'
  if ('OBJECT' === k) return 'v_map()'
  return 'v_str("example")'
}


// cmap(...) for a set of pairs, or NULL when empty.
function cmapExpr(pairs: string[]): string {
  return pairs.length ? `cmap(${pairs.length}, ${pairs.join(', ')})` : 'NULL'
}


// What the SDK's own transport does, which is what a reader needs before
// deciding to replace it.
function transportText(model: any, target: any): string {
  const env = envName(model)
  const proxy = null != targetFeatures(model, target).proxy
  return `On a POSIX system the SDK sends each request itself: HTTP/1.1 on a
socket, one request per connection. It reads a response framed by
\`Content-Length\`, by chunks or by the connection closing, gives up on an
exchange 30 seconds after it starts to connect, refuses a response larger
than 32 MiB, and follows no redirect. Looking up the host comes before those
30 seconds, and is bounded by the system resolver alone. A failure to
connect, send or read is a \`fetch_transport\` error. On Windows there is no
default transport: supply \`options.system.fetch\`, described next.

\`https://\` binds the platform's OpenSSL: \`make\` uses it wherever its headers
are installed (\`make TLS=openssl\` insists on it), and a program linking
\`libsdk.a\` links what \`make -s ldlibs\` prints. The server's certificate is
verified against the system's trust store and its name against the host, and
nothing turns that off. A build made with \`TLS=none\` links no TLS library and
refuses every \`https://\` request. Two environment variables change what is
trusted:

- \`${env}_CA_BUNDLE\` names a PEM file of roots added to the system's.
- \`${env}_TLS_PIN\` is the SHA-256 fingerprint of the one certificate to trust
  in place of any store, for a local service with a self-signed certificate.
  \`openssl x509 -noout -fingerprint -sha256 -in cert.pem\` prints it, and the
  host name is still checked against that certificate.
${proxy ? `
With the \`proxy\` feature, a request goes through its \`http://\` proxy, and an
\`https://\` request through a \`CONNECT\` tunnel to it.
` : ''}`
}


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$: { model } } = props

  const ident = cIdent(model)
  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Pick an entity with a real op (prefer a read op). primaryOp is null only
  // when NO entity exposes any op (a direct()-only SDK).
  const { entity: exampleEntity, primaryOp } = pickExampleEntity(entity)
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'
  const evar = exampleEntity ? cVarName(exampleEntity.name) : 'entity'
  const acc = `${ident}_${evar}`
  const idF = exampleEntity ? entityIdField(exampleEntity) : null
  const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
  let testArg = 'NULL'
  if (exampleEntity && isMatchOp) {
    const items = matchExampleItems(exampleEntity, primaryOp, idF)
      .sort((a: any, b: any) => (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
    testArg = cmapExpr(items.map((it: any) =>
      `${cString(it.name)}, ${it.name === idF ? 'v_str("test01")' : cLit(it.type)}`))
  } else if (exampleEntity && 'list' === primaryOp && 0 < requiredItems(exampleEntity, 'list').length) {
    const chosen = requiredItems(exampleEntity, 'list')
    testArg = cmapExpr(chosen.map((it: any) => `${cString(it.name)}, ${cLit(it.type)}`))
  } else if (exampleEntity && ('create' === primaryOp || 'update' === primaryOp || 'patch' === primaryOp)) {
    const items = requestExampleItems(exampleEntity, primaryOp)
      .filter((it: any) => it.name !== idF && it.name !== 'id')
    const required = items.filter((it: any) => !it.optional)
    const chosen = required.length ? required : items.slice(0, 3)
    testArg = cmapExpr(chosen.map((it: any) => `${cString(it.name)}, ${cLit(it.type)}`))
  }

  // The op-driven test-mode line. A direct()-only SDK shows a direct() call.
  const testModeExample = 'list' === primaryOp
    ? `// list returns one entity per mock record, and sets *err on failure.
Entity* ${evar} = ${acc}(client, NULL);
Entity** ${evar}s = ${evar}->vt->list(${evar}, ${testArg}, NULL, &err);
// ${evar}s[i]->vt->data(${evar}s[i], NULL) is a mock record`
    : primaryOp
    ? `// Entity ops return the entity and set *err on failure.
Entity* ${evar} = ${acc}(client, NULL);
Entity* result = ${evar}->vt->${primaryOp}(${evar}, ${testArg}, NULL, &err);
// result->vt->data(result, NULL) is the mock response record`
    : `voxgig_value* result = sdk_direct(client, cmap(2,
    "path", v_str("/api/resource"),
    "method", v_str("GET")), &err);
printf("%s\\n", voxgig_to_json(result));`

  const apikeyEnvLine = isAuthActive(model)
    ? `\n${envName(model)}_APIKEY=<your-key>`
    : ''

  Content(`### Make a direct HTTP request

For endpoints not covered by entity operations:

\`\`\`c
PNError* err = NULL;
voxgig_value* result = sdk_direct(client, cmap(3,
    "path", v_str("/api/resource/{id}"),
    "method", v_str("GET"),
    "params", cmap(1, "id", v_str("example"))), &err);

if (voxgig_as_bool(getp(result, "ok"))) {
    printf("%lld\\n", (long long)to_int(getp(result, "status")));  // 200
    printf("%s\\n", voxgig_to_json(getp(result, "data")));         // response body
} else {
    // A non-2xx response carries status + data (the error body); a
    // transport-level failure carries err instead. Only one is present.
    printf("%s\\n", voxgig_to_json(getp(result, "err")));
}
\`\`\`

\`sdk_direct()\` never sets \`*err\` for a non-2xx response — it always returns
a result map you branch on via \`getp(result, "ok")\`.

### Prepare a request without sending it

\`\`\`c
PNError* err = NULL;
voxgig_value* fetchdef = sdk_prepare(client, cmap(3,
    "path", v_str("/api/resource/{id}"),
    "method", v_str("DELETE"),
    "params", cmap(1, "id", v_str("example"))), &err);

printf("%s\\n", get_str(fetchdef, "url"));
printf("%s\\n", get_str(fetchdef, "method"));
printf("%s\\n", voxgig_to_json(getp(fetchdef, "headers")));
\`\`\`

### Use test mode

Create a mock client for unit testing — no server required:

\`\`\`c
${model.const.Name}SDK* client = test_sdk(NULL, NULL);
PNError* err = NULL;

${testModeExample}
\`\`\`

### Send requests over HTTP and HTTPS

${transportText(model, target)}

### Use a custom fetch function

Replace the HTTP transport with your own function (the same shape the test
transport uses). A response is read through its \`json\` only when it carries
a \`body\`:

\`\`\`c
static voxgig_value* mock_fetch(void* ud, voxgig_value* args) {
    (void)ud; (void)args;
    return cmap(5,
        "status", v_num(200),
        "statusText", v_str("OK"),
        "headers", v_map(),
        "body", v_str("{\\"id\\":\\"mock01\\"}"),
        "json", json_thunk(cmap(1, "id", v_str("mock01"))));
}

${model.const.Name}SDK* client = ${ident}_sdk_new(cmap(2,
    "base", v_str("http://localhost:8080"),
    "system", cmap(1, "fetch", vfn(mock_fetch, NULL))));
\`\`\`

### Point at a different server

Override the base URL to reach a local or staging server:

\`\`\`c
${model.const.Name}SDK* client = ${ident}_sdk_new(cmap(1,
    "base", v_str("http://localhost:8080")));
\`\`\`

### Run live tests

Create a \`.env.local\` file at the project root:

\`\`\`
${envName(model)}_TEST_LIVE=TRUE${apikeyEnvLine}
\`\`\`

Then run:

\`\`\`bash
cd ${target.name} && make test
\`\`\`

`)

})


export {
  ReadmeHowto
}
