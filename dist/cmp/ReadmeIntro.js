"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeIntro = void 0;
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const ReadmeIntro = (0, jostraca_1.cmp)(function ReadmeIntro(props) {
    const { target } = props;
    const { model } = props.ctx$;
    const desc = model.main.def.desc || '';
    const entity = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.entity`);
    const entityNames = Object.values(entity)
        .filter((e) => e.publish)
        .map((e) => `\`${e.Name}\``);
    (0, jostraca_1.Content)(`
## Introduction

${desc}
`);
    if (entityNames.length > 0) {
        (0, jostraca_1.Content)(`
This SDK provides an entity-oriented interface for the ${model.Name} API.
The following entities are available: ${entityNames.join(', ')}.

`);
    }
    (0, jostraca_1.Content)(`
### Features

- Entity-based API: work with business objects directly.
- Type safe: full TypeScript definitions included.
- Direct HTTP access: call any API endpoint using \`client.direct()\`.
- Testable: built-in test mode with mock support.

`);
});
exports.ReadmeIntro = ReadmeIntro;
//# sourceMappingURL=ReadmeIntro.js.map