"use strict";
// Reserved-word sanitiser for generated doc-example variable names.
//
// A doc example binds a variable named after the lowercased entity name
// (e.g. `const delete = await client.Delete().load()`). When that name is a
// reserved word in the target language the snippet does not compile
// (TS1109/TS1389 for `delete`). `safeVarName` appends `_` to any reserved
// name so the example still reads clearly and compiles.
//
// Only languages whose build/vet actually rejects the name are listed. JS and
// TS share the ECMAScript reserved set (plus the strict-mode / contextual
// words a `const` binding trips on). Go lists its 25 keywords — a var named
// `type`/`func`/`range` fails `go build`; Go builtins like `delete`/`len` are
// NOT keywords and are legal identifiers, so they are intentionally omitted.
// py/php/rb/lua rarely collide on a lowercased entity name and are not treated
// here (add a set if a real collision surfaces).
Object.defineProperty(exports, "__esModule", { value: true });
exports.isReservedName = isReservedName;
exports.safeVarName = safeVarName;
const JS_RESERVED = new Set([
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
    'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
    'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
    'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try',
    'typeof', 'var', 'void', 'while', 'with', 'yield',
    // strict-mode / contextual words that are invalid as a `const`/`let` binding
    'await', 'implements', 'interface', 'let', 'package', 'private',
    'protected', 'public', 'static',
]);
const GO_RESERVED = new Set([
    'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
    'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface',
    'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type',
    'var',
]);
const RESERVED = {
    ts: JS_RESERVED,
    js: JS_RESERVED,
    go: GO_RESERVED,
};
// Is `name` a reserved word (an illegal identifier) in the target language?
function isReservedName(name, lang) {
    const set = RESERVED[lang];
    return !!set && set.has(name);
}
// A collision-free variable name for the target language: the name unchanged
// unless it is reserved, in which case a trailing `_` is appended.
function safeVarName(name, lang) {
    return isReservedName(name, lang) ? name + '_' : name;
}
//# sourceMappingURL=naming.js.map