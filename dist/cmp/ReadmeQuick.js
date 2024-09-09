"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeQuick = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const ReadmeQuick = (0, jostraca_1.cmp)(function ReadmeQuick(props) {
    const { build, ctx$ } = props;
    (0, jostraca_1.Code)(`
## Quick Start

`);
    const ReadmeQuick_sdk = (0, utility_1.requirePath)(ctx$, `./${build.name}/ReadmeQuick_${build.name}`);
    if (ReadmeQuick_sdk) {
        ReadmeQuick_sdk['ReadmeQuick']({ build });
    }
});
exports.ReadmeQuick = ReadmeQuick;
//# sourceMappingURL=ReadmeQuick.js.map