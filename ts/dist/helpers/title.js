"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANG_LABEL = void 0;
exports.langLabel = langLabel;
exports.titleFacts = titleFacts;
// A target's display name when its model declares no title, by the target's
// origin. A test holds each equal to the title its bundled model declares.
const LANG_LABEL = {
    c: 'C',
    clojure: 'Clojure',
    cpp: 'C++',
    csharp: 'C#',
    elixir: 'Elixir',
    go: 'Go',
    'go-cli': 'Go CLI',
    'go-mcp': 'Go MCP server',
    java: 'Java',
    js: 'JavaScript',
    kotlin: 'Kotlin',
    lua: 'Lua',
    ocaml: 'OCaml',
    perl: 'Perl',
    php: 'PHP',
    py: 'Python',
    'py-data': 'Python Data',
    rb: 'Ruby',
    rust: 'Rust',
    scala: 'Scala',
    swift: 'Swift',
    ts: 'TypeScript',
    zig: 'Zig',
};
exports.LANG_LABEL = LANG_LABEL;
function langLabel(target) {
    return LANG_LABEL[target] || target;
}
function given(value) {
    return null != value && '' !== value;
}
// The title fact: the declared title, else the origin's label, else the key.
// Code, not a rule: aontu has no fallback for a member's absent field
// (aontu-lang/aontu#849).
function titleFacts(target) {
    for (const [name, t] of Object.entries(target || {})) {
        const decl = t;
        if (null != decl?.fact && 'object' === typeof decl.fact) {
            decl.fact.title = given(decl.title) ? String(decl.title) :
                (LANG_LABEL[decl.fact.origin] ?? name);
        }
    }
}
//# sourceMappingURL=title.js.map