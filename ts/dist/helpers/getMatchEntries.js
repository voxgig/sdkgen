"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMatchEntries = getMatchEntries;
function getMatchEntries(step) {
    if (!step?.m)
        return [];
    return Object.entries(step.m).filter(([k]) => !k.endsWith('$'));
}
//# sourceMappingURL=getMatchEntries.js.map