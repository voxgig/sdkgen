"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMatchEntries = getMatchEntries;
function getMatchEntries(step) {
    if (!step?.match)
        return [];
    return Object.entries(step.match).filter(([k]) => !k.endsWith('$'));
}
//# sourceMappingURL=getMatchEntries.js.map