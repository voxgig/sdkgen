
import { cmp, Content, isAuthActive, canonScalarKey, entityIdField, pickExampleEntity, requiredItems, matchExampleItems, requestExampleItems, envLocalAt, cdTarget, fact, directRoute } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { kotlinVarName, kotlinString } from './utility_kotlin'


// A type-correct Kotlin literal for a field's canonical type.
function kotlinLit(type: any): string {
  const k = canonScalarKey(type)
  if ('NULL' === k) return 'null'
  if ('INTEGER' === k) return '1L'
  if ('NUMBER' === k) return '1.0'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k) return 'listOf<Any?>()'
  if ('OBJECT' === k) return 'mapOf<String, Any?>()'
  return '"example"'
}


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$: { model } } = props
  const dx = directRoute(model)
  const ENVVAR = fact(model.main[KIT], 'env')

  const SDK = model.const.Name + 'SDK'

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Pick an entity with a real op (prefer a read op). primaryOp is null only
  // when NO entity exposes any op (a direct()-only SDK).
  const { entity: exampleEntity, primaryOp } = pickExampleEntity(entity)
  const eVar = exampleEntity ? kotlinVarName(exampleEntity.name) : 'entity'
  const accessor = exampleEntity ? kotlinVarName(exampleEntity.name) : 'entity'
  // Model-driven id key: null when the entity has no id-like field, so a
  // match op takes an empty match.
  const idF = exampleEntity ? entityIdField(exampleEntity) : null
  const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
  let testArg = 'null'
  if (exampleEntity && isMatchOp) {
    const items = matchExampleItems(exampleEntity, primaryOp, idF)
      .sort((a: any, b: any) => (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
    testArg = 0 < items.length
      ? `mutableMapOf<String, Any?>(${items.map((it: any) =>
        `${kotlinString(it.name)} to ${it.name === idF ? '"test01"' : kotlinLit(it.type)}`).join(', ')})`
      : 'null'
  } else if (exampleEntity && 'list' === primaryOp && 0 < requiredItems(exampleEntity, 'list').length) {
    const chosen = requiredItems(exampleEntity, 'list')
    testArg = `mutableMapOf<String, Any?>(${chosen.map((it: any) =>
      `${kotlinString(it.name)} to ${kotlinLit(it.type)}`).join(', ')})`
  } else if (exampleEntity && ('create' === primaryOp || 'update' === primaryOp || 'patch' === primaryOp)) {
    const items = requestExampleItems(exampleEntity, primaryOp)
      .filter((it: any) => it.name !== idF && it.name !== 'id')
    const required = items.filter((it: any) => !it.optional)
    const chosen = required.length ? required : items.slice(0, 3)
    testArg = `mutableMapOf<String, Any?>(${chosen.map((it: any) =>
      `${kotlinString(it.name)} to ${kotlinLit(it.type)}`).join(', ')})`
  }

  // The op-driven test-mode line, shown only when the SDK has an entity op.
  // A direct()-only SDK (no ops anywhere) shows a direct() call instead.
  const testModeExample = 'list' === primaryOp
    ? `// list returns a list of entities, one per mock record; it raises on error.
val ${eVar}List = client.${accessor}(null).list(${testArg}, null) as List<*>
for (${eVar}Item in ${eVar}List) {
    println((${eVar}Item as SdkEntity).data())
}`
    : primaryOp
    ? `// Entity ops return the entity; they raise on error.
val ${eVar} = client.${accessor}(null).${primaryOp}(${testArg}, null) as SdkEntity
// data() reads the entity's mock record
println(${eVar}.data())`
    : `val result = client.direct(mutableMapOf<String, Any?>(
    "path" to "/api/resource",
    "method" to "GET"))
println(result)`

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

\`\`\`kotlin
val result = client.direct(mutableMapOf<String, Any?>(
    "path" to "${dx.path}",
    "method" to "${dx.method}",
    "params" to mapOf("${dx.param}" to "example")))

if (result["ok"] == true) {
    println(result["status"])  // 200
    println(result["data"])    // response body
}
else {
    // A non-2xx response carries status + data (the error body); a
    // transport-level failure carries err instead. Only one is present, so
    // an absent key simply reads as null.
    println("" + result["status"] + " " + result["err"])
}
\`\`\`

### Prepare a request without sending it

\`\`\`kotlin
// prepare() returns the fetch definition and raises on error.
val fetchdef = client.prepare(mutableMapOf<String, Any?>(
    "path" to "${dx.path}",
    "method" to "${dx.method}",
    "params" to mapOf("${dx.param}" to "example")))

println(fetchdef["url"])
println(fetchdef["method"])
println(fetchdef["headers"])
\`\`\`

### Use test mode

Create a mock client for unit testing — no server required:

\`\`\`kotlin
val client = ${SDK}.testSDK(null, null)

${testModeExample}
\`\`\`

### Use a custom fetch function

Replace the HTTP transport with your own \`BiFunction\`:

\`\`\`kotlin
val mockFetch = java.util.function.BiFunction<String, MutableMap<String, Any?>, Any?> { url, init ->
    mutableMapOf<String, Any?>(
        "status" to 200,
        "statusText" to "OK",
        "headers" to mutableMapOf<String, Any?>(),
        "json" to java.util.function.Supplier<Any?> { mapOf("id" to "mock01") },
    )
}

val client = ${SDK}(mutableMapOf<String, Any?>(
    "base" to "http://localhost:8080",
    "system" to mapOf("fetch" to mockFetch),
))
\`\`\`

### Run live tests

Create a \`.env.local\` file ${envLocalAt(props.ctx$, target)}:

\`\`\`
${ENVVAR.live}=TRUE${apikeyEnvLine}${serverEnvLine}
\`\`\`

${liveEnvNote}Then run:

\`\`\`bash
${cdTarget(target)}gradle test
\`\`\`

`)

})


export {
  ReadmeHowto
}
