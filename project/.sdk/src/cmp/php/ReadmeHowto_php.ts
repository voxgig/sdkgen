
import { cmp, Content, isAuthActive, envName } from '@voxgig/sdkgen'

import { KIT, getModelPath, nom } from '@voxgig/apidef'


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity || {}).find((e: any) => e && e.active !== false) as any
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'

  const apikeyEnvLine = isAuthActive(model)
    ? `\n${envName(model)}_APIKEY=<your-key>`
    : ''

  Content(`### Make a direct HTTP request

For endpoints not covered by entity methods:

\`\`\`php
[$result, $err] = $client->direct([
    "path" => "/api/resource/{id}",
    "method" => "GET",
    "params" => ["id" => "example"],
]);
if ($err) { throw new \\Exception($err); }

if ($result["ok"]) {
    echo $result["status"];  // 200
    print_r($result["data"]);  // response body
}
\`\`\`

### Prepare a request without sending it

\`\`\`php
[$fetchdef, $err] = $client->prepare([
    "path" => "/api/resource/{id}",
    "method" => "DELETE",
    "params" => ["id" => "example"],
]);
if ($err) { throw new \\Exception($err); }

echo $fetchdef["url"];
echo $fetchdef["method"];
print_r($fetchdef["headers"]);
\`\`\`

### Use test mode

Create a mock client for unit testing — no server required:

\`\`\`php
$client = ${model.const.Name}SDK::test();

[$result, $err] = $client->${eName}()->load(["id" => "test01"]);
// $result contains mock response data
\`\`\`

### Use a custom fetch function

Replace the HTTP transport with your own function:

\`\`\`php
$mock_fetch = function ($url, $init) {
    return [
        [
            "status" => 200,
            "statusText" => "OK",
            "headers" => [],
            "json" => function () { return ["id" => "mock01"]; },
        ],
        null,
    ];
};

$client = new ${model.const.Name}SDK([
    "base" => "http://localhost:8080",
    "system" => [
        "fetch" => $mock_fetch,
    ],
]);
\`\`\`

### Run live tests

Create a \`.env.local\` file at the project root:

\`\`\`
${envName(model)}_TEST_LIVE=TRUE${apikeyEnvLine}
\`\`\`

Then run:

\`\`\`bash
cd php && ./vendor/bin/phpunit test/
\`\`\`

`)

})


export {
  ReadmeHowto
}
