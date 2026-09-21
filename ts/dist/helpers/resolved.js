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
function liveHint(point) {
    return point?.li;
}
function hasLiveScenarios(model) {
    return Object.values(model?.main?.kit?.entity || {}).some((e) => Object.values(e.op || {}).some((o) => (o.points || []).some((p) => liveHint(p))));
}
function pointFacts(ctx$, point) {
    return resolvedFor(ctx$)?.operation(point?.m, point?.o) || {};
}
//# sourceMappingURL=resolved.js.map