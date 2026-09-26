"use strict";
/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvedFor = resolvedFor;
exports.liveHint = liveHint;
exports.pointFacts = pointFacts;
exports.boundedFacts = boundedFacts;
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
// What the live runner reads; see tm/<lang>/test/live-contract requestContract.
const LIVE_FACT_KEYS = ['protocol', 'requestBody', 'parameters'];
// A resolved operation is a shared GRAPH; JSON.stringify writes a TREE, so a
// schema reached from many places is written once per path. Identity on the
// current path bounds that; maxDepth bounds breadth it cannot catch.
function boundedFacts(facts, maxDepth = 8) {
    const path = new Set();
    const bound = (node, depth) => {
        if (null == node || 'object' !== typeof node)
            return node;
        if (path.has(node))
            return Array.isArray(node) ? [] : {};
        if (depth > maxDepth)
            return Array.isArray(node) ? [] : {};
        path.add(node);
        const out = Array.isArray(node) ? node.map((v) => bound(v, depth + 1))
            : Object.fromEntries(Object.entries(node).map(([k, v]) => [k, bound(v, depth + 1)]));
        path.delete(node);
        return out;
    };
    const kept = {};
    for (const key of LIVE_FACT_KEYS) {
        if (undefined !== facts?.[key])
            kept[key] = bound(facts[key], 0);
    }
    return kept;
}
//# sourceMappingURL=resolved.js.map