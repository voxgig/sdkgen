"use strict";
/* Copyright (c) 2024-2025 Voxgig, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pointSegments = pointSegments;
exports.pointParts = pointParts;
exports.pointPlaceholders = pointPlaceholders;
exports.pointTerminalParam = pointTerminalParam;
exports.pointPathKey = pointPathKey;
const utility_1 = require("../utility");
function pointSegments(point) {
    const segments = point && point.s;
    if (!Array.isArray(segments) && (Array.isArray(point?.parts) || Array.isArray(point?.segments))) {
        throw new utility_1.SdkGenError('model: the point for `' + (point?.o || point?.orig || '(unknown path)') +
            '` uses an obsolete path shape. Typed segments belong in `s`. ' +
            'Run `npm run generate` in the project\'s `.sdk` to regenerate the API model.');
    }
    return Array.isArray(segments) ? segments : [];
}
function pointParts(point) {
    return pointSegments(point).map((seg) => null == seg.var ? String(seg.lit ?? '') : '{' + seg.var + '}');
}
// The path parameters a point's URL needs, including a placeholder inside a
// literal segment such as `{version}.mod`.
function pointPlaceholders(point) {
    const names = [];
    for (const seg of pointSegments(point)) {
        if (null != seg.var) {
            names.push(String(seg.var));
        }
        else {
            for (const found of String(seg.lit ?? '').matchAll(/\{([^{}/]+)\}/g)) {
                names.push(found[1]);
            }
        }
    }
    return names;
}
function pointTerminalParam(point) {
    const parts = pointParts(point);
    const last = 0 < parts.length ? parts[parts.length - 1] : '';
    return 0 === last.indexOf('{');
}
function pointPathKey(point) {
    return pointSegments(point)
        .map((seg) => null == seg.var ? 'l:' + String(seg.lit ?? '') : 'v:' + seg.var)
        .join('/');
}
//# sourceMappingURL=pointPath.js.map