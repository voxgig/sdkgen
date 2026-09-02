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
// Does the path end in a parameter? The braced form had to ask whether the
// last part started with `{`; the vector states it.
function pointTerminalParam(point) {
    const segments = pointSegments(point);
    return 0 < segments.length && null != segments[segments.length - 1].var;
}
// Do two points describe the same route? Compares the vectors, so a literal
// containing braces cannot be mistaken for a parameter of the same spelling.
function pointPathKey(point) {
    return pointSegments(point)
        .map((seg) => null == seg.var ? 'l:' + String(seg.lit ?? '') : 'v:' + seg.var)
        .join('/');
}
//# sourceMappingURL=pointPath.js.map