"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envLocalAt = envLocalAt;
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
//# sourceMappingURL=readerdir.js.map