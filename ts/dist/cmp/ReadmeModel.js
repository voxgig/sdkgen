"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeModel = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const types_1 = require("../types");
const facts_1 = require("../helpers/facts");
const opShape_1 = require("../helpers/opShape");
const optional_1 = require("../helpers/optional");
const ReadmeModel = (0, component_1.cmp)(function ReadmeModel(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    // Guard the Name case variant so the reference header never renders
    // "undefinedSDK" if apidef did not populate it.
    if (model.name && !model.Name)
        (0, jostraca_1.names)(model, model.name);
    const entity = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.entity`);
    const entityList = (0, jostraca_1.each)(entity).filter((e) => e.active !== false);
    (0, jostraca_1.Content)(`
## Reference

`);
    // Delegate to target-specific reference summary
    const ReadmeModel_sdk = (0, optional_1.optionalComponent)(ctx$, target, 'ReadmeModel');
    if (ReadmeModel_sdk) {
        ReadmeModel_sdk['ReadmeModel']({ target });
    }
    else {
        // Fallback: generic reference summary
        ReadmeModelGeneric({ target, model, entityList, authActive: (0, facts_1.fact)(model.main[types_1.KIT], 'auth').apikey });
    }
});
exports.ReadmeModel = ReadmeModel;
const GENERIC_OP_ROWS = {
    load: '| `load(reqmatch?, ctrl?)` | Load a single entity by match criteria. |',
    list: '| `list(reqmatch?, ctrl?)` | List entities matching the criteria. |',
    create: '| `create(reqdata?, ctrl?)` | Create a new entity. |',
    update: '| `update(reqdata?, ctrl?)` | Update an existing entity. |',
    patch: '| `patch(reqdata?, ctrl?)` | Change part of an existing entity. |',
    remove: '| `remove(reqmatch?, ctrl?)` | Remove an entity. |',
};
const ReadmeModelGeneric = (0, component_1.cmp)(function ReadmeModelGeneric(props) {
    const { target, model, entityList, authActive } = props;
    const apikeyRow = authActive
        ? '| `apikey` | `string` | API key for authentication. |\n'
        : '';
    (0, jostraca_1.Content)(`### ${model.Name}SDK

#### Constructor

| Option | Type | Description |
| --- | --- | --- |
${apikeyRow}| \`base\` | \`string\` | Base URL of the API server. |
| \`prefix\` | \`string\` | URL path prefix prepended to all requests. |
| \`suffix\` | \`string\` | URL path suffix appended to all requests. |
| \`feature\` | \`object\` | Feature activation flags. |
| \`extend\` | \`array\` | Additional Feature instances to load. |

#### Methods

| Method | Returns | Description |
| --- | --- | --- |
`);
    (0, jostraca_1.each)(entityList, (ent) => {
        const article = /^[aeiou]/i.test(ent.Name) ? 'an' : 'a';
        (0, jostraca_1.Content)(`| \`${ent.Name}(data?)\` | \`${(0, opShape_1.entityClassName)(ent, (0, opShape_1.entityCollection)(model))}\` | Create ${article} ${ent.Name} entity instance. |
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

${(0, facts_1.fact)(model.main[types_1.KIT], 'sharedOps') ? 'All entities share the same interface.' :
        'Each entity has only the operations its model declares; see its section below.'}

| Method | Description |
| --- | --- |
${(0, opShape_1.introOps)(model).map((op) => GENERIC_OP_ROWS[op] + '\n').join('')}| \`data(data?)\` | Get or set entity data. |
| \`match(match?)\` | Get or set entity match criteria. |
| \`make()\` | Create a new instance with the same options. |
| \`client()\` | Return the parent SDK client. |
| \`entopts()\` | Return a copy of the entity options. |

`);
});
//# sourceMappingURL=ReadmeModel.js.map