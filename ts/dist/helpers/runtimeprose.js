"use strict";
// The sentences that state a runtime fact, written once per result style.
// A provider declares its facts (RuntimeFacts); it supplies code tokens and a
// collection noun, never a sentence.
Object.defineProperty(exports, "__esModule", { value: true });
exports.article = void 0;
exports.createComment = createComment;
exports.failsSentence = failsSentence;
exports.opText = opText;
exports.listComment = listComment;
exports.listSentence = listSentence;
exports.loadComment = loadComment;
exports.loadSentence = loadSentence;
exports.record = record;
exports.writeSentence = writeSentence;
const code = (s) => '`' + s + '`';
// The article before a word: 'an' before a vowel sound. A word that opens
// with a vowel letter but a consonant sound takes 'a' (a utility, a user).
const article = (s) => /^`?(?:u[bcdfgklmnprstvz][aeiou]|uni|use|usu|eu|one\b)/i.test(s) ? 'a'
    : (/^`?[aeiou]/i.test(s) ? 'an' : 'a');
exports.article = article;
const a = (s) => article(s) + ' ' + s;
// An operation named in prose: called, `load()`, where a call with no
// arguments compiles; by its name alone where the language names it bare or
// every call must pass its arguments (arity).
function opName(f, op) {
    const m = f.method[op];
    if (null == m)
        throw new Error(`runtimeprose: no method declared for ${op}`);
    return code('call' === f.named && !(0 < (f.arity || 0)) ? m + '()' : m);
}
// The call with no match: each argument the none value. It is not said to list
// every record: the entity's stored match still applies, and an endpoint may page.
function noMatchCall(f, none) {
    const n = f.arity || 0;
    return code(f.method.list + '(' + Array.from({ length: n }, () => none).join(', ') + ')');
}
// A fact a result style needs, which the provider must declare.
function need(f, key) {
    const v = f[key];
    if (null == v)
        throw new Error(`runtimeprose: result style ${f.result} needs facts.${key}`);
    return v;
}
// The code that reads a record, naming the variable the example binds.
function record(f, bound) {
    return f.record.replace(/\{var\}/g, bound);
}
// A previous-interface provider's record fact holds the unwrap itself.
function unwraps(f) {
    return 'wrapped' === f.result && !(f.served && null == f.unwrap);
}
// Where an operation returns a value holding the entity (wrapped), the unwrap
// that takes it out comes first.
function readsRecord(f, bound, of = 'its') {
    const unwrapped = unwraps(f) ? `${code(need(f, 'unwrap'))} takes the entity out, and ` : '';
    return `${unwrapped}${code(record(f, bound))} reads ${of} record`;
}
function recordClause(f, of, bound) {
    return `${code(record(f, bound))} reads ${of} record` + (f.recordType ? ` (${a(code(f.recordType))})` : '');
}
// The failure verb of the three styles that return the value directly.
function verb(f) {
    return { throw: 'throws', raise: 'raises', die: 'dies', wrapped: 'throws' }[f.result];
}
function pairForm(f) {
    return need(f, 'pairForm');
}
// `non-nil`, from the value the error holds when nothing failed.
function nonNil(f) {
    return 'non-' + need(f, 'noError');
}
// A list's value, naming the type where the language declares one.
function many(f, cls) {
    return null != f.listOf && null != cls
        ? `${a(code(f.listOf.replace(/\{Class\}/g, cls)))}, one entity per record`
        : `${a(f.collection)} of entities, one per record`;
}
// What a list returns, and how it fails: one sentence (two for `pair`).
// `bound`: the variable the example binds an item to.
function listSentence(f, bound) {
    const op = opName(f, 'list');
    const m = many(f);
    const rec = recordClause(f, 'an entity\'s', bound);
    switch (f.result) {
        case 'throw':
        case 'raise':
        case 'die':
            return `${op} ${f.async ? 'resolves to' : 'returns'} ${m}, and ${verb(f)} on failure; ${rec}.`;
        case 'wrapped':
            return `${op} returns a value holding ${m}, and throws on failure; ${code(f.unwrap)} ` +
                `takes one entity out, and ${rec}.`;
        case 'pair':
            return `${op} returns ${code(pairForm(f))}: the value is ${m}, and a ${nonNil(f)} ${code(f.errVar)} ` +
                `reports failure. ${rec}.`;
        case 'errslot':
            return `${op} returns ${m}, or ${code(f.nullValue)} with ${code(f.errSlot)} set on failure, ` +
                `so check ${code(f.errVar)} after the call; ${rec}.`;
        case 'union':
            return `${op} returns a result whose ${code(f.ok)} is ${m}, and whose ${code(f.err)} ` +
                `reports failure; ${rec}.`;
    }
}
// What a load returns, and how it fails.
function loadSentence(f, bound) {
    const op = opName(f, 'load');
    const rec = recordClause(f, 'its', bound);
    switch (f.result) {
        case 'throw':
        case 'raise':
        case 'die':
            return `${op} ${f.async ? 'resolves to' : 'returns'} the entity and ${verb(f)} on failure; ${rec}.`;
        case 'wrapped':
            return `${op} returns a value holding the entity, and throws on failure; ${code(f.unwrap)} ` +
                `takes it out, and ${rec}.`;
        case 'pair':
            return `${op} returns ${code(pairForm(f))}: the value is the entity, and a ${nonNil(f)} ` +
                `${code(f.errVar)} reports failure; ${rec}.`;
        case 'errslot':
            return `${op} returns the entity, or ${code(f.nullValue)} with ${code(f.errSlot)} ` +
                `set on failure; ${rec}.`;
        case 'union':
            return `${op} returns a result whose ${code(f.ok)} is the entity and whose ` +
                `${code(f.err)} reports failure; ${rec}.`;
    }
}
// What the tutorial's writes return, and how each fails: one sentence over
// all of them, in the result style's words. `after`: a list or load step
// came before, whose sentence already named the pair.
function writeSentence(f, ops, after = false) {
    const each = 1 === ops.length ? `${opName(f, ops[0])} returns` : 'Each write returns';
    const what = 'the entity it wrote' + (ops.includes('remove') ? ' (a removed one is marked as deleted)' : '');
    switch (f.result) {
        case 'throw':
        case 'raise':
        case 'die':
            return `${f.async ? each.replace(/returns$/, 'resolves to') : each} ${what}, and ${verb(f)} on failure.`;
        case 'wrapped':
            return `${each} a value holding ${what}, and throws on failure.`;
        case 'pair':
            return `${each} ${code(pairForm(f))}${after ? ' too' : ''}: the value is ${what}, and a ${nonNil(f)} ` +
                `${code(f.errVar)} reports failure.`;
        case 'errslot':
            return `${each} ${what}, or ${code(f.nullValue)} with ${code(f.errSlot)} set on ` +
                `failure, so check ${code(f.errVar)} after each call.`;
        case 'union':
            return `${each} a result whose ${code(f.ok)} is ${what} and whose ${code(f.err)} ` +
                `reports failure.`;
    }
}
// Where a value comes back, for a code comment, in the result style's words.
function carries(f, value) {
    switch (f.result) {
        case 'throw':
        case 'raise':
        case 'die':
            return `${f.async ? 'resolves to' : 'returns'} ${value}`;
        case 'wrapped': return `returns a value holding ${value}`;
        case 'pair': return `the value is ${value}`;
        case 'errslot': return `returns ${value}, or ${f.nullValue} with ${f.errSlot} set`;
        case 'union': return `${f.ok} carries ${value}`;
    }
}
// The create step's comment: what it returns, as the result style says it,
// and how its record is read.
function createComment(f, bound) {
    return `Create — ${carries(f, 'the created entity')}; ` +
        (unwraps(f) ? `${need(f, 'unwrap')} takes it out, and ` : '') + `${record(f, bound)} reads its record`;
}
// A short form for a code comment: how failure is reported.
function failsShort(f) {
    switch (f.result) {
        case 'throw':
        case 'raise':
        case 'die':
        case 'wrapped': return verb(f) + ' on failure';
        case 'pair': return f.errVar + ' is ' + nonNil(f) + ' on failure';
        case 'errslot': return f.errSlot + ' is set on failure';
        case 'union': return f.err + ' holds the failure';
    }
}
function listComment(f, title, cls) {
    const m = many(f, cls).replace(/`/g, '');
    return `${title}: ${'union' === f.result ? f.ok + ' is ' : ''}${m}; ${failsShort(f)}`;
}
function loadComment(f, title, cls) {
    const one = null != f.listOf && null != cls ? `the entity, ${a(cls)}` : 'the entity';
    return `${title}: ${'union' === f.result ? f.ok + ' is ' : ''}${one}; ${failsShort(f)}`;
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
        case 'list': return many(f);
        case 'load': return 'the entity';
        case 'remove': return 'the entity, marked as deleted';
        default: return `the ${'patch' === op ? 'patched' : op + 'd'} entity`;
    }
}
// How an operation hands its value back and reports a failure.
function returnClause(f, value) {
    switch (f.result) {
        case 'throw':
        case 'raise':
        case 'die':
            return `${f.async ? 'Resolves to' : 'Returns'} ${value}, and ${verb(f)} on failure.`;
        case 'wrapped':
            return `Returns a value holding ${value}, and throws on failure.`;
        case 'pair':
            return `Returns ${value}; ${code(f.errVar)} is ${nonNil(f)} on failure.`;
        case 'errslot':
            return `Returns ${value}, or ${code(f.nullValue)} with ${code(f.errSlot)} set on failure.`;
        case 'union':
            return `The result's ${code(f.ok)} is ${value}, and its ${code(f.err)} reports failure.`;
    }
}
// The reference's description of one operation. `needs`: what a list match
// must give; `idInData`: the id key an update or patch must carry; `bound`:
// the variable the example binds the result to.
// `ref`: what the reference page knows besides: the none value, and how a
// removed entity's mark is read ({var} the entity).
function opText(f, op, needs, idInData, bound, ref = {}) {
    const parts = [OP_DOES[op]];
    if ('list' === op) {
        parts.push(0 === needs.length
            ? ('call' === f.named && null != f.arity && null != ref.none
                ? `The match is optional; a call without one is ${noMatchCall(f, ref.none)}.`
                : 'The match is optional.')
            : `The match must include ${needs.map(code).join(' and ')}.`);
    }
    if (null != idInData)
        parts.push(`The data must include the entity id, ${code(idInData)}, unless the entity already holds it.`);
    parts.push(returnClause(f, opValue(f, op)));
    if ('remove' === op && null != ref.deleted) {
        parts.push(`${code(ref.deleted.replace(/\{var\}/g, bound))} reads the mark.`);
    }
    // Every single-entity result says how its record is read: the reference's
    // examples print none of them (the majority shape), so the sentence keeps it.
    if ('remove' === op && ref.removeKeeps) {
        parts.push(`It reads no record from the response: ${code(record(f, bound))} still reads the data the entity held.`);
    }
    else if ('list' !== op)
        parts.push(readsRecord(f, bound) + '.');
    return parts.join(' ');
}
// How a failure of a call other than an operation is reported.
function failsSentence(f) {
    switch (f.result) {
        case 'throw':
        case 'raise':
        case 'die':
        case 'wrapped': return `It ${verb(f)} on failure.`;
        case 'pair': return `${code(f.errVar)} is ${nonNil(f)} on failure.`;
        case 'errslot': return `It returns ${code(f.nullValue)} with ${code(f.errSlot)} set on failure.`;
        case 'union': return `Its ${code(f.err)} reports failure.`;
    }
}
//# sourceMappingURL=runtimeprose.js.map