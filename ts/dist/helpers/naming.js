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
// rb/py/lua list the keywords that are illegal as a local-variable binding
// (e.g. a `Self` entity -> `self = client.Self` is a Ruby SyntaxError, an
// `End` entity -> `end = ...` a Lua one). PHP variables are `$`-prefixed so a
// lowercased entity name never collides (only `$this` is special, and no
// entity is named `this`), so PHP is not treated.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isReservedName = isReservedName;
exports.safeVarName = safeVarName;
exports.exampleVarName = exampleVarName;
exports.phpEntityAccessor = phpEntityAccessor;
exports.phpEntityField = phpEntityField;
exports.isRbCoreConstant = isRbCoreConstant;
exports.rbSafeTypeName = rbSafeTypeName;
exports.isSwiftSdkType = isSwiftSdkType;
exports.swiftSafeTypeName = swiftSafeTypeName;
exports.jsProp = jsProp;
exports.jsOptProp = jsOptProp;
exports.jsKey = jsKey;
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
// Ruby keywords — illegal as a local-variable name (e.g. `self`, `end`).
const RB_RESERVED = new Set([
    'alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined?',
    'do', 'else', 'elsif', 'end', 'ensure', 'false', 'for', 'if', 'in',
    'module', 'next', 'nil', 'not', 'or', 'redo', 'rescue', 'retry', 'return',
    'self', 'super', 'then', 'true', 'undef', 'unless', 'until', 'when',
    'while', 'yield', '__FILE__', '__LINE__', '__ENCODING__', 'BEGIN', 'END',
]);
// Python keywords — illegal as a variable name.
const PY_RESERVED = new Set([
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
    'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
    'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
    'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
]);
// Lua keywords — illegal as a variable name. (`self` is NOT reserved in Lua.)
const LUA_RESERVED = new Set([
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
    'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
    'then', 'true', 'until', 'while',
]);
const RESERVED = {
    ts: JS_RESERVED,
    js: JS_RESERVED,
    go: GO_RESERVED,
    rb: RB_RESERVED,
    py: PY_RESERVED,
    lua: LUA_RESERVED,
};
// Ruby CORE CONSTANTS — a different hazard from the keyword sets above.
//
// The keyword sets guard local-variable BINDINGS. This set guards generated
// top-level CONSTANTS. Ruby constants share one namespace with the core
// classes, and reassigning one is not an error — it silently replaces it:
//
//   File = Struct.new(:name)     # ::File is now a Struct
//   File.join('a', 'b')          # NoMethodError — every later caller breaks
//
// The typed model emits `<Name> = Struct.new(...)` per entity, so an API with
// a `/files` collection (entity `File`) used to clobber Ruby's File class and
// take the whole SDK down with it — the generated test runner calls
// `File.join` to locate `.env.local`, so `rb` failed at require time.
//
// Only names Ruby itself defines at top level are listed: reassigning any of
// them breaks working code somewhere. Names that merely LOOK builtin but are
// not core constants (e.g. `Response`, `Record`) are safe and stay untouched,
// which keeps the rename off every SDK that does not actually collide.
const RB_CORE_CONSTANTS = new Set([
    // classes an entity name plausibly lands on
    'Array', 'Binding', 'Class', 'Comparable', 'Complex', 'Data', 'Dir',
    'Encoding', 'Enumerator', 'Exception', 'Fiber', 'File', 'Float', 'Hash',
    'IO', 'Integer', 'Method', 'Module', 'Mutex', 'Numeric', 'Object', 'Proc',
    'Queue', 'Random', 'Range', 'Rational', 'Regexp', 'Set', 'Signal', 'String',
    'Struct', 'Symbol', 'Thread', 'Time', 'UnboundMethod',
    // modules / singletons
    'Enumerable', 'GC', 'Kernel', 'Marshal', 'Math', 'ObjectSpace', 'Process',
    'Warning',
    // the rest of the exception hierarchy an API might name an entity after
    'ArgumentError', 'IndexError', 'IOError', 'KeyError', 'NameError',
    'NotImplementedError', 'RangeError', 'RuntimeError', 'StandardError',
    'StopIteration', 'SystemExit', 'TypeError', 'ZeroDivisionError',
    // literal singletons
    'FalseClass', 'NilClass', 'TrueClass',
]);
// Is `Name` a constant Ruby already defines at top level?
function isRbCoreConstant(Name) {
    return RB_CORE_CONSTANTS.has(Name);
}
// A top-level-safe Ruby constant name for a generated type: the name
// unchanged, unless Ruby core already owns it, in which case `Type` is
// appended (`File` -> `FileType`). Applied ONLY to the bare entity data type
// — the per-op type names always carry a suffix (`FileCreateData`,
// `FileLoadMatch`), which no core constant matches.
//
// The entity ACCESSOR keeps its original name (`client.File(...)`): methods
// and constants live in separate namespaces in Ruby, so the accessor never
// collided and the public surface is unchanged.
function rbSafeTypeName(Name) {
    return isRbCoreConstant(Name) ? Name + 'Type' : Name;
}
// Swift SDK-OWNED TYPE NAMES — a third hazard, distinct from both sets above.
//
// The keyword sets guard local bindings; the Ruby set guards clobbering the
// LANGUAGE's core. This set guards clobbering OUR OWN runtime, because Swift
// has no namespacing WITHIN a module: every type the swift templates declare
// and every generated entity type land in the same module. Two declarations
// of one name is a hard error, not a silent override:
//
//   // core/Response.swift  (template)
//   public final class Response { ... }      // transport wrapper
//   // entity/<Prefix>Types.swift  (generated from a spec schema named Response)
//   public struct Response { ... }
//   -> error: invalid redeclaration of 'Response'
//   -> error: 'Response' is ambiguous for type lookup   (every core file)
//
// Found 2026-08-07: the Hook0 spec has a `Response` schema, which took the
// whole swift target down. `Response` is merely the first collision to be
// hit — every name below is equally exposed.
//
// Sourced by scanning BOTH `tm/swift/Sources/*/` (templates) and
// `src/cmp/swift/*.ts` (components) for top-level type declarations —
// regardless of access level. `internal` is Swift's default and is still
// module-wide, and `open class BaseFeature` is not `public` either, so an
// access-level filter under-collects and silently reopens the bug.
//
// Nested types (a `typealias Element` inside a struct) and the separate Tests
// module (`ReadmeExamplesTest`) do NOT share this namespace and are excluded.
//
// `swift-sdk-types.test.ts` re-derives this list from the templates and fails
// on drift, so adding a public type to a swift template cannot silently
// reopen the bug.
const SWIFT_SDK_TYPES = new Set([
    // core runtime
    'Context', 'Control', 'Entity', 'Operation', 'Point', 'Response', 'Result',
    'SdkConfig', 'Spec', 'Utility',
    // struct library
    'Injection', 'Injector', 'JSON', 'JSONParseError', 'Modify',
    'OrderedDictionary', 'Sentinel', 'Value', 'VList', 'VMap', 'WalkApply',
    // function/callback aliases
    'FetcherFunc', 'Formatter', 'NativeCall0', 'NativeRef', 'SystemFetch',
    // features
    'AuditFeature', 'BaseFeature', 'CacheFeature', 'ClienttrackFeature',
    'DebugFeature', 'IdempotencyFeature', 'LogFeature', 'MetricsBucket',
    'MetricsFeature', 'NetsimFeature', 'PagingFeature', 'ProxyFeature',
    'RatelimitFeature', 'RbacFeature', 'RetryFeature', 'StreamingFeature',
    'TelemetryFeature', 'TestFeature', 'TimeoutFeature',
]);
// Does `Name` collide with a type the swift SDK runtime already declares?
function isSwiftSdkType(Name) {
    return SWIFT_SDK_TYPES.has(Name);
}
// A module-safe Swift type name for a generated type: unchanged, unless the
// swift runtime already declares it, in which case `Type` is appended
// (`Response` -> `ResponseType`). Mirrors rbSafeTypeName deliberately — same
// suffix, same "only rename on an actual collision" rule, so SDKs that do not
// collide are byte-identical to before.
//
// Applied ONLY to the bare entity data type. Per-op type names already carry
// their own suffix (`ResponseCreateData`, `ResponseLoadMatch`) and the entity
// CLASS is separately suffixed (`ResponseEntity`), so neither ever collided.
function swiftSafeTypeName(Name) {
    return isSwiftSdkType(Name) ? Name + 'Type' : Name;
}
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
// Members the generated PHP SDK class already declares (see the php target's
// fragment/Main.fragment.php). An entity accessor or backing field reusing one
// is a FATAL redeclare — PHP will not parse the file, so the SDK yields zero
// working tests rather than a degraded one.
//
// PHP method names are CASE-INSENSITIVE at declaration time, hence the
// lowercased comparison: an entity `graph_ql` derives the accessor `GraphQl()`,
// the same declaration as the SDK's own `graphql()`.
//
// This lives here, not in the php component, because the ACCESSOR NAME has to
// agree across the SDK class and every doc/example component that calls it.
// It did not: MainEntity_php emitted `Test_()` for an entity named `test`
// while eight readme components emitted `Test()`, so the generated examples
// called the static test-mode constructor and died with
// "Call to undefined method <Name>SDK::load()".
const PHP_SDK_METHODS = new Set([
    'construct', '__construct', 'direct', 'get_root_ctx', 'get_utility',
    'graphql', 'op_allowed', 'op_denied', 'options_map', 'prepare',
    'raw_request', 'test',
]);
const PHP_SDK_FIELDS = new Set(['rootctx', 'utility', 'client', 'entctx']);
/** The PHP accessor method for an entity: `$client-><Name>()`. */
function phpEntityAccessor(Name) {
    return PHP_SDK_METHODS.has(String(Name).toLowerCase()) ? Name + '_' : Name;
}
/** The PHP backing field for an entity accessor: `$this->_<name>`. */
function phpEntityField(name) {
    return PHP_SDK_FIELDS.has(String(name).toLowerCase()) ? name + '_' : name;
}
// Symbols a doc example CALLS, which a same-named example variable would
// shadow. The variable is syntactically fine; the example then fails at
// RUNTIME, which is far harder to read than a compile error:
//
//   const consoles = await client.Console().list()
//   for (const console of consoles) { console.log(console) }
//   -> "console.log is not a function"   (nexarda, an API with a Console entity)
//
// Only languages where a plain variable can capture the symbol are listed.
// php is absent on purpose: its variables carry a `$` sigil, so `$echo` can
// never shadow `echo`.
const EXAMPLE_GLOBALS = {
    ts: ['console', 'process', 'globalThis'],
    js: ['console', 'process', 'globalThis'],
    py: ['print'],
    rb: ['puts'],
    lua: ['print'],
    go: ['fmt'],
};
// A variable name for a doc EXAMPLE entity. Doc examples bind the SDK instance
// to `client` (e.g. `const client = ...SDK.test()`), so an entity whose
// lowercased name is also `client` — an API with a `Client` entity — would
// shadow it: `const client = client.Client()...` is self-referential (TS2448/
// TS7022) and breaks the readme_examples type-check. Append `_` to keep the
// example variable distinct from the SDK instance. The same applies to any
// symbol the example itself calls (EXAMPLE_GLOBALS). Also applies the normal
// language-reserved-word guard.
function exampleVarName(name, lang) {
    const v = safeVarName(name, lang);
    if ('client' === v)
        return v + '_';
    if ((EXAMPLE_GLOBALS[lang] || []).includes(v))
        return v + '_';
    return v;
}
// A valid ECMAScript identifier — the only shape `obj.name` can express.
const JS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
// A safe JS/TS property-access expression for a SPEC-DERIVED key: dot
// notation when the key is a valid identifier, bracket notation otherwise.
// OpenAPI path/query parameter names are not constrained to identifiers —
// e.g. Evervault's `/payments/3ds-sessions/{3ds_session_id}` yields
// `3ds_session_id`, and `params.3ds_session_id` is a syntax error (TS1434).
// The other language targets already quote these keys (`params["..."]`);
// this keeps ts/js in parity.
function jsProp(obj, name) {
    return JS_IDENT.test(name) ? `${obj}.${name}` : `${obj}[${JSON.stringify(name)}]`;
}
// A safe JS/TS OBJECT-LITERAL key for a spec-derived field name: bare when
// the name is a valid identifier, single-quoted otherwise. `{ 3ds_session_id:
// 1 }` is a syntax error (TS1351) — doc examples must quote such keys.
function jsKey(name) {
    return JS_IDENT.test(name) ? name : `'${name}'`;
}
// As `jsProp`, but optional-chained: `obj?.name` / `obj?.["3ds_session_id"]`.
function jsOptProp(obj, name) {
    return JS_IDENT.test(name) ? `${obj}?.${name}` : `${obj}?.[${JSON.stringify(name)}]`;
}
//# sourceMappingURL=naming.js.map