"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeIntro = void 0;
const jostraca_1 = require("jostraca");
const optional_1 = require("../helpers/optional");
// Per-language intro lives in `project/.sdk/src/cmp/<lang>/ReadmeIntro_<lang>.ts`.
// Each language declares its own tagline and stylistic emphasis (Go's
// `map[string]any` data-flow note, TS's async/await emphasis, etc.).
const ReadmeIntro = (0, jostraca_1.cmp)(function ReadmeIntro(props) {
    const { target, ctx$ } = props;
    const ReadmeIntro_sdk = (0, optional_1.optionalComponent)(ctx$, target, 'ReadmeIntro');
    if (ReadmeIntro_sdk) {
        ReadmeIntro_sdk['ReadmeIntro']({ target });
    }
});
exports.ReadmeIntro = ReadmeIntro;
//# sourceMappingURL=ReadmeIntro.js.map