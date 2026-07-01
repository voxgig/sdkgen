"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeEntity = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
// Per-language Entities section lives in
// `project/.sdk/src/cmp/<lang>/ReadmeEntity_<lang>.ts`.
// Each language emits its own create-instance call style and
// op-method spelling (Go's `Load(match, ctrl)` vs TS's `load(match)`).
const ReadmeEntity = (0, jostraca_1.cmp)(function ReadmeEntity(props) {
    const { target, ctx$ } = props;
    const ReadmeEntity_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${target.name}/ReadmeEntity_${target.name}`, { ignore: true });
    if (ReadmeEntity_sdk) {
        ReadmeEntity_sdk['ReadmeEntity']({ target });
    }
});
exports.ReadmeEntity = ReadmeEntity;
//# sourceMappingURL=ReadmeEntity.js.map