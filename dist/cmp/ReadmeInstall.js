"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeInstall = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const ReadmeInstall = (0, jostraca_1.cmp)(function ReadmeInstall(props) {
    const { build, ctx$ } = props;
    (0, jostraca_1.Code)(`
## Install
`);
    // Optional
    const ReadmeInstall_sdk = (0, utility_1.requirePath)(ctx$, `./${build.name}/ReadmeInstall_${build.name}`);
    if (ReadmeInstall_sdk) {
        ReadmeInstall_sdk['ReadmeInstall']({ build });
    }
});
exports.ReadmeInstall = ReadmeInstall;
//# sourceMappingURL=ReadmeInstall.js.map