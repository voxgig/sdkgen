"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeRef = void 0;
const component_1 = require("../helpers/component");
const optional_1 = require("../helpers/optional");
// Per-language REFERENCE.md generator lives in
// `project/.sdk/src/cmp/<lang>/ReadmeRef_<lang>.ts`. Each language emits
// its own constructor signature, op spelling, and code-block fence — a
// shared template would have to inline-switch on every line.
const ReadmeRef = (0, component_1.cmp)(function ReadmeRef(props) {
    const { target, ctx$ } = props;
    const ReadmeRef_sdk = (0, optional_1.optionalComponent)(ctx$, target, 'ReadmeRef');
    if (ReadmeRef_sdk) {
        // The per-language component owns the REFERENCE.md File, so anything
        // appended out here lands outside it and silently vanishes. The shared
        // feature reference is therefore called from INSIDE each
        // ReadmeRef_<lang>.ts, at the end of its own features section.
        ReadmeRef_sdk['ReadmeRef']({ target });
    }
});
exports.ReadmeRef = ReadmeRef;
//# sourceMappingURL=ReadmeRef.js.map