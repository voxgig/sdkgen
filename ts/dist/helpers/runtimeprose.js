"use strict";
// The sentences that state a runtime fact, written once per result style.
// A provider declares its facts (RuntimeFacts); it supplies code tokens and a
// collection noun, never a sentence.
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComment = createComment;
exports.listComment = listComment;
exports.listSentence = listSentence;
exports.loadComment = loadComment;
exports.loadSentence = loadSentence;
const code = (s) => '`' + s + '`';
const article = (s) => /^`?[aeiou]/i.test(s) ? 'an' : 'a';
const a = (s) => article(s) + ' ' + s;
function opName(f, op) {
    const m = f.method[op] || op;
    return code('call' === f.named ? m + '()' : m);
}
function recordClause(f, of) {
    return `${code(f.record)} reads ${of} record` + (f.recordType ? ` (${a(code(f.recordType))})` : '');
}
// What a list returns, and how it fails: one sentence (two for `pair`).
function listSentence(f) {
    const op = opName(f, 'list');
    const many = `${a(f.collection)} of entities, one per record`;
    const rec = recordClause(f, 'an entity\'s');
    switch (f.result) {
        case 'throw':
        case 'raise':
            return `${op} ${f.async ? 'resolves to' : 'returns'} ${many}, and ${f.result}s on failure; ${rec}.`;
        case 'pair':
            return `${op} returns ${code('(value, error)')}: the value is ${many}, and a non-nil ${code(f.errVar)} ` +
                `reports failure. There is no ${code('{ok, data}')} wrapper; ${rec}.`;
        case 'errslot':
            return `${op} returns ${many}, or ${code(f.nullValue)} with ${code(f.errSlot)} set on failure, ` +
                `so check ${code(f.errVar)} after the call; ${rec}.`;
        case 'union':
            return `${op} returns a result whose ${code(f.ok)} is ${many}, and whose ${code(f.err)} ` +
                `reports failure; ${rec}.`;
    }
}
// What a load returns, and how it fails.
function loadSentence(f) {
    const op = opName(f, 'load');
    const rec = recordClause(f, 'its');
    switch (f.result) {
        case 'throw':
        case 'raise':
            return `${op} ${f.async ? 'resolves to' : 'returns'} the entity and ${f.result}s on failure; ${rec}.`;
        case 'pair':
            return `${op} returns ${code('(value, error)')}: the value is the entity, and a non-nil ` +
                `${code(f.errVar)} reports failure; ${rec}.`;
        case 'errslot':
            return `${op} returns the entity, or ${code(f.nullValue)} with ${code(f.errSlot)} ` +
                `set on failure; ${rec}.`;
        case 'union':
            return `${op} returns a result whose ${code(f.ok)} is the entity and whose ` +
                `${code(f.err)} reports failure; ${rec}.`;
    }
}
// The write comments, where a runtime fact changes what a create returns.
function createComment(f) {
    return 'Create — returns the created entity' +
        ('errslot' === f.result ? `, or ${f.nullValue} with ${f.errSlot} set` : '');
}
// A short form for a code comment: how failure is reported.
function failsShort(f) {
    switch (f.result) {
        case 'throw': return 'throws on failure';
        case 'raise': return 'raises on failure';
        case 'pair': return f.errVar + ' is non-nil on failure';
        case 'errslot': return f.errSlot + ' is set on failure';
        case 'union': return f.err + ' on failure';
    }
}
function listComment(f, title) {
    const many = `${a(f.collection.replace(/`/g, ''))} of entities, one per record`;
    return `${title}: ${'union' === f.result ? f.ok + ' is ' : ''}${many}; ${failsShort(f)}`;
}
function loadComment(f, title) {
    return `${title}: ${'union' === f.result ? f.ok + ' is ' : ''}the entity; ${failsShort(f)}`;
}
//# sourceMappingURL=runtimeprose.js.map