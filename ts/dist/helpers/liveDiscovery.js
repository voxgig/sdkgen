"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveDirectDiscovery = liveDirectDiscovery;
// What a live direct load lists to find, the same in every target. Only a path
// parameter the list route does not also take can come from a listed record,
// `id` first; every other one comes from *_ENTID or its example. A route with no
// path parameter, or an example for each, loads directly.
function liveDirectDiscovery(entity, loadParams, listPoint) {
    if (null == listPoint || loadParams.every((p) => null != p.ex)) {
        return undefined;
    }
    const listed = new Set((listPoint.g?.params || []).map((p) => p.n));
    const open = loadParams.filter((p) => !listed.has(p.n));
    const param = (open.find((p) => 'id' === p.n) ?? open[0])?.n;
    if (null == param) {
        return undefined;
    }
    return { param, field: 'id' === param ? (entity?.id?.field || 'id') : param };
}
//# sourceMappingURL=liveDiscovery.js.map