"use strict";
/* Copyright (c) 2024-2025 Voxgig, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pointSegments = pointSegments;
exports.pointParts = pointParts;
exports.pointTerminalParam = pointTerminalParam;
exports.pointPathKey = pointPathKey;
// The segment vector, defensively. GraphQL points address the single endpoint
// and carry no path, so an empty vector is normal, not a fault.
function pointSegments(point) {
    const segments = point && point.segments;
    return Array.isArray(segments) ? segments : [];
}
// The braced-string form the SDK runtimes still consume. A `lit` is emitted
// verbatim — including one that contains braces, which apidef leaves literal
// (a compound element like `{a}.{b}` names no single parameter). That is the
// lossiness ADR-003 removed from the model, and it survives here only because
// this is the OLD representation being reconstructed on the way out.
function pointParts(point) {
    return pointSegments(point).map((seg) => null == seg.var ? String(seg.lit ?? '') : '{' + seg.var + '}');
}
// Does the path end in a parameter?
//
// DELIBERATELY asked of the reconstructed part, not of the vector, even
// though the vector states it directly and more accurately.
//
// The same rule runs at RUNTIME, in all 21 languages' makePoint template
// (`0 === last.indexOf('{')` over `parts`), to pick a fallback route when no
// point's `select.exist` matches. Those templates ship standalone, outside
// this package, so the rule is written twice on purpose and BOTH SIDES MUST
// MOVE TOGETHER — see the note in opShape.ts and in each template.
//
// Reading the vector here would break that. A path ending in a LITERAL that
// contains braces (`/reports/{id}.json`) is not a terminal parameter by the
// vector, but every runtime still says it is, because from the reconstructed
// string it cannot tell. Generation-time `ownPoint` would then pick a
// different route than the SDK picks at request time — for the same model.
//
// So this stays bug-compatible with the runtimes until they move onto
// segments, at which point this becomes `null != last.var` and all 21 change
// with it.
function pointTerminalParam(point) {
    const parts = pointParts(point);
    const last = 0 < parts.length ? parts[parts.length - 1] : '';
    return 0 === last.indexOf('{');
}
// Do two points describe the same route? Compares the vectors, so a literal
// containing braces cannot be mistaken for a parameter of the same spelling.
function pointPathKey(point) {
    return pointSegments(point)
        .map((seg) => null == seg.var ? 'l:' + String(seg.lit ?? '') : 'v:' + seg.var)
        .join('/');
}
//# sourceMappingURL=pointPath.js.map