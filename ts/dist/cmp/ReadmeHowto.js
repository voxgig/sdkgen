"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeHowto = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const ReadmeHowto = (0, jostraca_1.cmp)(function ReadmeHowto(props) {
    const { target, ctx$ } = props;
    (0, jostraca_1.Content)(`
## How-to guides

`);
    const ReadmeHowto_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${target.name}/ReadmeHowto_${target.name}`, { ignore: true });
    if (ReadmeHowto_sdk) {
        ReadmeHowto_sdk['ReadmeHowto']({ target });
    }
});
exports.ReadmeHowto = ReadmeHowto;
//# sourceMappingURL=ReadmeHowto.js.map