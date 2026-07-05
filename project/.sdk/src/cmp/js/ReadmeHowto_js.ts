
import { cmp, Content, isAuthActive, envName, entityIdField } from '@voxgig/sdkgen'

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

  // Model-driven id literals so the load examples match the generated
  // match type (e.g. a numeric id must not be quoted).
  const loadOp = exampleEntity && exampleEntity.op && exampleEntity.op.load
  // Model-driven id key: `idF` is the entity's id-like field name, or null
  // when it has none — then load() takes no match and we never read `.id`.
  const idF = exampleEntity ? entityIdField(exampleEntity) : null
  const testIdLit = exampleEntity ? exampleValue(exampleEntity, loadOp, idF || 'id', 'test01') : `'test01'`
  const stateIdLit = exampleEntity ? exampleValue(exampleEntity, loadOp, idF || 'id', 'example') : `'example'`
  const testLoadArg = idF ? `{ ${idF}: ${testIdLit} }` : ''
  const stateLoadArg = idF ? `{ ${idF}: ${stateIdLit} }` : ''
  const stateDataLine = idF
    ? `console.log(data.${idF}) // ${stateIdLit}`
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

const ${eName.toLowerCase()} = await client.${eName}().load(${testLoadArg})
// ${eName.toLowerCase()} is a bare entity populated with mock response data
console.log(${eName.toLowerCase()})
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

// First call sets internal match
await entity.load(${stateLoadArg})

// Subsequent calls reuse the stored match
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
