
import { cmp, Content, isAuthActive, envName, entityIdField, entityDataIdField, entityPrimaryOp, opRequestShape, safeVarName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { exampleValue } from './utility_js'


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity || {}).find((e: any) => e && e.active !== false) as any
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'
  const eVar = safeVarName(eName.toLowerCase(), 'js')

  // Drive the test-mode / stateful examples off the entity's PRIMARY op — an op
  // it actually exposes — never a hardcoded `load` a create-only entity lacks.
  const primaryOp = exampleEntity ? (entityPrimaryOp(exampleEntity) || 'load') : 'load'
  const primaryOpDef = exampleEntity && exampleEntity.op && exampleEntity.op[primaryOp]
  const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
  // idF is the MATCH key; dataIdF is the id on the RETURNED record's data type
  // (guard `.id` reads off a returned record on this, not the match key).
  const idF = exampleEntity ? entityIdField(exampleEntity) : null
  const dataIdF = exampleEntity ? entityDataIdField(exampleEntity) : null

  const primaryArg = (idPlaceholder: string): string => {
    if (!exampleEntity) return ''
    if ('list' === primaryOp) return ''
    if (isMatchOp) {
      return idF ? `{ ${idF}: ${exampleValue(exampleEntity, primaryOpDef, idF, idPlaceholder)} }` : ''
    }
    const items = opRequestShape(exampleEntity, primaryOp).items
      .filter((it: any) => it.name !== idF && it.name !== 'id')
    const required = items.filter((it: any) => !it.optional)
    const chosen = required.length ? required : items.slice(0, 3)
    const pairs = chosen.map((it: any) =>
      `${it.name}: ${exampleValue(exampleEntity, primaryOpDef, it.name, 'example_' + it.name)}`)
    return `{ ${pairs.join(', ')} }`
  }
  const testCallArg = primaryArg('test01')
  const stateCallArg = primaryArg('example')
  const stateDataLine = dataIdF
    ? `console.log(data.${dataIdF})`
    : `console.log(data)`

  const authActive = isAuthActive(model)
  const apikeyTesterCtor = authActive
    ? `new ${model.const.Name}SDK({ apikey: '...' })`
    : `new ${model.const.Name}SDK()`
  const apikeyExtendField = authActive ? `\n  apikey: '...',` : ''
  const apikeyEnvLine = authActive ? `\n${envName(model)}_APIKEY=<your-key>` : ''

  Content(`### Make a direct HTTP request

For endpoints not covered by entity methods:

\`\`\`js
const result = await client.direct({
  path: '/api/resource/{id}',
  method: 'GET',
  params: { id: 'example' },
})

if (result instanceof Error) {
  throw result
}
if (result.ok) {
  console.log(result.status)  // 200
  console.log(result.data)    // response body
}
\`\`\`

### Prepare a request without sending it

\`\`\`js
const fetchdef = await client.prepare({
  path: '/api/resource/{id}',
  method: 'DELETE',
  params: { id: 'example' },
})

// Inspect before sending
console.log(fetchdef.url)
console.log(fetchdef.method)
console.log(fetchdef.headers)
\`\`\`

### Use test mode

Create a mock client for unit testing — no server required:

\`\`\`js
const client = ${model.const.Name}SDK.test()

const ${eVar} = await client.${eName}().${primaryOp}(${testCallArg})
// ${eVar} is a bare entity populated with mock response data
console.log(${eVar})
\`\`\`

You can also use the instance method:

\`\`\`js
const client = ${apikeyTesterCtor}
const testClient = client.tester()
\`\`\`

### Retain entity state across calls

Entity instances remember their last match and data:

\`\`\`js
const entity = client.${eName}()

// First call runs the operation and stores its result
await entity.${primaryOp}(${stateCallArg})

// Subsequent calls reuse the stored state
const data = entity.data()
${stateDataLine}
\`\`\`

### Add custom middleware

Pass features via the \`extend\` option:

\`\`\`js
const logger = {
  hooks: {
    PreRequest: (ctx) => {
      console.log('Requesting:', ctx.spec.method, ctx.spec.path)
    },
    PreResponse: (ctx) => {
      console.log('Status:', ctx.out.request?.status)
    },
  },
}

const client = new ${model.const.Name}SDK({${apikeyExtendField}
  extend: [logger],
})
\`\`\`

### Run live tests

Create a \`.env.local\` file at the project root:

\`\`\`
${envName(model)}_TEST_LIVE=TRUE${apikeyEnvLine}
\`\`\`

Then run:

\`\`\`bash
cd js && npm test
\`\`\`

`)

})


export {
  ReadmeHowto
}
