"use strict";
// The sentences that state a runtime fact, written once per result style.
// A provider declares its facts (RuntimeFacts); it supplies code tokens and a
// collection noun, never a sentence.
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComment = createComment;
exports.failsSentence = failsSentence;
exports.opText = opText;
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
// What each operation does, before what it returns.
const OP_DOES = {
    list: 'List entities matching the given criteria.',
    load: 'Load a single entity matching the given criteria.',
    create: 'Create a new entity with the given data.',
    update: 'Update an existing entity.',
    patch: 'Change part of an existing entity: only the fields given are sent.',
    remove: 'Remove the entity matching the given criteria.',
};
// What an operation's value is.
function opValue(f, op) {
    switch (op) {
        case 'list': return `${a(f.collection)} of entities, one per record`;
        case 'load': return `the entity, whose record ${code(f.record)} reads`;
        case 'remove': return 'the entity, marked as deleted';
        default: return `the ${'patch' === op ? 'patched' : op + 'd'} entity`;
    }
}
// How an operation hands its value back and reports a failure.
function returnClause(f, value) {
    switch (f.result) {
        case 'throw':
        case 'raise':
            return `${f.async ? 'Resolves to' : 'Returns'} ${value}, and ${f.result}s on failure.`;
        case 'pair':
            return `Returns ${value}; ${code(f.errVar)} is non-nil on failure.`;
        case 'errslot':
            return `Returns ${value}, or ${code(f.nullValue)} with ${code(f.errSlot)} set on failure.`;
        case 'union':
            return `The result's ${code(f.ok)} is ${value}, and its ${code(f.err)} reports failure.`;
    }
}
// The reference's description of one operation. `needs`: what a list match
// must give; `idInData`: the id key an update or patch must carry.
function opText(f, op, needs, idInData) {
    const parts = [OP_DOES[op]];
    if ('list' === op) {
        parts.push(0 === needs.length
            ? 'The match is optional: without one, every record is listed.'
            : `The match must include ${needs.map(code).join(' and ')}.`);
    }
    if (null != idInData)
        parts.push(`The data must include the entity id, ${code(idInData)}.`);
    parts.push(returnClause(f, opValue(f, op)));
    return parts.join(' ');
}
// How a failure of a call other than an operation is reported.
function failsSentence(f) {
    switch (f.result) {
        case 'throw':
        case 'raise': return `It ${f.result}s on failure.`;
        case 'pair': return `${code(f.errVar)} is non-nil on failure.`;
        case 'errslot': return `It returns ${code(f.nullValue)} with ${code(f.errSlot)} set on failure.`;
        case 'union': return `Its ${code(f.err)} reports failure.`;
    }
}
//# sourceMappingURL=runtimeprose.js.map