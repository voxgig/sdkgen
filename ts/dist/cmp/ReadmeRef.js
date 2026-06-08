"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeRef = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
// Per-language REFERENCE.md generator lives in
// `project/.sdk/src/cmp/<lang>/ReadmeRef_<lang>.ts`. Each language emits
// its own constructor signature, op spelling, and code-block fence — a
// shared template would have to inline-switch on every line.
const ReadmeRef = (0, jostraca_1.cmp)(function ReadmeRef(props) {
    const { target, ctx$ } = props;
    const ReadmeRef_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${target.name}/ReadmeRef_${target.name}`, { ignore: true });
    if (ReadmeRef_sdk) {
        ReadmeRef_sdk['ReadmeRef']({ target });
    }
});
exports.ReadmeRef = ReadmeRef;
//# sourceMappingURL=ReadmeRef.js.map