
import { cmp, Content, isAuthActive, envName, entityIdField } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity || {}).find((e: any) => e && e.active !== false) as any
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'
  // Model-driven id key: null when the entity has no id-like field (a
  // response-wrapped spec). When null the fixture seeds no id and load takes
  // no match argument.
  const idF = exampleEntity ? entityIdField(exampleEntity) : null
  const seedSentence = idF
    ? '. Seed fixture\ndata via the `entity` option so offline calls resolve without a live server'
    : ''
  const testCtor = idF
    ? `${model.const.Name}SDK.test({\n  "entity" => { "${eName.toLowerCase()}" => { "test01" => { "${idF}" => "test01" } } },\n})`
    : `${model.const.Name}SDK.test`
  const testLoadArg = idF ? `{ "${idF}" => "test01" }` : ''

  const apikeyEnvLine = isAuthActive(model)
    ? `\n${envName(model)}_APIKEY=<your-key>`
    : ''

  Content(`### Make a direct HTTP request

For endpoints not covered by entity methods:

\`\`\`ruby
result = client.direct({
  "path" => "/api/resource/{id}",
  "method" => "GET",
  "params" => { "id" => "example" },
})

if result["ok"]
  puts result["status"]  # 200
  puts result["data"]    # response body
else
  # On an HTTP error status there is no err (only a transport failure sets
  # it), so fall back to the status code.
  warn(result["err"] || "HTTP #{result["status"]}")
end
\`\`\`

### Prepare a request without sending it

\`\`\`ruby
begin
  fetchdef = client.prepare({
    "path" => "/api/resource/{id}",
    "method" => "DELETE",
    "params" => { "id" => "example" },
  })
  puts fetchdef["url"]
  puts fetchdef["method"]
  puts fetchdef["headers"]
rescue => err
  warn "prepare failed: #{err}"
end
\`\`\`

### Use test mode

Create a mock client for unit testing — no server required${seedSentence}:

\`\`\`ruby
client = ${testCtor}

# load returns the bare mock record (raises on error).
${eName.toLowerCase()} = client.${eName}.load(${testLoadArg})
puts ${eName.toLowerCase()}
\`\`\`

### Use a custom fetch function

Replace the HTTP transport with your own function:

\`\`\`ruby
mock_fetch = ->(url, init) {
  return {
    "status" => 200,
    "statusText" => "OK",
    "headers" => {},
    "json" => ->() { { "id" => "mock01" } },
  }, nil
}

client = ${model.const.Name}SDK.new({
  "base" => "http://localhost:8080",
  "system" => {
    "fetch" => mock_fetch,
  },
})
\`\`\`

### Run live tests

Create a \`.env.local\` file at the project root:

\`\`\`
${envName(model)}_TEST_LIVE=TRUE${apikeyEnvLine}
\`\`\`

Then run:

\`\`\`bash
cd rb && ruby -Itest -e "Dir['test/*_test.rb'].each { |f| require_relative f }"
\`\`\`

`)

})


export {
  ReadmeHowto
}
