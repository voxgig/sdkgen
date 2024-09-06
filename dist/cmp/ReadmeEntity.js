"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeEntity = void 0;
const jostraca_1 = require("jostraca");
const ReadmeEntity = (0, jostraca_1.cmp)(function ReadmeEntity(props) {
    const { build } = props;
    const { model } = props.ctx$;
    const { entity } = model.main.sdk;
    (0, jostraca_1.Code)(`

## Entities
`);
    (0, jostraca_1.each)(entity)
        .filter((entity) => entity.publish)
        .map((entity) => {
        (0, jostraca_1.Code)(`
### Entity: __${entity.Name}__

`);
        (0, jostraca_1.each)(entity.field, (field) => {
            (0, jostraca_1.Code)(`
* __${field.name}__ (${field.type}): ${field.short}
  
`);
        });
    });
});
exports.ReadmeEntity = ReadmeEntity;
//# sourceMappingURL=ReadmeEntity.js.map