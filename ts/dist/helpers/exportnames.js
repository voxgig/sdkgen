"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportedNames = exportedNames;
exports.missingExports = missingExports;
exports.isTypeScript = isTypeScript;
// Read lexically, from lines that start in the first column: the components
// also hold generated TypeScript in template strings, and its interpolated
// names never parse as identifiers here.
const DECLARED_RE = /^export\s+(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)(?=[\s(<:=;,]|$)/gm;
const LISTED_RE = /^export\s+(?:type\s+)?\{([^}]*)\}/gm;
const NAME_RE = /^[A-Za-z_$][\w$]*$/;
function exportedNames(src) {
    const names = new Set();
    for (const m of src.matchAll(DECLARED_RE)) {
        names.add(m[1]);
    }
    for (const m of src.matchAll(LISTED_RE)) {
        for (const part of m[1].split(',')) {
            const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()?.trim() ?? '';
            if (NAME_RE.test(name)) {
                names.add(name);
            }
        }
    }
    return names;
}
// What another copy may import from `incoming` that `local` does not export.
function missingExports(incoming, local) {
    const have = exportedNames(local);
    return [...exportedNames(incoming)].filter((name) => !have.has(name)).sort();
}
function isTypeScript(rel) {
    return rel.endsWith('.ts');
}
//# sourceMappingURL=exportnames.js.map