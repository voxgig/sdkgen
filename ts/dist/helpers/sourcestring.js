"use strict";
/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOLLAR = void 0;
exports.sourceString = sourceString;
// How each language writes `$` inside an escape-processing string literal, so
// that vendor text a copy prints never shows jostraca's template pass a `$$`.
// C's hex escape runs on through every hex digit after it, so C and C++ take
// the fixed three-digit octal form.
const DOLLAR = {
    json: '\\u0024',
    ts: '\\u0024',
    js: '\\u0024',
    java: '\\u0024',
    kotlin: '\\u0024',
    scala: '\\u0024',
    csharp: '\\u0024',
    clojure: '\\u0024',
    elixir: '\\u0024',
    go: '\\u0024',
    py: '\\u0024',
    rb: '\\u0024',
    swift: '\\u{24}',
    rust: '\\u{24}',
    lua: '\\u{24}',
    php: '\\u{24}',
    perl: '\\x{24}',
    zig: '\\x24',
    ocaml: '\\x24',
    c: '\\044',
    cpp: '\\044',
};
exports.DOLLAR = DOLLAR;
// The text for the inside of a string literal of `lang`, which the copy
// writes double-quoted, every `$` escaped. A language with no entry fails.
function sourceString(lang, text) {
    const dollar = DOLLAR[lang];
    if (null == dollar) {
        throw new Error(`sdkgen: no string escape for the language '${lang}'`);
    }
    return String(text).replace(/\$/g, dollar);
}
//# sourceMappingURL=sourcestring.js.map