"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXAMPLE_LANGS = void 0;
exports.helperLang = helperLang;
exports.primaryOpCall = primaryOpCall;
exports.idLiteral = idLiteral;
exports.requiredItems = requiredItems;
exports.matchArg = matchArg;
exports.listMatchArg = listMatchArg;
exports.seededList = seededList;
exports.dataArg = dataArg;
exports.javaMap = javaMap;
exports.javaMapOf = javaMapOf;
exports.litFor = litFor;
exports.litPair = litPair;
const canonType_1 = require("./canonType");
const opShape_1 = require("./opShape");
const naming_1 = require("./naming");
// The call languages, in the order a reader is likeliest to want one.
const EXAMPLE_LANGS = ['ts', 'js', 'py', 'go', 'php', 'rb', 'lua'];
exports.EXAMPLE_LANGS = EXAMPLE_LANGS;
// The language of a section shared by every target: its own, else TypeScript.
function helperLang(target) {
    return EXAMPLE_LANGS.includes(target) ? target : 'ts';
}
function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
const NULL_LIT = {
    ts: 'null', js: 'null', py: 'None', php: 'null', rb: 'nil', lua: 'nil', go: 'nil', json: 'null',
};
// A type-correct literal for a canonical type sentinel, in the target language.
function litFor(lang, type, text = 'example') {
    const k = (0, canonType_1.canonScalarKey)(type);
    if ('NULL' === k)
        return NULL_LIT[lang];
    if ('INTEGER' === k || 'NUMBER' === k)
        return '1';
    if ('BOOLEAN' === k)
        return 'py' === lang ? 'True' : ('rb' === lang ? 'true' : 'true');
    if ('ARRAY' === k)
        return ('lua' === lang) ? '{}' : ('go' === lang ? '[]any{}' : '[]');
    // PHP has no `{}` literal (`["data" => {}]` does not parse) and its arrays
    // serve as maps; Ruby and Lua spell an empty map their own way too.
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
    return `"${text}"`;
}
function idLiteral(ent, op, idF) {
    if (null == idF)
        return '"example_id"';
    const item = (0, opShape_1.opRequestShape)(ent, op).items.find((it) => it.name === idF);
    const k = (0, canonType_1.canonScalarKey)(item && item.type);
    return ('INTEGER' === k || 'NUMBER' === k) ? '1' : '"example_id"';
}
function litPair(lang, name, value) {
    switch (lang) {
        case 'py': return `${JSON.stringify(name)}: ${value}`;
        case 'php': return `"${name.replace(/[\\"$]/g, '\\$&')}" => ${value}`;
        case 'rb': return `${JSON.stringify(name).replace(/#(?=[{$@])/g, '\\#')} => ${value}`;
        case 'go': return `${JSON.stringify(name)}: ${value}`;
        case 'json': return `${JSON.stringify(name)}: ${value}`;
        case 'lua': return `${(0, naming_1.luaKey)(name)} = ${value}`;
        default: return `${(0, naming_1.jsKey)(name)}: ${value}`;
    }
}
// The members an example call must give. Points of one route that each need
// a selector of their own share none, so the example takes the point that
// needs fewest when no point is reached by those every point needs.
function requiredItems(ent, op) {
    const needed = (e) => (0, opShape_1.opRequestShape)(e, op).items.filter((it) => !it.optional);
    const items = needed(ent);
    const given = items.map((it) => it.name);
    const points = (0, opShape_1.selectablePoints)(ent?.op?.[op]);
    if (points.length < 2 || points.some((pt) => (0, opShape_1.pointRequires)(pt).every((n) => given.includes(n)))) {
        return items;
    }
    const fewest = points.reduce((a, b) => (0, opShape_1.pointRequires)(b).length < (0, opShape_1.pointRequires)(a).length ? b : a);
    return needed({ ...ent, op: { ...ent.op, [op]: { ...ent.op[op], points: [fewest] } } });
}
function matchArg(lang, ent, op, idF, idLit) {
    const items = requiredItems(ent, op);
    if (0 === items.length)
        return 'go' === lang ? 'nil' : ('json' === lang ? '{}' : '');
    const pairs = items.map((it) => litPair(lang, it.name, it.name === idF ? idLit : litFor(lang, it.type)));
    switch (lang) {
        case 'py': return `{${pairs.join(', ')}}`;
        case 'php': return `[${pairs.join(', ')}]`;
        case 'go': return `map[string]any{${pairs.join(', ')}}`;
        default: return `{ ${pairs.join(', ')} }`;
    }
}
// Java's Map.of has an overload per pair count up to ten, and Map.ofEntries takes any.
function javaMap(count, pkg = '') {
    const many = 10 < count;
    return {
        open: pkg + (many ? 'Map.ofEntries(' : 'Map.of('),
        pair: (kv) => many ? pkg + 'Map.entry(' + kv + ')' : kv,
    };
}
function javaMapOf(pairs, pkg = '') {
    const map = javaMap(pairs.length, pkg);
    return map.open + pairs.map(map.pair).join(', ') + ')';
}
// A list's required route and query parameters.
function listMatchArg(lang, ent) {
    return matchArg(lang, ent, 'list', null, '');
}
// A test-mode list call's pairs and the record seeded for it: the mock gives a
// seeded record its key as `id`, so `id` and the load key are sent as that key.
function seededList(lang, ent, idF, key) {
    const items = [...requiredItems(ent, 'list')]
        .sort((a, b) => (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1));
    const lit = (it) => litFor(lang, it.type, it.name === idF || 'id' === it.name ? key : 'example');
    const record = new Map(null == idF ? [] : [[idF, `"${key}"`]]);
    items.forEach((it) => record.set(it.name, 'id' === it.name ? `"${key}"` : lit(it)));
    return {
        call: items.map((it) => litPair(lang, it.name, lit(it))),
        record: [...record].map(([name, value]) => litPair(lang, name, value)),
    };
}
// An update or patch addressed only by id and route also changes a field.
function dataArg(lang, ent, op, idF) {
    const routed = new Set((0, opShape_1.opParams)(ent?.op?.[op]).map((p) => p.n));
    const addresses = (it) => it.name === idF || it.name === 'id' || routed.has(it.name);
    const items = (0, opShape_1.opRequestShape)(ent, op).items
        .filter((it) => (it.name !== idF && it.name !== 'id') || !it.optional);
    const required = items.filter((it) => !it.optional);
    const changed = ('update' === op || 'patch' === op) && required.every(addresses) ?
        items.filter((it) => it.optional && !addresses(it)).slice(0, 1) : [];
    const chosen = required.length ? [...required, ...changed] : items.slice(0, 3);
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
    const isData = 'create' === op || 'update' === op || 'patch' === op;
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
        arg = listMatchArg(lang, ent);
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