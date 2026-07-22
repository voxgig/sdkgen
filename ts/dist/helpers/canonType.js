"use strict";
// Canonical type-sentinel -> language primitive type mapper.
//
// SOURCE OF TRUTH for the sentinel set: @voxgig/apidef (`VALID_CANON` +
// `CANON_ONE`, exported from the package). VALID_CANON maps an OpenAPI type
// NAME -> a `$SENTINEL` string (e.g. 'string' -> `$STRING`). The model stores
// those sentinels on every `fields[].type` and op `points[].args.params[].type`.
// A multi-type (OpenAPI `type: [a, b]`) is stored as the ARRAY-shaped union
// sentinel `['`$ONE`', [member, ...]]` (see canonToType below).
//
// This table maps the SENTINEL the other way -> a concrete primitive type in
// each target language, so the typed-model generators (EntityTypes_<lang>.ts)
// and the README type columns (ReadmeRef_<lang>.ts / ReadmeEntity_<lang>.ts)
// can turn the model's field/param sentinels into real language types. It is
// the SINGLE mapping per language: components must not keep local copies.
//
// Kept as a small mirror here (rather than importing VALID_CANON at runtime)
// because apidef is a peer dependency and the table is the INVERSE direction;
// `ts/test/canontype.test.ts` asserts this table covers apidef's exported
// sentinel vocabulary whenever apidef is installed, so drift fails the suite.
//
// KNOWN GAPS (papered over sanely, documented for the port):
//  - Unknown / missing sentinel  -> the language's "any" (never throws).
//  - Array element typing is not in the model: $ARRAY maps to an untyped
//    list/array. `list` ops return T[] via op-kind inference in the op
//    fragment, NOT via a field sentinel.
//  - Object/nested field schemas are not in the corpus: $OBJECT maps to the
//    language's open record/map type.
//  - No enum/format/nullability beyond the `req` flag.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CANON_UNION_JOIN = exports.CANON_ANY = exports.CANON_TYPE = void 0;
exports.canonToType = canonToType;
exports.canonKey = canonKey;
// Bare sentinel key (backticks + leading `$` stripped, upper-cased)
// -> per-language primitive type name.
//
// Column notes:
//  - kotlin: every type is nullable (`?`) — the kotlin emitter drops
//    per-member optionality because the column is already-nullable.
//  - java/scala: boxed JVM types (nullable), so optionality needs no marker.
//  - rust/c/cpp/swift: `Value`/`voxgig_value*`/`VMap` are the vendored
//    dynamic value types those runtimes ship.
const CANON_TYPE = {
    STRING: {
        ts: 'string', js: 'string', py: 'str', php: 'string', rb: 'String',
        lua: 'string', go: 'string', csharp: 'string', java: 'String',
        kotlin: 'String?', scala: 'String', swift: 'String', dart: 'String',
        rust: 'String', c: 'char*', cpp: 'std::string', elixir: 'String.t()',
    },
    INTEGER: {
        ts: 'number', js: 'number', py: 'int', php: 'int', rb: 'Integer',
        lua: 'number', go: 'int', csharp: 'long', java: 'Long',
        kotlin: 'Long?', scala: 'java.lang.Long', swift: 'Int', dart: 'int',
        rust: 'i64', c: 'int64_t', cpp: 'int64_t', elixir: 'integer()',
    },
    NUMBER: {
        ts: 'number', js: 'number', py: 'float', php: 'float', rb: 'Float',
        lua: 'number', go: 'float64', csharp: 'double', java: 'Double',
        kotlin: 'Double?', scala: 'java.lang.Double', swift: 'Double', dart: 'num',
        rust: 'f64', c: 'double', cpp: 'double', elixir: 'float()',
    },
    BOOLEAN: {
        ts: 'boolean', js: 'boolean', py: 'bool', php: 'bool', rb: 'Boolean',
        lua: 'boolean', go: 'bool', csharp: 'bool', java: 'Boolean',
        kotlin: 'Boolean?', scala: 'java.lang.Boolean', swift: 'Bool', dart: 'bool',
        rust: 'bool', c: 'bool', cpp: 'bool', elixir: 'boolean()',
    },
    NULL: {
        ts: 'null', js: 'null', py: 'None', php: 'null', rb: 'NilClass',
        lua: 'nil', go: 'any', csharp: 'object?', java: 'Object',
        kotlin: 'Any?', scala: 'Object', swift: 'Value', dart: 'Object',
        rust: 'Value', c: 'voxgig_value*', cpp: 'Value', elixir: 'nil',
    },
    ARRAY: {
        ts: 'any[]', js: 'Array', py: 'list', php: 'array', rb: 'Array',
        lua: 'table', go: '[]any', csharp: 'List<object?>', java: 'List<Object>',
        kotlin: 'List<Any?>?', scala: 'java.util.List[Object]', swift: '[Value]',
        dart: 'List<dynamic>', rust: 'Vec<Value>', c: 'voxgig_value*',
        cpp: 'std::vector<Value>', elixir: 'list()',
    },
    OBJECT: {
        ts: 'Record<string, any>', js: 'Object', py: 'dict', php: 'array',
        rb: 'Hash', lua: 'table', go: 'map[string]any',
        csharp: 'Dictionary<string, object?>', java: 'Map<String, Object>',
        kotlin: 'Map<String, Any?>?', scala: 'java.util.Map[String, Object]',
        swift: 'VMap', dart: 'Map<String, dynamic>',
        rust: 'std::collections::HashMap<String, Value>', c: 'voxgig_value*',
        cpp: 'std::map<std::string, Value>', elixir: 'map()',
    },
    ANY: {
        ts: 'any', js: '*', py: 'Any', php: 'mixed', rb: 'Object',
        lua: 'any', go: 'any', csharp: 'object?', java: 'Object',
        kotlin: 'Any?', scala: 'Object', swift: 'Value', dart: 'dynamic',
        rust: 'Value', c: 'voxgig_value*', cpp: 'Value', elixir: 'any()',
    },
};
exports.CANON_TYPE = CANON_TYPE;
// Per-language fallback for unknown / missing sentinels.
// js uses JSDoc's `*` (any type); lua uses `any` (LuaLS).
const CANON_ANY = {
    ts: 'any', js: '*', py: 'Any', php: 'mixed', rb: 'Object',
    lua: 'any', go: 'any', csharp: 'object?', java: 'Object',
    kotlin: 'Any?', scala: 'Object', swift: 'Value', dart: 'dynamic',
    rust: 'Value', c: 'voxgig_value*', cpp: 'Value', elixir: 'any()',
};
exports.CANON_ANY = CANON_ANY;
// Union ($ONE) member separator for languages with a native union/sum type
// syntax. Languages absent here have no way to express an anonymous union in
// a type position, so a $ONE sentinel degrades to that language's "any".
// (php 8 unions exist but cannot combine with the `?` optional prefix the
// emitters use, so php deliberately degrades to `mixed`.)
const CANON_UNION_JOIN = {
    ts: ' | ',
    js: '|',
    py: ' | ',
    lua: '|',
    elixir: ' | ',
};
exports.CANON_UNION_JOIN = CANON_UNION_JOIN;
// Normalize a raw sentinel value to its bare upper-case key:
// '`$STRING`' / '$STRING' / 'string' -> 'STRING'.
function canonKey(sentinel) {
    if (null == sentinel) {
        return '';
    }
    return String(sentinel).replace(/[`$]/g, '').trim().toUpperCase();
}
// Map a field/param type sentinel to a target-language primitive type.
// Unknown or missing sentinel -> that language's "any" (never throws).
//
// The union sentinel `['`$ONE`', [member, ...]]` (apidef CANON_ONE, produced
// for OpenAPI multi-types) renders as a joined member union in languages with
// union syntax (see CANON_UNION_JOIN); elsewhere it degrades to "any".
// Members may themselves be unions (handled recursively) or the literal
// 'Any' apidef emits for an unknown member name (canonKey maps it to ANY).
function canonToType(sentinel, lang) {
    const l = lang;
    const fallback = CANON_ANY[l] ?? 'any';
    if (Array.isArray(sentinel)) {
        if ('ONE' === canonKey(sentinel[0]) && Array.isArray(sentinel[1])) {
            const join = CANON_UNION_JOIN[l];
            if (null == join) {
                return fallback;
            }
            const members = sentinel[1].map((m) => canonToType(m, l));
            const uniq = members.filter((m, i) => members.indexOf(m) === i);
            return 0 === uniq.length ? fallback : uniq.join(join);
        }
        return fallback;
    }
    const row = CANON_TYPE[canonKey(sentinel)];
    if (null == row) {
        return fallback;
    }
    return row[l] ?? fallback;
}
//# sourceMappingURL=canonType.js.map