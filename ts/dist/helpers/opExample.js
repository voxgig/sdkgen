"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.primaryOpCall = primaryOpCall;
exports.idLiteral = idLiteral;
exports.matchArg = matchArg;
exports.dataArg = dataArg;
exports.litFor = litFor;
const canonType_1 = require("./canonType");
const opShape_1 = require("./opShape");
const naming_1 = require("./naming");
function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
// A type-correct literal for a canonical type sentinel, in the target language.
function litFor(lang, type) {
    const k = (0, canonType_1.canonKey)(type);
    if ('INTEGER' === k || 'NUMBER' === k)
        return '1';
    if ('BOOLEAN' === k)
        return 'py' === lang ? 'True' : ('rb' === lang ? 'true' : 'true');
    if ('ARRAY' === k)
        return ('lua' === lang) ? '{}' : ('go' === lang ? '[]any{}' : '[]');
    // PHP has no `{}` literal — `["data" => {}]` is a parse error, which took
    // the whole generated README down for any entity with an object-typed
    // writable field (dymo-api-introduction, html-creator). Arrays serve as both
    // list and map, so `[]` is the empty object too. Ruby and Lua likewise want
    // their own empty-hash/table spelling rather than JS's.
    if ('OBJECT' === k) {
        if ('go' === lang)
            return 'map[string]any{}';
        if ('php' === lang)
            return '[]';
        if ('rb' === lang)
            return '{}';
        if ('lua' === lang)
            return '{}';
        if ('py' === lang)
            return '{}';
        return '{}';
    }
    return '"example"';
}
function idLiteral(ent, op, idF) {
    if (null == idF)
        return '"example_id"';
    const item = (0, opShape_1.opRequestShape)(ent, op).items.find((it) => it.name === idF);
    const k = (0, canonType_1.canonKey)(item && item.type);
    return ('INTEGER' === k || 'NUMBER' === k) ? '1' : '"example_id"';
}
const JS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const LUA_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
function litPair(lang, name, value) {
    switch (lang) {
        case 'py': return `"${name}": ${value}`;
        case 'php': return `"${name}" => ${value}`;
        case 'rb': return `"${name}" => ${value}`;
        case 'go': return `"${name}": ${value}`;
        case 'lua': return LUA_IDENT.test(name) ?
            `${name} = ${value}` : `["${name}"] = ${value}`;
        default: return JS_IDENT.test(name) ?
            `${name}: ${value}` : `'${name}': ${value}`;
    }
}
function matchArg(lang, ent, op, idF, idLit) {
    const items = (0, opShape_1.opRequestShape)(ent, op).items.filter((it) => !it.optional);
    if (0 === items.length)
        return 'go' === lang ? 'nil' : '';
    const pairs = items.map((it) => litPair(lang, it.name, it.name === idF ? idLit : litFor(lang, it.type)));
    switch (lang) {
        case 'py': return `{${pairs.join(', ')}}`;
        case 'php': return `[${pairs.join(', ')}]`;
        case 'go': return `map[string]any{${pairs.join(', ')}}`;
        default: return `{ ${pairs.join(', ')} }`;
    }
}
function dataArg(lang, ent, op, idF) {
    const items = (0, opShape_1.opRequestShape)(ent, op).items
        .filter((it) => (it.name !== idF && it.name !== 'id') || !it.optional);
    const required = items.filter((it) => !it.optional);
    const chosen = required.length ? required : items.slice(0, 3);
    const pairs = chosen.map((it) => litPair(lang, it.name, litFor(lang, it.type)));
    switch (lang) {
        case 'php': return `[${pairs.join(', ')}]`;
        case 'lua': return `{ ${pairs.join(', ')} }`;
        case 'go': return `map[string]any{${pairs.join(', ')}}`;
        default: return `{ ${pairs.join(', ')} }`;
    }
}
// Render the entity's PRIMARY-op invocation in `lang`. `eName` is the
// Capitalised entity name, `eLower` the variable-safe lowercase name, `op` the
// primary op name. Method spelling / factory syntax follow each language's
// idiom (Go PascalCase + ctrl arg, Lua `:` calls, Ruby paren-less factory).
function primaryOpCall(lang, eName, eLower, op, idF, ent) {
    const isMatch = 'load' === op || 'remove' === op;
    const isList = 'list' === op;
    const isData = 'create' === op || 'update' === op;
    const idLit = idLiteral(ent, op, idF);
    const method = 'go' === lang ? cap(op) : op;
    let factory;
    let sep;
    if ('go' === lang) {
        factory = `client.${eName}(nil)`;
        sep = '.';
    }
    else if ('lua' === lang) {
        factory = `client:${eName}()`;
        sep = ':';
    }
    else if ('rb' === lang) {
        factory = `client.${eName}`;
        sep = '.';
    }
    // php mangles an accessor that would collide with an SDK class member
    // (see phpEntityAccessor); the example has to call the name that is
    // actually declared, or it invokes the SDK's own method instead.
    else if ('php' === lang) {
        factory = `$client->${(0, naming_1.phpEntityAccessor)(eName)}()`;
        sep = '->';
    }
    else {
        factory = `client.${eName}()`;
        sep = '.';
    }
    let arg;
    if (isList) {
        arg = 'go' === lang ? 'nil' : '';
    }
    else if (isMatch) {
        arg = matchArg(lang, ent, op, idF, idLit);
    }
    else if (isData) {
        arg = dataArg(lang, ent, op, idF);
    }
    else {
        arg = 'go' === lang ? 'nil' : '';
    }
    if ('go' === lang) {
        arg = arg + ', nil';
    }
    const expr = `${factory}${sep}${method}(${arg})`;
    const resultVar = isList ? eLower + 's' : eLower;
    return { expr, resultVar, isVoid: 'remove' === op };
}
//# sourceMappingURL=opExample.js.map