"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveStrict = liveStrict;
const types_1 = require("../types");
function liveStrict(model, target) {
    const perTarget = null == target ? undefined :
        model?.main?.[types_1.KIT]?.target?.[target]?.test?.live?.strict;
    const configured = perTarget ?? model?.main?.[types_1.KIT]?.test?.live?.strict;
    return false !== configured;
}
//# sourceMappingURL=testPolicy.js.map