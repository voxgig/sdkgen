"use strict";
/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvedFor = resolvedFor;
exports.liveHint = liveHint;
exports.pointFacts = pointFacts;
exports.hasLiveScenarios = hasLiveScenarios;
// The resolved definition apidef published for this build, as a
// component sees it.
function resolvedFor(ctx$) {
    return ctx$?.meta?.apidef;
}
// A point's live-scenario hint. apidef sets `point.live` from the guide; a
// model built before it did carries the hint only inside the contract.
function liveHint(point) {
    if (null == point)
        return undefined;
    if (undefined !== point.live)
        return point.live;
    if (null == point.contract?.json)
        return undefined;
    try {
        return JSON.parse(point.contract.json).live;
    }
    catch {
        return undefined;
    }
}
function hasLiveScenarios(model) {
    return Object.values(model?.main?.kit?.entity || {}).some((e) => Object.values(e.op || {}).some((o) => (o.points || []).some((p) => liveHint(p))));
}
// A point's resolved specification facts. Prefers the capability apidef
// publishes; falls back to the contract for a model built before it, or a
// generation not driven through a model build.
function pointFacts(ctx$, point) {
    const resolved = resolvedFor(ctx$);
    const facts = resolved?.operation(point?.method, point?.orig);
    if (null != facts)
        return facts;
    if (null == point?.contract?.json)
        return {};
    try {
        return JSON.parse(point.contract.json);
    }
    catch {
        return {};
    }
}
//# sourceMappingURL=resolved.js.map