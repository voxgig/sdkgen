"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cdTarget = cdTarget;
exports.envLocalAt = envLocalAt;
exports.readerDir = readerDir;
const facts_1 = require("./facts");
// The project directory holds `.env.local`. Out of tree it is the run's path
// back, which an undeclared `sdkrel` leaves to the run.
function envLocalAt(ctx$, target) {
    if ('external' !== (0, facts_1.fact)(target, 'place')) {
        return 'at the project root';
    }
    const back = null != ctx$.sdkrelpath ? ctx$.sdkrelpath : (0, facts_1.fact)(target, 'sdkrel');
    return 'in the SDK project that generates this package' +
        ('' === back ? '' : ', `' + back + '/` from this directory');
}
// A target's directory as its own documents name it: its folder, from the root
// of this repository, or `.` where the reader of its README stands in it.
function readerDir(target) {
    return 'folder' === (0, facts_1.fact)(target, 'place') ? (0, facts_1.fact)(target, 'dir') : '.';
}
function cdTarget(target) {
    const dir = readerDir(target);
    return '.' === dir ? '' : 'cd ' + dir + ' && ';
}
//# sourceMappingURL=readerdir.js.map