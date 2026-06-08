"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeIntro = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
// Per-language intro lives in `project/.sdk/src/cmp/<lang>/ReadmeIntro_<lang>.ts`.
// Each language declares its own tagline and stylistic emphasis (Go's
// `map[string]any` data-flow note, TS's async/await emphasis, etc.).
const ReadmeIntro = (0, jostraca_1.cmp)(function ReadmeIntro(props) {
    const { target, ctx$ } = props;
    const ReadmeIntro_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${target.name}/ReadmeIntro_${target.name}`, { ignore: true });
    if (ReadmeIntro_sdk) {
        ReadmeIntro_sdk['ReadmeIntro']({ target });
    }
});
exports.ReadmeIntro = ReadmeIntro;
//# sourceMappingURL=ReadmeIntro.js.map