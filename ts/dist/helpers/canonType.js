"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PANDAS_DTYPE = exports.CANON_UNION_JOIN = exports.CANON_ANY = exports.CANON_TYPE = void 0;
exports.canonToType = canonToType;
exports.canonToDtype = canonToDtype;
exports.canonKey = canonKey;
exports.canonScalarKey = canonScalarKey;
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
const CANON_UNION_JOIN = {
    ts: ' | ',
    js: '|',
    py: ' | ',
    lua: '|',
    elixir: ' | ',
};
exports.CANON_UNION_JOIN = CANON_UNION_JOIN;
const PANDAS_DTYPE = {
    STRING: 'string',
    INTEGER: 'Int64',
    NUMBER: 'Float64',
    BOOLEAN: 'boolean',
    // A null-typed column has no values to hold; object is the honest floor.
    NULL: 'object',
    // Arrays and objects stay boxed Python values in an object column. Frames
    // flatten one level of OBJECT into dotted columns before dtypes are
    // applied (see frames.py), so an OBJECT column reaching here is one that
    // survived flattening — genuinely nested, genuinely object.
    ARRAY: 'object',
    OBJECT: 'object',
    ANY: 'object',
};
exports.PANDAS_DTYPE = PANDAS_DTYPE;
// Map a field type sentinel to a pandas dtype string. Unknown / missing /
// union ($ONE) sentinels fall back to 'object' — a union column can hold
// members of different dtypes, so object is the only correct storage.
function canonToDtype(sentinel) {
    if (Array.isArray(sentinel)) {
        return 'object';
    }
    return PANDAS_DTYPE[canonKey(sentinel)] ?? 'object';
}
// Normalize a raw sentinel value to its bare upper-case key:
// '`$STRING`' / '$STRING' / 'string' -> 'STRING'.
function canonKey(sentinel) {
    if (null == sentinel) {
        return '';
    }
    return String(sentinel).replace(/[`$]/g, '').trim().toUpperCase();
}
function canonScalarKey(sentinel) {
    if (Array.isArray(sentinel)) {
        if ('ONE' !== canonKey(sentinel[0]) || !Array.isArray(sentinel[1])) {
            return '';
        }
        let sawNull = false;
        for (const member of sentinel[1]) {
            const key = canonScalarKey(member);
            if ('NULL' === key) {
                sawNull = true;
                continue;
            }
            if ('' !== key) {
                return key;
            }
        }
        return sawNull ? 'NULL' : '';
    }
    return canonKey(sentinel);
}
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