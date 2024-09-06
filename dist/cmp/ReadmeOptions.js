"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeOptions = void 0;
const jostraca_1 = require("jostraca");
const ReadmeOptions = (0, jostraca_1.cmp)(function ReadmeOptions(props) {
    const { build } = props;
    (0, jostraca_1.Code)(`

## Options

`);
    (0, jostraca_1.each)(build.options)
        .filter((option) => option.publish)
        .map((option) => {
        (0, jostraca_1.Code)(`
* __${option.name} (${option.kind})__: ${option.short}
`);
    });
});
exports.ReadmeOptions = ReadmeOptions;
//# sourceMappingURL=ReadmeOptions.js.map