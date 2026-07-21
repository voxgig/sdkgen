"use strict";
// Renders a single, type-correct entity-op CALL for the neutral doc
// components (ReadmeErrors, ReadmeExplanation) that illustrate a convention
// (throw-on-error, stateful entities) with one representative operation.
//
// Two model traps this centralises:
//   1. OP-AWARENESS — the illustrated op must be one the entity actually
//      exposes. A create-only entity has no `load` method, so these components
//      pick the entity's PRIMARY op (entityPrimaryOp) rather than hardcoding
//      `load`, and this module renders whatever op that is.
//   2. TYPE-CORRECT MATCH ID — an entity can carry its id ONLY in the
//      load-match params (no `id` data field). The example id literal is
//      therefore derived from the OP's param type (opRequestShape), not the
//      entity fields, so a numeric match id renders `1` and not `"example_id"`
//      (which would be a TS2322 against a `number` match).
//
// Output is the invocation EXPRESSION and its result binding; the surrounding
// prose / try-catch scaffolding stays in each component's per-language table.
Object.defineProperty(exports, "__esModule", { value: true });
exports.primaryOpCall = primaryOpCall;
exports.idLiteral = idLiteral;
exports.matchArg = matchArg;
exports.dataArg = dataArg;
exports.litFor = litFor;
const canonType_1 = require("./canonType");
const opShape_1 = require("./opShape");
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
    if ('OBJECT' === k)
        return ('go' === lang) ? 'map[string]any{}' : '{}';
    return '"example"';
}
// The example id literal for an op's match key, typed from the op's declared
// param (falling back to the entity field) so a numeric id is never quoted.
function idLiteral(ent, op, idF) {
    if (null == idF)
        return '"example_id"';
    const item = (0, opShape_1.opRequestShape)(ent, op).items.find((it) => it.name === idF);
    const k = (0, canonType_1.canonKey)(item && item.type);
    return ('INTEGER' === k || 'NUMBER' === k) ? '1' : '"example_id"';
}
// Render a match object `{ idF: idLit }` (or empty when the entity has no id
// key) in the target language's object syntax.
// Spec-derived field names are NOT constrained to be identifiers — e.g.
// Evervault's `/payments/3ds-sessions/{3ds_session_id}` yields the match key
// `3ds_session_id`. py/php/rb/go quote every literal key already, but ts/js
// (`{ key: v }`) and lua (`{ key = v }`) write them bare, and a leading digit
// or a `-` makes that a syntax error (TS1351 / Lua "'}' expected"). Quote
// exactly those, leaving ordinary keys in the idiomatic bare form.
const JS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const LUA_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
// A `key<sep>value` literal pair in the target language's object syntax.
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
function matchArg(lang, idF, idLit) {
    if (null == idF)
        return 'go' === lang ? 'nil' : '';
    const p = litPair(lang, idF, idLit);
    switch (lang) {
        case 'py': return `{${p}}`;
        case 'php': return `[${p}]`;
        case 'go': return `map[string]any{${p}}`;
        default: return `{ ${p} }`;
    }
}
// The entity's required writable fields for a create/update body, rendered as
// `key: value` pairs (capped) in the target language's object syntax. Ensures
// the body satisfies a typed CreateData/UpdateData (required fields present).
function dataArg(lang, ent, op, idF) {
    const items = (0, opShape_1.opRequestShape)(ent, op).items
        .filter((it) => it.name !== idF && it.name !== 'id');
    const required = items.filter((it) => !it.optional);
    // ALL required fields must appear (a typed CreateData rejects a partial); cap
    // only the optional fallback used when the op declares no required field.
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
    // Factory + method spelling per language.
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
    else if ('php' === lang) {
        factory = `$client->${eName}()`;
        sep = '->';
    }
    else {
        factory = `client.${eName}()`;
        sep = '.';
    }
    // Argument string per op + language.
    let arg;
    if (isList) {
        arg = 'go' === lang ? 'nil' : '';
    }
    else if (isMatch) {
        arg = matchArg(lang, idF, idLit);
    }
    else if (isData) {
        arg = dataArg(lang, ent, op, idF);
    }
    else {
        arg = 'go' === lang ? 'nil' : '';
    }
    // Go passes a trailing ctrl arg on every entity method.
    if ('go' === lang) {
        arg = arg + ', nil';
    }
    const expr = `${factory}${sep}${method}(${arg})`;
    const resultVar = isList ? eLower + 's' : eLower;
    return { expr, resultVar, isVoid: 'remove' === op };
}
//# sourceMappingURL=opExample.js.map