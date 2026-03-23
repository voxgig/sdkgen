"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeEntity = void 0;
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const OP_DESC = {
    load: { method: 'load(match)', desc: 'Load a single entity by match criteria.' },
    list: { method: 'list(match)', desc: 'List entities matching the criteria.' },
    create: { method: 'create(data)', desc: 'Create a new entity with the given data.' },
    update: { method: 'update(data)', desc: 'Update an existing entity.' },
    remove: { method: 'remove(match)', desc: 'Remove the matching entity.' },
};
const ReadmeEntity = (0, jostraca_1.cmp)(function ReadmeEntity(props) {
    const { ctx$: { model } } = props;
    const entity = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.entity`);
    const publishedEntities = (0, jostraca_1.each)(entity)
        .filter((entity) => entity.publish);
    if (0 === publishedEntities.length) {
        return;
    }
    (0, jostraca_1.Content)(`

## Entities

`);
    publishedEntities.map((entity) => {
        const opnames = Object.keys(entity.op || {});
        const fields = entity.field || [];
        (0, jostraca_1.Content)(`
### ${entity.Name}

`);
        if (entity.short) {
            (0, jostraca_1.Content)(`${entity.short}

`);
        }
        (0, jostraca_1.Content)(`Create an instance: \`const ${entity.name} = client.${entity.Name}()\`

`);
        // Operations table
        if (opnames.length > 0) {
            (0, jostraca_1.Content)(`#### Operations

| Method | Description |
| --- | --- |
`);
            opnames.map((opname) => {
                const info = OP_DESC[opname];
                if (info) {
                    (0, jostraca_1.Content)(`| \`${info.method}\` | ${info.desc} |
`);
                }
            });
            (0, jostraca_1.Content)(`
`);
        }
        // Fields table
        if (fields.length > 0) {
            (0, jostraca_1.Content)(`#### Fields

| Field | Type | Description |
| --- | --- | --- |
`);
            (0, jostraca_1.each)(fields, (field) => {
                const desc = field.short || '';
                (0, jostraca_1.Content)(`| \`${field.name}\` | \`${field.type || 'any'}\` | ${desc} |
`);
            });
            (0, jostraca_1.Content)(`
`);
        }
        // Example usage
        if (opnames.includes('load')) {
            (0, jostraca_1.Content)(`#### Example: Load

\`\`\`ts
const ${entity.name} = await client.${entity.Name}().load({ id: '${entity.name}_id' })
\`\`\`

`);
        }
        if (opnames.includes('list')) {
            (0, jostraca_1.Content)(`#### Example: List

\`\`\`ts
const ${entity.name}s = await client.${entity.Name}().list()
\`\`\`

`);
        }
        if (opnames.includes('create')) {
            (0, jostraca_1.Content)(`#### Example: Create

\`\`\`ts
const ${entity.name} = await client.${entity.Name}().create({
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
    });
});
exports.ReadmeEntity = ReadmeEntity;
//# sourceMappingURL=ReadmeEntity.js.map