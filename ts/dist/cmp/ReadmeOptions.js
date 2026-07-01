"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeOptions = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
// Per-language Options block lives in
// `project/.sdk/src/cmp/<lang>/ReadmeOptions_<lang>.ts`.
// Each language emits its own constructor-call shape and option-table
// formatting; they share the data source (target.options).
const ReadmeOptions = (0, jostraca_1.cmp)(function ReadmeOptions(props) {
    const { target, ctx$ } = props;
    const ReadmeOptions_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${target.name}/ReadmeOptions_${target.name}`, { ignore: true });
    if (ReadmeOptions_sdk) {
        ReadmeOptions_sdk['ReadmeOptions']({ target });
    }
});
exports.ReadmeOptions = ReadmeOptions;
//# sourceMappingURL=ReadmeOptions.js.map