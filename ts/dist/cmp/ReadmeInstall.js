"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeInstall = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const optional_1 = require("../helpers/optional");
const ReadmeInstall = (0, component_1.cmp)(function ReadmeInstall(props) {
    const { target, ctx$ } = props;
    (0, jostraca_1.Content)(`
## Install
`);
    // Optional
    const ReadmeInstall_sdk = (0, optional_1.optionalComponent)(ctx$, target, 'ReadmeInstall');
    if (ReadmeInstall_sdk) {
        ReadmeInstall_sdk['ReadmeInstall']({ target });
    }
});
exports.ReadmeInstall = ReadmeInstall;
//# sourceMappingURL=ReadmeInstall.js.map