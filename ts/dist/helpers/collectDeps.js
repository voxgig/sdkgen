"use strict";
// Collect target-language dependencies from features and from the target's
// own `deps` block, applying the active-flag semantics that every Package_*.ts
// template was hand-rolling identically:
//
//   - feature deps  : included when `dep.active === true`  (default off)
//   - target  deps  : included when `dep.active !== false` (default on)
//
// The two sources are kept distinct via the `source` field so callers can
// apply their own version defaults / formatting (e.g. go uses `v0.0.0`,
// python `0.0`). The original dep object is exposed as `raw` for callers that
// need extra fields like `dep.replace` (go module replace directives) or
// `dep.kind` (prod/dev/peer).
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectDeps = collectDeps;
const jostraca_1 = require("jostraca");
const apidef_1 = require("@voxgig/apidef");
function collectDeps(model, targetName, targetDeps) {
    const out = [];
    const feature = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.feature`);
    (0, jostraca_1.each)(feature, (f) => {
        const langDeps = f?.deps?.[targetName];
        if (!langDeps)
            return;
        (0, jostraca_1.each)(langDeps, (dep) => {
            if (dep?.active) {
                out.push({
                    name: dep.key$,
                    version: dep.version,
                    source: 'feature',
                    raw: dep,
                });
            }
        });
    });
    if (targetDeps) {
        (0, jostraca_1.each)(targetDeps, (dep) => {
            if (dep?.active !== false) {
                out.push({
                    name: dep.key$,
                    version: dep.version,
                    source: 'target',
                    raw: dep,
                });
            }
        });
    }
    return out;
}
//# sourceMappingURL=collectDeps.js.map