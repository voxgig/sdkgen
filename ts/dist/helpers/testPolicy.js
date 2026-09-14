"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveStrict = liveStrict;
const types_1 = require("../types");
// Live requests assert success by default. This never enables fail-fast:
// independent tests continue and their framework aggregates the failures.
// An explicit false preserves the legacy exploratory policy for callers
// migrating a fleet; it must not be confused with full live verification.
function liveStrict(model, target) {
    const perTarget = null == target ? undefined :
        model?.main?.[types_1.KIT]?.target?.[target]?.test?.live?.strict;
    const configured = perTarget ?? model?.main?.[types_1.KIT]?.test?.live?.strict;
    return false !== configured;
}
//# sourceMappingURL=testPolicy.js.map