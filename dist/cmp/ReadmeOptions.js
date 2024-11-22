"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeOptions = void 0;
const jostraca_1 = require("jostraca");
const ReadmeOptions = (0, jostraca_1.cmp)(function ReadmeOptions(props) {
    const { target } = props;
    (0, jostraca_1.Content)(`

## Options

`);
    (0, jostraca_1.each)(target.options)
        .filter((option) => option.publish)
        .map((option) => {
        (0, jostraca_1.Content)(`
* __${option.name} (${option.kind})__: ${option.short}
`);
    });
});
exports.ReadmeOptions = ReadmeOptions;
//# sourceMappingURL=ReadmeOptions.js.map