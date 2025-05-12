"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeInstall = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const ReadmeInstall = (0, jostraca_1.cmp)(function ReadmeInstall(props) {
    const { target, ctx$ } = props;
    (0, jostraca_1.Content)(`
## Install
`);
    // Optional
    const ReadmeInstall_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${target.name}/ReadmeInstall_${target.name}`, { ignore: true });
    if (ReadmeInstall_sdk) {
        ReadmeInstall_sdk['ReadmeInstall']({ target });
    }
});
exports.ReadmeInstall = ReadmeInstall;
//# sourceMappingURL=ReadmeInstall.js.map