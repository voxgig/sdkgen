"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeRef = void 0;
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const OP_SIGNATURES_TS = {
    load: {
        sig: 'load(match: object, ctrl?: object)',
        returns: 'Promise<object>',
        desc: 'Load a single entity matching the given criteria.',
    },
    list: {
        sig: 'list(match: object, ctrl?: object)',
        returns: 'Promise<object[]>',
        desc: 'List entities matching the given criteria. Returns an array.',
    },
    create: {
        sig: 'create(data: object, ctrl?: object)',
        returns: 'Promise<object>',
        desc: 'Create a new entity with the given data.',
    },
    update: {
        sig: 'update(data: object, ctrl?: object)',
        returns: 'Promise<object>',
        desc: 'Update an existing entity. The data must include the entity `id`.',
    },
    remove: {
        sig: 'remove(match: object, ctrl?: object)',
        returns: 'Promise<void>',
        desc: 'Remove the entity matching the given criteria.',
    },
};
const OP_SIGNATURES_LUA = {
    load: {
        sig: 'load(reqmatch, ctrl) -> any, err',
        returns: 'any, err',
        desc: 'Load a single entity matching the given criteria.',
    },
    list: {
        sig: 'list(reqmatch, ctrl) -> any, err',
        returns: 'any, err',
        desc: 'List entities matching the given criteria. Returns an array.',
    },
    create: {
        sig: 'create(reqdata, ctrl) -> any, err',
        returns: 'any, err',
        desc: 'Create a new entity with the given data.',
    },
    update: {
        sig: 'update(reqdata, ctrl) -> any, err',
        returns: 'any, err',
        desc: 'Update an existing entity. The data must include the entity `id`.',
    },
    remove: {
        sig: 'remove(reqmatch, ctrl) -> any, err',
        returns: 'any, err',
        desc: 'Remove the entity matching the given criteria.',
    },
};
const OP_SIGNATURES_RB = {
    load: {
        sig: 'load(reqmatch, ctrl = nil) -> result, err',
        returns: 'result, err',
        desc: 'Load a single entity matching the given criteria.',
    },
    list: {
        sig: 'list(reqmatch, ctrl = nil) -> result, err',
        returns: 'result, err',
        desc: 'List entities matching the given criteria. Returns an array.',
    },
    create: {
        sig: 'create(reqdata, ctrl = nil) -> result, err',
        returns: 'result, err',
        desc: 'Create a new entity with the given data.',
    },
    update: {
        sig: 'update(reqdata, ctrl = nil) -> result, err',
        returns: 'result, err',
        desc: 'Update an existing entity. The data must include the entity `id`.',
    },
    remove: {
        sig: 'remove(reqmatch, ctrl = nil) -> result, err',
        returns: 'result, err',
        desc: 'Remove the entity matching the given criteria.',
    },
};
const OP_SIGNATURES_PY = {
    load: {
        sig: 'load(reqmatch, ctrl=None) -> tuple',
        returns: '(result, err)',
        desc: 'Load a single entity matching the given criteria.',
    },
    list: {
        sig: 'list(reqmatch, ctrl=None) -> tuple',
        returns: '(result, err)',
        desc: 'List entities matching the given criteria. Returns an array.',
    },
    create: {
        sig: 'create(reqdata, ctrl=None) -> tuple',
        returns: '(result, err)',
        desc: 'Create a new entity with the given data.',
    },
    update: {
        sig: 'update(reqdata, ctrl=None) -> tuple',
        returns: '(result, err)',
        desc: 'Update an existing entity. The data must include the entity `id`.',
    },
    remove: {
        sig: 'remove(reqmatch, ctrl=None) -> tuple',
        returns: '(result, err)',
        desc: 'Remove the entity matching the given criteria.',
    },
};
const OP_SIGNATURES_PHP = {
    load: {
        sig: 'load(array $reqmatch, ?array $ctrl = null): array',
        returns: 'array [$result, $err]',
        desc: 'Load a single entity matching the given criteria.',
    },
    list: {
        sig: 'list(array $reqmatch, ?array $ctrl = null): array',
        returns: 'array [$result, $err]',
        desc: 'List entities matching the given criteria. Returns an array.',
    },
    create: {
        sig: 'create(array $reqdata, ?array $ctrl = null): array',
        returns: 'array [$result, $err]',
        desc: 'Create a new entity with the given data.',
    },
    update: {
        sig: 'update(array $reqdata, ?array $ctrl = null): array',
        returns: 'array [$result, $err]',
        desc: 'Update an existing entity. The data must include the entity `id`.',
    },
    remove: {
        sig: 'remove(array $reqmatch, ?array $ctrl = null): array',
        returns: 'array [$result, $err]',
        desc: 'Remove the entity matching the given criteria.',
    },
};
const OP_SIGNATURES_GO = {
    load: {
        sig: 'Load(reqmatch, ctrl map[string]any) (any, error)',
        returns: '(any, error)',
        desc: 'Load a single entity matching the given criteria.',
    },
    list: {
        sig: 'List(reqmatch, ctrl map[string]any) (any, error)',
        returns: '(any, error)',
        desc: 'List entities matching the given criteria. Returns an array.',
    },
    create: {
        sig: 'Create(reqdata, ctrl map[string]any) (any, error)',
        returns: '(any, error)',
        desc: 'Create a new entity with the given data.',
    },
    update: {
        sig: 'Update(reqdata, ctrl map[string]any) (any, error)',
        returns: '(any, error)',
        desc: 'Update an existing entity. The data must include the entity `id`.',
    },
    remove: {
        sig: 'Remove(reqmatch, ctrl map[string]any) (any, error)',
        returns: '(any, error)',
        desc: 'Remove the entity matching the given criteria.',
    },
};
const ReadmeRef = (0, jostraca_1.cmp)(function ReadmeRef(props) {
    const { target } = props;
    const { model } = props.ctx$;
    const entity = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.entity`);
    const feature = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.feature`);
    const publishedEntities = (0, jostraca_1.each)(entity).filter((e) => e.active !== false);
    const isGo = target.name === 'go';
    const isLua = target.name === 'lua';
    const isRb = target.name === 'rb';
    const isPhp = target.name === 'php';
    const isPy = target.name === 'py';
    const lang = isGo ? 'go' : isLua ? 'lua' : isRb ? 'rb' : isPhp ? 'php' : isPy ? 'py' : 'ts';
    const OP_SIGNATURES = isGo ? OP_SIGNATURES_GO : isLua ? OP_SIGNATURES_LUA : isRb ? OP_SIGNATURES_RB : isPhp ? OP_SIGNATURES_PHP : isPy ? OP_SIGNATURES_PY : OP_SIGNATURES_TS;
    (0, jostraca_1.File)({ name: 'REFERENCE.md' }, () => {
        (0, jostraca_1.Content)(`# ${model.Name} ${target.title} SDK Reference

Complete API reference for the ${model.Name} ${target.title} SDK.


## ${model.Name}SDK

### Constructor

`);
        if (isPy) {
            (0, jostraca_1.Content)(`\`\`\`python
from ${model.name}_sdk import ${model.const.Name}SDK

client = ${model.const.Name}SDK(options)
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`options\` | \`dict\` | SDK configuration options. |
| \`options["apikey"]\` | \`str\` | API key for authentication. |
| \`options["base"]\` | \`str\` | Base URL for API requests. |
| \`options["prefix"]\` | \`str\` | URL prefix appended after base. |
| \`options["suffix"]\` | \`str\` | URL suffix appended after path. |
| \`options["headers"]\` | \`dict\` | Custom headers for all requests. |
| \`options["feature"]\` | \`dict\` | Feature configuration. |
| \`options["system"]\` | \`dict\` | System overrides (e.g. custom fetch). |

`);
        }
        else if (isPhp) {
            (0, jostraca_1.Content)(`\`\`\`php
require_once __DIR__ . '/${model.name}_sdk.php';

$client = new ${model.const.Name}SDK($options);
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`$options\` | \`array\` | SDK configuration options. |
| \`$options["apikey"]\` | \`string\` | API key for authentication. |
| \`$options["base"]\` | \`string\` | Base URL for API requests. |
| \`$options["prefix"]\` | \`string\` | URL prefix appended after base. |
| \`$options["suffix"]\` | \`string\` | URL suffix appended after path. |
| \`$options["headers"]\` | \`array\` | Custom headers for all requests. |
| \`$options["feature"]\` | \`array\` | Feature configuration. |
| \`$options["system"]\` | \`array\` | System overrides (e.g. custom fetch). |

`);
        }
        else if (isRb) {
            (0, jostraca_1.Content)(`\`\`\`ruby
require_relative '${model.name}_sdk'

client = ${model.const.Name}SDK.new(options)
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`options\` | \`Hash\` | SDK configuration options. |
| \`options["apikey"]\` | \`String\` | API key for authentication. |
| \`options["base"]\` | \`String\` | Base URL for API requests. |
| \`options["prefix"]\` | \`String\` | URL prefix appended after base. |
| \`options["suffix"]\` | \`String\` | URL suffix appended after path. |
| \`options["headers"]\` | \`Hash\` | Custom headers for all requests. |
| \`options["feature"]\` | \`Hash\` | Feature configuration. |
| \`options["system"]\` | \`Hash\` | System overrides (e.g. custom fetch). |

`);
        }
        else if (isLua) {
            (0, jostraca_1.Content)(`\`\`\`lua
local sdk = require("${model.name}_sdk")
local client = sdk.new(options)
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`options\` | \`table\` | SDK configuration options. |
| \`options.apikey\` | \`string\` | API key for authentication. |
| \`options.base\` | \`string\` | Base URL for API requests. |
| \`options.prefix\` | \`string\` | URL prefix appended after base. |
| \`options.suffix\` | \`string\` | URL suffix appended after path. |
| \`options.headers\` | \`table\` | Custom headers for all requests. |
| \`options.feature\` | \`table\` | Feature configuration. |
| \`options.system\` | \`table\` | System overrides (e.g. custom fetch). |

`);
        }
        else if (isGo) {
            (0, jostraca_1.Content)(`\`\`\`go
func New${model.const.Name}SDK(options map[string]any) *${model.const.Name}SDK
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`options\` | \`map[string]any\` | SDK configuration options. |
| \`options["apikey"]\` | \`string\` | API key for authentication. |
| \`options["base"]\` | \`string\` | Base URL for API requests. |
| \`options["prefix"]\` | \`string\` | URL prefix appended after base. |
| \`options["suffix"]\` | \`string\` | URL suffix appended after path. |
| \`options["headers"]\` | \`map[string]any\` | Custom headers for all requests. |
| \`options["feature"]\` | \`map[string]any\` | Feature configuration. |
| \`options["system"]\` | \`map[string]any\` | System overrides (e.g. custom fetch). |

`);
        }
        else {
            (0, jostraca_1.Content)(`\`\`\`ts
new ${model.Name}SDK(options?: object)
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`options\` | \`object\` | SDK configuration options. |
| \`options.apikey\` | \`string\` | API key for authentication. |
| \`options.base\` | \`string\` | Base URL for API requests. |
| \`options.prefix\` | \`string\` | URL prefix appended after base. |
| \`options.suffix\` | \`string\` | URL suffix appended after path. |
| \`options.headers\` | \`object\` | Custom headers for all requests. |
| \`options.feature\` | \`object\` | Feature configuration. |
| \`options.system\` | \`object\` | System overrides (e.g. custom fetch). |

`);
        }
        (0, jostraca_1.Content)(`
### Static Methods

`);
        if (isPy) {
            (0, jostraca_1.Content)(`#### \`${model.const.Name}SDK.test(testopts=None, sdkopts=None)\`

Create a test client with mock features active. Both arguments may be \`None\`.

\`\`\`python
client = ${model.const.Name}SDK.test()
\`\`\`

`);
        }
        else if (isPhp) {
            (0, jostraca_1.Content)(`#### \`${model.const.Name}SDK::test($testopts = null, $sdkopts = null)\`

Create a test client with mock features active. Both arguments may be \`null\`.

\`\`\`php
$client = ${model.const.Name}SDK::test();
\`\`\`

`);
        }
        else if (isRb) {
            (0, jostraca_1.Content)(`#### \`${model.const.Name}SDK.test(testopts = nil, sdkopts = nil)\`

Create a test client with mock features active. Both arguments may be \`nil\`.

\`\`\`ruby
client = ${model.const.Name}SDK.test
\`\`\`

`);
        }
        else if (isLua) {
            (0, jostraca_1.Content)(`#### \`sdk.test(testopts, sdkopts)\`

Create a test client with mock features active. Both arguments may be \`nil\`.

\`\`\`lua
local client = sdk.test(nil, nil)
\`\`\`

`);
        }
        else if (isGo) {
            (0, jostraca_1.Content)(`#### \`TestSDK(testopts, sdkopts map[string]any) *${model.const.Name}SDK\`

Create a test client with mock features active. Both arguments may be \`nil\`.

\`\`\`go
client := sdk.TestSDK(nil, nil)
\`\`\`

`);
        }
        else {
            (0, jostraca_1.Content)(`#### \`${model.Name}SDK.test(testopts?, sdkopts?)\`

Create a test client with mock features active.

\`\`\`ts
const client = ${model.Name}SDK.test()
\`\`\`

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`testopts\` | \`object\` | Test feature options. |
| \`sdkopts\` | \`object\` | Additional SDK options merged with test defaults. |

**Returns:** \`${model.Name}SDK\` instance in test mode.

`);
        }
        (0, jostraca_1.Content)(`
### Instance Methods

`);
        // Entity factory methods
        publishedEntities.map((ent) => {
            if (isPy) {
                (0, jostraca_1.Content)(`#### \`${ent.Name}(data=None)\`

Create a new \`${ent.Name}Entity\` instance. Pass \`None\` for no initial data.

`);
            }
            else if (isPhp) {
                (0, jostraca_1.Content)(`#### \`${ent.Name}($data = null)\`

Create a new \`${ent.Name}Entity\` instance. Pass \`null\` for no initial data.

`);
            }
            else if (isRb) {
                (0, jostraca_1.Content)(`#### \`${ent.Name}(data = nil)\`

Create a new \`${ent.Name}\` entity instance. Pass \`nil\` for no initial data.

`);
            }
            else if (isLua) {
                (0, jostraca_1.Content)(`#### \`${ent.Name}(data)\`

Create a new \`${ent.Name}\` entity instance. Pass \`nil\` for no initial data.

`);
            }
            else if (isGo) {
                (0, jostraca_1.Content)(`#### \`${ent.Name}(data map[string]any) ${model.const.Name}Entity\`

Create a new \`${ent.Name}\` entity instance. Pass \`nil\` for no initial data.

`);
            }
            else {
                (0, jostraca_1.Content)(`#### \`${ent.Name}(data?: object)\`

Create a new \`${ent.Name}\` entity instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`data\` | \`object\` | Initial entity data. |

**Returns:** \`${ent.Name}Entity\` instance.

`);
            }
        });
        if (isPy) {
            (0, jostraca_1.Content)(`#### \`options_map() -> dict\`

Return a deep copy of the current SDK options.

#### \`get_utility() -> Utility\`

Return a copy of the SDK utility object.

#### \`direct(fetchargs=None) -> tuple\`

Make a direct HTTP request to any API endpoint. Returns \`(result, err)\`.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`fetchargs["path"]\` | \`str\` | URL path with optional \`{param}\` placeholders. |
| \`fetchargs["method"]\` | \`str\` | HTTP method (default: \`"GET"\`). |
| \`fetchargs["params"]\` | \`dict\` | Path parameter values. |
| \`fetchargs["query"]\` | \`dict\` | Query string parameters. |
| \`fetchargs["headers"]\` | \`dict\` | Request headers (merged with defaults). |
| \`fetchargs["body"]\` | \`any\` | Request body (dicts are JSON-serialized). |

**Returns:** \`(result_dict, err)\`

#### \`prepare(fetchargs=None) -> tuple\`

Prepare a fetch definition without sending. Returns \`(fetchdef, err)\`.

`);
        }
        else if (isPhp) {
            (0, jostraca_1.Content)(`#### \`optionsMap(): array\`

Return a deep copy of the current SDK options.

#### \`getUtility(): ProjectNameUtility\`

Return a copy of the SDK utility object.

#### \`direct(array $fetchargs = []): array\`

Make a direct HTTP request to any API endpoint. Returns \`[$result, $err]\`.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`$fetchargs["path"]\` | \`string\` | URL path with optional \`{param}\` placeholders. |
| \`$fetchargs["method"]\` | \`string\` | HTTP method (default: \`"GET"\`). |
| \`$fetchargs["params"]\` | \`array\` | Path parameter values for \`{param}\` substitution. |
| \`$fetchargs["query"]\` | \`array\` | Query string parameters. |
| \`$fetchargs["headers"]\` | \`array\` | Request headers (merged with defaults). |
| \`$fetchargs["body"]\` | \`mixed\` | Request body (arrays are JSON-serialized). |
| \`$fetchargs["ctrl"]\` | \`array\` | Control options. |

**Returns:** \`array [$result, $err]\`

#### \`prepare(array $fetchargs = []): array\`

Prepare a fetch definition without sending the request. Returns \`[$fetchdef, $err]\`.

`);
        }
        else if (isRb) {
            (0, jostraca_1.Content)(`#### \`options_map -> Hash\`

Return a deep copy of the current SDK options.

#### \`get_utility -> Utility\`

Return a copy of the SDK utility object.

#### \`direct(fetchargs = {}) -> Hash, err\`

Make a direct HTTP request to any API endpoint.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`fetchargs["path"]\` | \`String\` | URL path with optional \`{param}\` placeholders. |
| \`fetchargs["method"]\` | \`String\` | HTTP method (default: \`"GET"\`). |
| \`fetchargs["params"]\` | \`Hash\` | Path parameter values for \`{param}\` substitution. |
| \`fetchargs["query"]\` | \`Hash\` | Query string parameters. |
| \`fetchargs["headers"]\` | \`Hash\` | Request headers (merged with defaults). |
| \`fetchargs["body"]\` | \`any\` | Request body (hashes are JSON-serialized). |
| \`fetchargs["ctrl"]\` | \`Hash\` | Control options (e.g. \`{ "explain" => true }\`). |

**Returns:** \`Hash, err\`

#### \`prepare(fetchargs = {}) -> Hash, err\`

Prepare a fetch definition without sending the request. Accepts the
same parameters as \`direct()\`.

**Returns:** \`Hash, err\`

`);
        }
        else if (isLua) {
            (0, jostraca_1.Content)(`#### \`options_map() -> table\`

Return a deep copy of the current SDK options.

#### \`get_utility() -> Utility\`

Return a copy of the SDK utility object.

#### \`direct(fetchargs) -> table, err\`

Make a direct HTTP request to any API endpoint.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`fetchargs.path\` | \`string\` | URL path with optional \`{param}\` placeholders. |
| \`fetchargs.method\` | \`string\` | HTTP method (default: \`"GET"\`). |
| \`fetchargs.params\` | \`table\` | Path parameter values for \`{param}\` substitution. |
| \`fetchargs.query\` | \`table\` | Query string parameters. |
| \`fetchargs.headers\` | \`table\` | Request headers (merged with defaults). |
| \`fetchargs.body\` | \`any\` | Request body (tables are JSON-serialized). |
| \`fetchargs.ctrl\` | \`table\` | Control options (e.g. \`{ explain = true }\`). |

**Returns:** \`table, err\`

#### \`prepare(fetchargs) -> table, err\`

Prepare a fetch definition without sending the request. Accepts the
same parameters as \`direct()\`.

**Returns:** \`table, err\`

`);
        }
        else if (isGo) {
            (0, jostraca_1.Content)(`#### \`OptionsMap() map[string]any\`

Return a deep copy of the current SDK options.

#### \`GetUtility() *Utility\`

Return a copy of the SDK utility object.

#### \`Direct(fetchargs map[string]any) (map[string]any, error)\`

Make a direct HTTP request to any API endpoint.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`fetchargs["path"]\` | \`string\` | URL path with optional \`{param}\` placeholders. |
| \`fetchargs["method"]\` | \`string\` | HTTP method (default: \`"GET"\`). |
| \`fetchargs["params"]\` | \`map[string]any\` | Path parameter values for \`{param}\` substitution. |
| \`fetchargs["query"]\` | \`map[string]any\` | Query string parameters. |
| \`fetchargs["headers"]\` | \`map[string]any\` | Request headers (merged with defaults). |
| \`fetchargs["body"]\` | \`any\` | Request body (maps are JSON-serialized). |
| \`fetchargs["ctrl"]\` | \`map[string]any\` | Control options (e.g. \`map[string]any{"explain": true}\`). |

**Returns:** \`(map[string]any, error)\`

#### \`Prepare(fetchargs map[string]any) (map[string]any, error)\`

Prepare a fetch definition without sending the request. Accepts the
same parameters as \`Direct()\`.

**Returns:** \`(map[string]any, error)\`

`);
        }
        else {
            (0, jostraca_1.Content)(`#### \`options()\`

Return a deep copy of the current SDK options.

**Returns:** \`object\`

#### \`utility()\`

Return a copy of the SDK utility object.

**Returns:** \`object\`

#### \`direct(fetchargs?: object)\`

Make a direct HTTP request to any API endpoint.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`fetchargs.path\` | \`string\` | URL path with optional \`{param}\` placeholders. |
| \`fetchargs.method\` | \`string\` | HTTP method (default: \`GET\`). |
| \`fetchargs.params\` | \`object\` | Path parameter values for \`{param}\` substitution. |
| \`fetchargs.query\` | \`object\` | Query string parameters. |
| \`fetchargs.headers\` | \`object\` | Request headers (merged with defaults). |
| \`fetchargs.body\` | \`any\` | Request body (objects are JSON-serialized). |
| \`fetchargs.ctrl\` | \`object\` | Control options (e.g. \`{ explain: true }\`). |

**Returns:** \`Promise<{ ok, status, headers, data } | Error>\`

#### \`prepare(fetchargs?: object)\`

Prepare a fetch definition without sending the request. Accepts the
same parameters as \`direct()\`.

**Returns:** \`Promise<{ url, method, headers, body } | Error>\`

#### \`tester(testopts?, sdkopts?)\`

Alias for \`${model.Name}SDK.test()\`.

**Returns:** \`${model.Name}SDK\` instance in test mode.

`);
        }
        // Entity reference sections
        publishedEntities.map((ent) => {
            const opnames = Object.keys(ent.op || {});
            const fields = ent.fields || [];
            (0, jostraca_1.Content)(`
---

## ${ent.Name}Entity

`);
            if (ent.short) {
                (0, jostraca_1.Content)(`${ent.short}

`);
            }
            if (isPy) {
                (0, jostraca_1.Content)(`\`\`\`python
${ent.name} = client.${ent.Name}()
\`\`\`

`);
            }
            else if (isPhp) {
                (0, jostraca_1.Content)(`\`\`\`php
$${ent.name} = $client->${ent.Name}();
\`\`\`

`);
            }
            else if (isRb) {
                (0, jostraca_1.Content)(`\`\`\`ruby
${ent.name} = client.${ent.Name}
\`\`\`

`);
            }
            else if (isLua) {
                (0, jostraca_1.Content)(`\`\`\`lua
local ${ent.name} = client:${ent.Name}(nil)
\`\`\`

`);
            }
            else if (isGo) {
                (0, jostraca_1.Content)(`\`\`\`go
${ent.name} := client.${ent.Name}(nil)
\`\`\`

`);
            }
            else {
                (0, jostraca_1.Content)(`\`\`\`ts
const ${ent.name} = client.${ent.Name}()
\`\`\`

`);
            }
            // Field schema
            if (fields.length > 0) {
                (0, jostraca_1.Content)(`### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
`);
                (0, jostraca_1.each)(fields, (field) => {
                    const req = field.req ? 'Yes' : 'No';
                    const desc = field.short || '';
                    (0, jostraca_1.Content)(`| \`${field.name}\` | \`${field.type || 'any'}\` | ${req} | ${desc} |
`);
                });
                (0, jostraca_1.Content)(`
`);
                // Field operations breakdown
                const hasFieldOps = fields.some((f) => f.op && Object.keys(f.op).length > 0);
                if (hasFieldOps) {
                    (0, jostraca_1.Content)(`### Field Usage by Operation

| Field | load | list | create | update | remove |
| --- | --- | --- | --- | --- | --- |
`);
                    (0, jostraca_1.each)(fields, (field) => {
                        const fops = field.op || {};
                        const cols = ['load', 'list', 'create', 'update', 'remove'].map((op) => {
                            if (!opnames.includes(op))
                                return '-';
                            const fop = fops[op];
                            if (null == fop)
                                return '-';
                            if (fop.active === false)
                                return '-';
                            return 'Yes';
                        });
                        (0, jostraca_1.Content)(`| \`${field.name}\` | ${cols.join(' | ')} |
`);
                    });
                    (0, jostraca_1.Content)(`
`);
                }
            }
            // Operation details
            if (opnames.length > 0) {
                (0, jostraca_1.Content)(`### Operations

`);
                opnames.map((opname) => {
                    const info = OP_SIGNATURES[opname];
                    if (!info)
                        return;
                    (0, jostraca_1.Content)(`#### \`${info.sig}\`

${info.desc}

`);
                    // Show example
                    if (isPy) {
                        if ('load' === opname || 'remove' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`python
result, err = client.${ent.Name}().${opname}({"id": "${ent.name}_id"})
\`\`\`

`);
                        }
                        else if ('list' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`python
results, err = client.${ent.Name}().list({})
\`\`\`

`);
                        }
                        else if ('create' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`python
result, err = client.${ent.Name}().create({
`);
                            (0, jostraca_1.each)(fields, (field) => {
                                if ('id' !== field.name && field.req) {
                                    (0, jostraca_1.Content)(`    "${field.name}": # ${field.type || 'value'},
`);
                                }
                            });
                            (0, jostraca_1.Content)(`})
\`\`\`

`);
                        }
                        else if ('update' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`python
result, err = client.${ent.Name}().update({
    "id": "${ent.name}_id",
    # Fields to update
})
\`\`\`

`);
                        }
                    }
                    else if (isPhp) {
                        if ('load' === opname || 'remove' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`php
[$result, $err] = $client->${ent.Name}()->${opname}(["id" => "${ent.name}_id"]);
\`\`\`

`);
                        }
                        else if ('list' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`php
[$results, $err] = $client->${ent.Name}()->list([]);
\`\`\`

`);
                        }
                        else if ('create' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`php
[$result, $err] = $client->${ent.Name}()->create([
`);
                            (0, jostraca_1.each)(fields, (field) => {
                                if ('id' !== field.name && field.req) {
                                    (0, jostraca_1.Content)(`  "${field.name}" => /* ${field.type || 'value'} */,
`);
                                }
                            });
                            (0, jostraca_1.Content)(`]);
\`\`\`

`);
                        }
                        else if ('update' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`php
[$result, $err] = $client->${ent.Name}()->update([
  "id" => "${ent.name}_id",
  // Fields to update
]);
\`\`\`

`);
                        }
                    }
                    else if (isRb) {
                        if ('load' === opname || 'remove' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`ruby
result, err = client.${ent.Name}.${opname}({ "id" => "${ent.name}_id" })
\`\`\`

`);
                        }
                        else if ('list' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`ruby
results, err = client.${ent.Name}.list(nil)
\`\`\`

`);
                        }
                        else if ('create' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`ruby
result, err = client.${ent.Name}.create({
`);
                            (0, jostraca_1.each)(fields, (field) => {
                                if ('id' !== field.name && field.req) {
                                    (0, jostraca_1.Content)(`  "${field.name}" => # ${field.type || 'value'},
`);
                                }
                            });
                            (0, jostraca_1.Content)(`})
\`\`\`

`);
                        }
                        else if ('update' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`ruby
result, err = client.${ent.Name}.update({
  "id" => "${ent.name}_id",
  # Fields to update
})
\`\`\`

`);
                        }
                    }
                    else if (isLua) {
                        if ('load' === opname || 'remove' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`lua
local result, err = client:${ent.Name}(nil):${opname}({ id = "${ent.name}_id" }, nil)
\`\`\`

`);
                        }
                        else if ('list' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`lua
local results, err = client:${ent.Name}(nil):list(nil, nil)
\`\`\`

`);
                        }
                        else if ('create' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`lua
local result, err = client:${ent.Name}(nil):create({
`);
                            (0, jostraca_1.each)(fields, (field) => {
                                if ('id' !== field.name && field.req) {
                                    (0, jostraca_1.Content)(`  ${field.name} = --[[ ${field.type || 'value'} ]],
`);
                                }
                            });
                            (0, jostraca_1.Content)(`}, nil)
\`\`\`

`);
                        }
                        else if ('update' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`lua
local result, err = client:${ent.Name}(nil):update({
  id = "${ent.name}_id",
  -- Fields to update
}, nil)
\`\`\`

`);
                        }
                    }
                    else if (isGo) {
                        if ('load' === opname || 'remove' === opname) {
                            const goOpName = opname.charAt(0).toUpperCase() + opname.slice(1);
                            (0, jostraca_1.Content)(`\`\`\`go
result, err := client.${ent.Name}(nil).${goOpName}(map[string]any{"id": "${ent.name}_id"}, nil)
\`\`\`

`);
                        }
                        else if ('list' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`go
results, err := client.${ent.Name}(nil).List(nil, nil)
\`\`\`

`);
                        }
                        else if ('create' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`go
result, err := client.${ent.Name}(nil).Create(map[string]any{
`);
                            (0, jostraca_1.each)(fields, (field) => {
                                if ('id' !== field.name && field.req) {
                                    (0, jostraca_1.Content)(`    "${field.name}": /* ${field.type || 'value'} */,
`);
                                }
                            });
                            (0, jostraca_1.Content)(`}, nil)
\`\`\`

`);
                        }
                        else if ('update' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`go
result, err := client.${ent.Name}(nil).Update(map[string]any{
    "id": "${ent.name}_id",
    // Fields to update
}, nil)
\`\`\`

`);
                        }
                    }
                    else {
                        if ('load' === opname || 'remove' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`ts
const result = await client.${ent.Name}().${opname}({ id: '${ent.name}_id' })
\`\`\`

`);
                        }
                        else if ('list' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`ts
const results = await client.${ent.Name}().${opname}()
\`\`\`

`);
                        }
                        else if ('create' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`ts
const result = await client.${ent.Name}().create({
`);
                            (0, jostraca_1.each)(fields, (field) => {
                                if ('id' !== field.name && field.req) {
                                    (0, jostraca_1.Content)(`  ${field.name}: /* ${field.type || 'value'} */,
`);
                                }
                            });
                            (0, jostraca_1.Content)(`})
\`\`\`

`);
                        }
                        else if ('update' === opname) {
                            (0, jostraca_1.Content)(`\`\`\`ts
const result = await client.${ent.Name}().update({
  id: '${ent.name}_id',
  // Fields to update
})
\`\`\`

`);
                        }
                    }
                });
            }
            // Common methods
            if (isPy) {
                (0, jostraca_1.Content)(`### Common Methods

#### \`data_get() -> dict\`

Get the entity data.

#### \`data_set(data)\`

Set the entity data.

#### \`match_get() -> dict\`

Get the entity match criteria.

#### \`match_set(match)\`

Set the entity match criteria.

#### \`make() -> Entity\`

Create a new \`${ent.Name}Entity\` instance with the same options.

#### \`get_name() -> str\`

Return the entity name.

`);
            }
            else if (isPhp) {
                (0, jostraca_1.Content)(`### Common Methods

#### \`dataGet(): array\`

Get the entity data. Returns a copy of the current data.

#### \`dataSet($data): void\`

Set the entity data.

#### \`matchGet(): array\`

Get the entity match criteria.

#### \`matchSet($match): void\`

Set the entity match criteria.

#### \`make(): ${ent.Name}Entity\`

Create a new \`${ent.Name}Entity\` instance with the same client and
options.

#### \`getName(): string\`

Return the entity name.

`);
            }
            else if (isRb) {
                (0, jostraca_1.Content)(`### Common Methods

#### \`data_get -> Hash\`

Get the entity data. Returns a copy of the current data.

#### \`data_set(data)\`

Set the entity data.

#### \`match_get -> Hash\`

Get the entity match criteria.

#### \`match_set(match)\`

Set the entity match criteria.

#### \`make -> Entity\`

Create a new \`${ent.Name}Entity\` instance with the same client and
options.

#### \`get_name -> String\`

Return the entity name.

`);
            }
            else if (isLua) {
                (0, jostraca_1.Content)(`### Common Methods

#### \`data_get() -> table\`

Get the entity data. Returns a copy of the current data.

#### \`data_set(data)\`

Set the entity data.

#### \`match_get() -> table\`

Get the entity match criteria.

#### \`match_set(match)\`

Set the entity match criteria.

#### \`make() -> Entity\`

Create a new \`${ent.Name}Entity\` instance with the same client and
options.

#### \`get_name() -> string\`

Return the entity name.

`);
            }
            else if (isGo) {
                (0, jostraca_1.Content)(`### Common Methods

#### \`Data(args ...any) any\`

Get or set the entity data. When called with data, sets the entity's
internal data and returns the current data. When called without
arguments, returns a copy of the current data.

#### \`Match(args ...any) any\`

Get or set the entity match criteria. Works the same as \`Data()\`.

#### \`Make() Entity\`

Create a new \`${ent.Name}Entity\` instance with the same client and
options.

#### \`GetName() string\`

Return the entity name.

`);
            }
            else {
                (0, jostraca_1.Content)(`### Common Methods

#### \`data(data?: object)\`

Get or set the entity data. When called with data, sets the entity's
internal data and returns the current data. When called without
arguments, returns a copy of the current data.

#### \`match(match?: object)\`

Get or set the entity match criteria. Works the same as \`data()\`.

#### \`make()\`

Create a new \`${ent.Name}Entity\` instance with the same client and
options.

#### \`client()\`

Return the parent \`${model.Name}SDK\` instance.

#### \`entopts()\`

Return a copy of the entity options.

`);
            }
        });
        // Features section
        const activeFeatures = (0, jostraca_1.each)(feature).filter((f) => f.active);
        if (activeFeatures.length > 0) {
            (0, jostraca_1.Content)(`
---

## Features

| Feature | Version | Description |
| --- | --- | --- |
`);
            activeFeatures.map((f) => {
                (0, jostraca_1.Content)(`| \`${f.name}\` | ${f.version || '0.0.1'} | ${f.title || ''} |
`);
            });
            (0, jostraca_1.Content)(`

Features are activated via the \`feature\` option:

`);
            if (isPy) {
                (0, jostraca_1.Content)(`\`\`\`python
client = ${model.const.Name}SDK({
    "feature": {
`);
                activeFeatures.map((f) => {
                    (0, jostraca_1.Content)(`        "${f.name}": {"active": True},
`);
                });
                (0, jostraca_1.Content)(`    },
})
\`\`\`

`);
            }
            else if (isPhp) {
                (0, jostraca_1.Content)(`\`\`\`php
$client = new ${model.const.Name}SDK([
  "feature" => [
`);
                activeFeatures.map((f) => {
                    (0, jostraca_1.Content)(`    "${f.name}" => ["active" => true],
`);
                });
                (0, jostraca_1.Content)(`  ],
]);
\`\`\`

`);
            }
            else if (isRb) {
                (0, jostraca_1.Content)(`\`\`\`ruby
client = ${model.const.Name}SDK.new({
  "feature" => {
`);
                activeFeatures.map((f) => {
                    (0, jostraca_1.Content)(`    "${f.name}" => { "active" => true },
`);
                });
                (0, jostraca_1.Content)(`  },
})
\`\`\`

`);
            }
            else if (isLua) {
                (0, jostraca_1.Content)(`\`\`\`lua
local client = sdk.new({
  feature = {
`);
                activeFeatures.map((f) => {
                    (0, jostraca_1.Content)(`    ${f.name} = { active = true },
`);
                });
                (0, jostraca_1.Content)(`  },
})
\`\`\`

`);
            }
            else if (isGo) {
                (0, jostraca_1.Content)(`\`\`\`go
client := sdk.New${model.const.Name}SDK(map[string]any{
    "feature": map[string]any{
`);
                activeFeatures.map((f) => {
                    (0, jostraca_1.Content)(`        "${f.name}": map[string]any{"active": true},
`);
                });
                (0, jostraca_1.Content)(`    },
})
\`\`\`

`);
            }
            else {
                (0, jostraca_1.Content)(`\`\`\`ts
const client = new ${model.Name}SDK({
  feature: {
`);
                activeFeatures.map((f) => {
                    (0, jostraca_1.Content)(`    ${f.name}: { active: true },
`);
                });
                (0, jostraca_1.Content)(`  }
})
\`\`\`

`);
            }
        }
    });
});
exports.ReadmeRef = ReadmeRef;
//# sourceMappingURL=ReadmeRef.js.map