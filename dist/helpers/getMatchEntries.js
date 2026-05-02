"use strict";
// Return the user-facing entries of a flow step's `match` object. Keys ending
// in `$` are jostraca/aontu metadata sentinels and are skipped.
//
// Identical helper was previously inlined in TestEntity_*.ts and TestDirect_*.ts.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMatchEntries = getMatchEntries;
function getMatchEntries(step) {
    if (!step?.match)
        return [];
    return Object.entries(step.match).filter(([k]) => !k.endsWith('$'));
}
//# sourceMappingURL=getMatchEntries.js.map