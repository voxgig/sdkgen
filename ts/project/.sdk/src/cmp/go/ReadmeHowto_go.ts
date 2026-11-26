
import { cmp, Content, isAuthActive, canonKey, canonScalarKey, entityIdField, pickExampleEntity, goModule, requiredItems, litPair, matchExampleItems, requestExampleItems, envLocalAt, cdTarget, fact } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { goVarName } from './utility_go'


function goLit(type: any): string {
  const k = canonScalarKey(type)
  if ('NULL' === k) return 'nil'
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k) return '[]any{}'
  if ('OBJECT' === k) return 'map[string]any{}'
  return '"example"'
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$: { model } } = props
  const ENVVAR = fact(model.main[KIT], 'env')

  const gomodule = goModule(model, target.name)

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Pick an entity with a real op (prefer a read op) — never fabricate a
  // `Load` on an op-less entity like Cloudsmith's `Abort`. primaryOp is null
  // only when NO entity exposes any op (a direct()-only SDK).
  const { entity: exampleEntity, primaryOp } = pickExampleEntity(entity)
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'
  // camelCase Go identifier (never snake_case or flattened lowercase,
  // never a Go keyword).
  const eLower = exampleEntity ? goVarName(exampleEntity.name) : 'entity'
  const idF = exampleEntity ? entityIdField(exampleEntity) : null
  const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
  let testArg = 'nil'
  if (exampleEntity && (isMatchOp || ('list' === primaryOp && 0 < requiredItems(exampleEntity, 'list').length))) {
    const items = (isMatchOp ? matchExampleItems(exampleEntity, primaryOp, idF) : requiredItems(exampleEntity, 'list'))
      .sort((a: any, b: any) => (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
    testArg = 0 < items.length
      ? `map[string]any{${items.map((it: any) => litPair('go', it.name, isMatchOp && it.name === idF ? '"test01"' : goLit(it.type))).join(', ')}}`
      : 'nil'
  } else if (exampleEntity && ('create' === primaryOp || 'update' === primaryOp || 'patch' === primaryOp)) {
    const items = requestExampleItems(exampleEntity, primaryOp)
      .filter((it: any) => it.name !== idF && it.name !== 'id')
    const required = items.filter((it: any) => !it.optional)
    const chosen = required.length ? required : items.slice(0, 3)
    testArg = `map[string]any{${chosen.map((it: any) => litPair('go', it.name, goLit(it.type))).join(', ')}}`
  }

  // The op-driven test-mode block, shown only when the SDK has an entity op.
  // A direct()-only SDK (no ops anywhere) shows a Direct() call instead — never
  // a fabricated method (`cap(primaryOp)` would also fail on a null op).
  const testModeExample = 'list' === primaryOp
    ? `${eLower}s, err := client.${eName}(nil).List(
    ${testArg}, nil,
)
if err != nil {
    panic(err)
}
// A []any of entities, one per mock record.
for _, item := range ${eLower}s.([]any) {
    fmt.Println(item.(sdk.Entity).Data())
}`
    : primaryOp
    ? `${eLower}, err := client.${eName}(nil).${cap(primaryOp)}(
    ${testArg}, nil,
)
if err != nil {
    panic(err)
}
fmt.Println(${eLower}.(sdk.Entity).Data()) // the entity's mock record`
    : `result, err := client.Direct(map[string]any{"path": "/api/resource", "method": "GET"})
if err != nil {
    panic(err)
}
fmt.Println(result)`

  const apikeyEnvLine = isAuthActive(model)
    ? `\n${ENVVAR.apikey}=<your-key>${fact(model.main[KIT], 'auth').secret ? `\n${ENVVAR.secret}=<your-secret>` : ''}`
    : ''
  const serverEnvLine = fact(model.main[KIT], 'server').filter((v: any) => v.required)
    .map((v: any) => `\n${ENVVAR.server[v.name]}=<${v.name}>`).join('')
  const defaulted = fact(model.main[KIT], 'server').filter((v: any) => !v.required)
  const liveEnvNote = (0 === defaulted.length ? '' :
    defaulted.map((v: any) => '`' + ENVVAR.server[v.name] + '`').join(', ') +
    (1 === defaulted.length ? ', when set, replaces its server variable\'s default.\n'
      : ', when set, replace their server variables\' defaults.\n')) +
    'Each entity\'s tests also read `' + ENVVAR.prefix + '_TEST_<ENTITY>_ENTID`, with the\n' +
    'entity\'s name in capitals: a JSON object of the ids of existing records, for\n' +
    'the tests that do not create their own.\n\n'

  Content(`### Make a direct HTTP request

For endpoints not covered by entity methods:

\`\`\`go
result, err := client.Direct(map[string]any{
    "path":   "/api/resource/{id}",
    "method": "GET",
    "params": map[string]any{"id": "example"},
})
if err != nil {
    panic(err)
}

if result["ok"] == true {
    fmt.Println(result["status"]) // 200
    fmt.Println(result["data"])   // response body
}
\`\`\`

### Prepare a request without sending it

\`\`\`go
fetchdef, err := client.Prepare(map[string]any{
    "path":   "/api/resource/{id}",
    "method": "DELETE",
    "params": map[string]any{"id": "example"},
})
if err != nil {
    panic(err)
}

fmt.Println(fetchdef["url"])
fmt.Println(fetchdef["method"])
fmt.Println(fetchdef["headers"])
\`\`\`

### Use test mode

Create a mock client for unit testing \u2014 no server required:

\`\`\`go
client := sdk.Test()

${testModeExample}
\`\`\`

### Use a custom fetch function

Replace the HTTP transport with your own function:

\`\`\`go
mockFetch := func(url string, init map[string]any) (map[string]any, error) {
    return map[string]any{
        "status":     200,
        "statusText": "OK",
        "headers":    map[string]any{},
        "json": (func() any)(func() any {
            return map[string]any{"id": "mock01"}
        }),
    }, nil
}

client := sdk.New${model.const.Name}SDK(map[string]any{
    "base": "http://localhost:8080",
    "system": map[string]any{
        "fetch": (func(string, map[string]any) (map[string]any, error))(mockFetch),
    },
})
\`\`\`

### Run live tests

Create a \`.env.local\` file ${envLocalAt(props.ctx$, target)}:

\`\`\`
${ENVVAR.live}=TRUE${apikeyEnvLine}${serverEnvLine}
\`\`\`

${liveEnvNote}Then run:

\`\`\`bash
${cdTarget(target)}go test ./test/...
\`\`\`

`)

})


export {
  ReadmeHowto
}
