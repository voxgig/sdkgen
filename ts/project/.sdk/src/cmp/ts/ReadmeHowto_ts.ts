
import { cmp, Content, isAuthActive, entityIdField, entityDataIdField, pickExampleEntity, exampleVarName, jsKey, requiredItems, matchExampleItems, jsProp, requestExampleItems, envLocalAt, cdTarget, fact, directRoute } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { exampleValue } from './utility_ts'


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$: { model } } = props
  const dx = directRoute(model)
  const ENVVAR = fact(model.main[KIT], 'env')

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const { entity: exampleEntity, primaryOp } = pickExampleEntity(entity)
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'
  const eVar = exampleVarName(eName.toLowerCase(), 'ts')

  const primaryOpDef = exampleEntity && primaryOp && exampleEntity.op && exampleEntity.op[primaryOp]
  const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
  // Model-driven id key: `idF` is the entity's id-like MATCH field name, or null
  // when it has none. `dataIdF` is the id on the RETURNED record's data type —
  // reading `.id` off a record whose data type has none is a TS2339.
  const idF = exampleEntity ? entityIdField(exampleEntity) : null
  const dataIdF = exampleEntity ? entityDataIdField(exampleEntity) : null

  const primaryArg = (idPlaceholder: string): string => {
    if (!exampleEntity || !primaryOp) return ''
    if (isMatchOp || 'list' === primaryOp) {
      // Every REQUIRED match key (id first), not just idF — a composite-match
      // entity (e.g. Umbrella's FlatPermission, database_id + id) needs them all
      // to satisfy the typed <Name>LoadMatch. Mirrors ReadmeTopTest.
      const items = (isMatchOp ? matchExampleItems(exampleEntity, primaryOp, idF) : requiredItems(exampleEntity, 'list'))
        .sort((a: any, b: any) => (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      if (0 === items.length) return ''
      const pairs = items.map((it: any) =>
        `${jsKey(it.name)}: ${exampleValue(exampleEntity, primaryOpDef, it.name,
          it.name === idF ? idPlaceholder : 'example_' + it.name)}`)
      return `{ ${pairs.join(', ')} }`
    }
    const isIdField = (it: any) => it.name === idF || it.name === 'id'
    const items = requestExampleItems(exampleEntity, primaryOp)
      .filter((it: any) => !isIdField(it) || !it.optional)
    const required = items.filter((it: any) => !it.optional)
    const chosen = required.length ? required : items.slice(0, 3)
    const pairs = chosen.map((it: any) =>
      `${jsKey(it.name)}: ${exampleValue(exampleEntity, primaryOpDef, it.name,
        isIdField(it) ? idPlaceholder : 'example_' + it.name)}`)
    return `{ ${pairs.join(', ')} }`
  }
  const testCallArg = primaryArg('test01')
  const stateCallArg = primaryArg('example')
  const stateDataLine = dataIdF
    ? `console.log(${jsProp('data', dataIdF)})`
    : `console.log(data)`

  // The op-driven example lines, shown only when the SDK has an entity op.
  // A direct()-only SDK (no ops anywhere) shows a direct() test call instead.
  const testModeExample = 'list' === primaryOp
    ? `const ${eVar}s = await client.${eName}().list(${testCallArg})
// ${eVar}s is an array of ${eName} entities, one per mock record
console.log(${eVar}s.map((${eVar}) => ${eVar}.data()))`
    : primaryOp
    ? `const ${eVar} = await client.${eName}().${primaryOp}(${testCallArg})
// ${eVar} is the ${eName} entity; .data() reads its mock record
console.log(${eVar}.data())`
    : `const result = await client.direct({ path: '/api/resource', method: 'GET' })
console.log(result)`
  const stateSection = primaryOp
    ? `### Retain entity state across calls

Entity instances remember their last match and data:

\`\`\`ts
const entity = client.${eName}()

// First call runs the operation and stores its result
await entity.${primaryOp}(${stateCallArg})

// Subsequent calls reuse the stored state
const data = entity.data()
${stateDataLine}
\`\`\`

`
    : ''

  const authActive = isAuthActive(model)
  const authBasic = authActive && fact(model.main[KIT], 'auth').secret
  // A client built over a templated URL needs the variables it has no default for.
  const svars = fact(model.main[KIT], 'server').filter((v: any) => v.required)
  const testerFields = [
    ...(authActive ? [`apikey: '...'`] : []),
    ...(authBasic ? [`secret: '...'`] : []),
    ...(0 === svars.length ? [] : [`server: { ${svars.map((v: any) => `${v.name}: '...'`).join(', ')} }`]),
  ]
  const apikeyTesterCtor = 0 === testerFields.length
    ? `new ${model.const.Name}SDK()`
    : `new ${model.const.Name}SDK({ ${testerFields.join(', ')} })`
  const apikeyExtendField = (authActive
    ? `\n  apikey: '...',${authBasic ? `\n  secret: '...',` : ''}`
    : '') + (0 === svars.length ? '' :
      `\n  server: {${svars.map((v: any) => `\n    ${v.name}: '...',`).join('')}\n  },`)
  const apikeyEnvLine = authActive
    ? `\n${ENVVAR.apikey}=<your-key>${authBasic ? `\n${ENVVAR.secret}=<your-secret>` : ''}`
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

\`\`\`ts
const result = await client.direct({
  path: '${dx.path}',
  method: '${dx.method}',
  params: { ${jsKey(dx.param)}: 'example' },
})

if (result.ok) {
  console.log(result.status)  // 200
  console.log(result.data)    // response body
}
\`\`\`

### Prepare a request without sending it

\`\`\`ts
const fetchdef = await client.prepare({
  path: '${dx.path}',
  method: '${dx.method}',
  params: { ${jsKey(dx.param)}: 'example' },
})

// Inspect before sending
console.log(fetchdef.url)
console.log(fetchdef.method)
console.log(fetchdef.headers)
\`\`\`

### Use test mode

Create a mock client for unit testing \u2014 no server required:

\`\`\`ts
const client = ${model.const.Name}SDK.test()

${testModeExample}
\`\`\`

You can also use the instance method:

\`\`\`ts
const client = ${apikeyTesterCtor}
const testClient = client.tester()
\`\`\`

${stateSection}### Add custom middleware

Pass features via the \`extend\` option:

\`\`\`ts
const logger = {
  hooks: {
    PreRequest: (ctx: any) => {
      console.log('Requesting:', ctx.spec.method, ctx.spec.path)
    },
    PreResponse: (ctx: any) => {
      console.log('Status:', ctx.out.request?.status)
    },
  },
}

const client = new ${model.const.Name}SDK({${apikeyExtendField}
  extend: [logger],
})
\`\`\`

### Run live tests

Create a \`.env.local\` file ${envLocalAt(props.ctx$, target)}:

\`\`\`
${ENVVAR.live}=TRUE${apikeyEnvLine}${serverEnvLine}
\`\`\`

${liveEnvNote}Then run:

\`\`\`bash
${cdTarget(target)}npm test
\`\`\`

Live entity tests continue independent operations after errors and attempt
supported cleanup. Their final result reports failures and missing prerequisites
after the remaining work completes. The model and test inputs determine which
API operations the generated scenarios cover.

`)

})


export {
  ReadmeHowto
}
