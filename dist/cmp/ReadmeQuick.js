"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeQuick = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const ReadmeQuick = (0, jostraca_1.cmp)(function ReadmeQuick(props) {
    const { target, ctx$ } = props;
    (0, jostraca_1.Content)(`
## Quick Start

`);
    const ReadmeQuick_sdk = (0, utility_1.requirePath)(ctx$, `./target/${target.name}/ReadmeQuick_${target.name}`, { ignore: true });
    if (ReadmeQuick_sdk) {
        ReadmeQuick_sdk['ReadmeQuick']({ target });
    }
});
exports.ReadmeQuick = ReadmeQuick;
//# sourceMappingURL=ReadmeQuick.js.map