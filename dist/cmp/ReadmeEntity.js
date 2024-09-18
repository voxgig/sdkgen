"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeEntity = void 0;
const jostraca_1 = require("jostraca");
const ReadmeEntity = (0, jostraca_1.cmp)(function ReadmeEntity(props) {
    const { ctx$: { model } } = props;
    const { entity } = model.main.sdk;
    (0, jostraca_1.Content)(`

## Entities
`);
    (0, jostraca_1.each)(entity)
        .filter((entity) => entity.publish)
        .map((entity) => {
        (0, jostraca_1.Content)(`
### Entity: __${entity.Name}__

`);
        (0, jostraca_1.each)(entity.field, (field) => {
            (0, jostraca_1.Content)(`
* __${field.name}__ (${field.type}): ${field.short}
  
`);
        });
    });
});
exports.ReadmeEntity = ReadmeEntity;
//# sourceMappingURL=ReadmeEntity.js.map