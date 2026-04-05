"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeModel = void 0;
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const utility_1 = require("../utility");
const ReadmeModel = (0, jostraca_1.cmp)(function ReadmeModel(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    const entity = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.entity`);
    const entityList = Object.values(entity).filter((e) => e.active !== false);
    (0, jostraca_1.Content)(`
## Reference

`);
    // Delegate to target-specific reference summary
    const ReadmeModel_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${target.name}/ReadmeModel_${target.name}`, { ignore: true });
    if (ReadmeModel_sdk) {
        ReadmeModel_sdk['ReadmeModel']({ target });
    }
    else {
        // Fallback: generic reference summary
        ReadmeModelGeneric({ target, model, entityList });
    }
});
exports.ReadmeModel = ReadmeModel;
const ReadmeModelGeneric = (0, jostraca_1.cmp)(function ReadmeModelGeneric(props) {
    const { target, model, entityList } = props;
    (0, jostraca_1.Content)(`### ${model.Name}SDK

#### Constructor

| Option | Type | Description |
| --- | --- | --- |
| \`apikey\` | \`string\` | API key for authentication. |
| \`base\` | \`string\` | Base URL of the API server. |
| \`prefix\` | \`string\` | URL path prefix prepended to all requests. |
| \`suffix\` | \`string\` | URL path suffix appended to all requests. |
| \`feature\` | \`object\` | Feature activation flags. |
| \`extend\` | \`array\` | Additional Feature instances to load. |

#### Methods

| Method | Returns | Description |
| --- | --- | --- |
`);
    (0, jostraca_1.each)(entityList, (ent) => {
        (0, jostraca_1.Content)(`| \`${ent.Name}(data?)\` | \`${ent.Name}Entity\` | Create a ${ent.Name} entity instance. |
`);
    });
    (0, jostraca_1.Content)(`| \`options()\` | \`object\` | Deep copy of current SDK options. |
| \`utility()\` | \`Utility\` | Copy of the SDK utility object. |
| \`prepare(fetchargs?)\` | \`FetchDef\` | Build an HTTP request definition without sending it. |
| \`direct(fetchargs?)\` | \`DirectResult\` | Build and send an HTTP request. |
| \`tester(testopts?, sdkopts?)\` | \`${model.Name}SDK\` | Create a test-mode client instance. |

#### Static methods

| Method | Returns | Description |
| --- | --- | --- |
| \`${model.Name}SDK.test(testopts?, sdkopts?)\` | \`${model.Name}SDK\` | Create a test-mode client. |

### Entity interface

All entities share the same interface.

| Method | Description |
| --- | --- |
| \`load(reqmatch?, ctrl?)\` | Load a single entity by match criteria. |
| \`list(reqmatch?, ctrl?)\` | List entities matching the criteria. |
| \`create(reqdata?, ctrl?)\` | Create a new entity. |
| \`update(reqdata?, ctrl?)\` | Update an existing entity. |
| \`remove(reqmatch?, ctrl?)\` | Remove an entity. |
| \`data(data?)\` | Get or set entity data. |
| \`match(match?)\` | Get or set entity match criteria. |
| \`make()\` | Create a new instance with the same options. |
| \`client()\` | Return the parent SDK client. |
| \`entopts()\` | Return a copy of the entity options. |

`);
});
//# sourceMappingURL=ReadmeModel.js.map