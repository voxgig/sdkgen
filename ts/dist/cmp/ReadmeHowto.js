"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeHowto = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const optional_1 = require("../helpers/optional");
const ReadmeHowto = (0, component_1.cmp)(function ReadmeHowto(props) {
    const { target, ctx$ } = props;
    (0, jostraca_1.Content)(`
## How-to guides

`);
    const ReadmeHowto_sdk = (0, optional_1.optionalComponent)(ctx$, target, 'ReadmeHowto');
    if (ReadmeHowto_sdk) {
        ReadmeHowto_sdk['ReadmeHowto']({ target });
    }
});
exports.ReadmeHowto = ReadmeHowto;
//# sourceMappingURL=ReadmeHowto.js.map