"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isReservedName = isReservedName;
exports.safeVarName = safeVarName;
exports.exampleVarName = exampleVarName;
exports.phpEntityAccessor = phpEntityAccessor;
exports.entityCacheField = entityCacheField;
exports.isRbCoreConstant = isRbCoreConstant;
exports.isRbSdkConstant = isRbSdkConstant;
exports.rbSafeTypeName = rbSafeTypeName;
exports.isSwiftSdkType = isSwiftSdkType;
exports.swiftSafeTypeName = swiftSafeTypeName;
exports.isPhpReservedType = isPhpReservedType;
exports.isPhpSdkClass = isPhpSdkClass;
exports.phpSafeTypeName = phpSafeTypeName;
exports.isTsReservedType = isTsReservedType;
exports.tsSafeTypeName = tsSafeTypeName;
exports.jsProp = jsProp;
exports.jsOptProp = jsOptProp;
exports.jsKey = jsKey;
exports.luaKey = luaKey;
exports.prefixLeadingDigit = prefixLeadingDigit;
const JS_RESERVED = new Set([
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
    'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
    'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
    'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try',
    'typeof', 'var', 'void', 'while', 'with', 'yield',
    'await', 'implements', 'interface', 'let', 'package', 'private',
    'protected', 'public', 'static',
]);
const GO_RESERVED = new Set([
    'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
    'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface',
    'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type',
    'var',
]);
const RB_RESERVED = new Set([
    'alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined?',
    'do', 'else', 'elsif', 'end', 'ensure', 'false', 'for', 'if', 'in',
    'module', 'next', 'nil', 'not', 'or', 'redo', 'rescue', 'retry', 'return',
    'self', 'super', 'then', 'true', 'undef', 'unless', 'until', 'when',
    'while', 'yield', '__FILE__', '__LINE__', '__ENCODING__', 'BEGIN', 'END',
]);
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
const RB_CORE_CONSTANTS = new Set([
    'Array', 'Binding', 'Class', 'Comparable', 'Complex', 'Data', 'Dir',
    'Encoding', 'Enumerator', 'Exception', 'Fiber', 'File', 'Float', 'Hash',
    'IO', 'Integer', 'Method', 'Module', 'Mutex', 'Numeric', 'Object', 'Proc',
    'Queue', 'Random', 'Range', 'Rational', 'Regexp', 'Set', 'Signal', 'String',
    'Struct', 'Symbol', 'Thread', 'Time', 'UnboundMethod',
    'Enumerable', 'GC', 'Kernel', 'Marshal', 'Math', 'ObjectSpace', 'Process',
    'Warning',
    'ArgumentError', 'IndexError', 'IOError', 'KeyError', 'NameError',
    'NotImplementedError', 'RangeError', 'RuntimeError', 'StandardError',
    'StopIteration', 'SystemExit', 'TypeError', 'ZeroDivisionError',
    'FalseClass', 'NilClass', 'TrueClass',
]);
function isRbCoreConstant(Name) {
    return RB_CORE_CONSTANTS.has(Name);
}
const RB_SDK_CONSTANTS = new Set([
    'Helpers', 'Runner', 'Vs',
    'StructRunner', 'StructTestClient', 'StructUtilityTest', 'VoxgigStruct',
    'STRUCT_TEST_JSON_FILE',
    'VoxgigOmni', 'OmniSmokeTest',
    // vendored sekreto and its plugin host — the `secrets` feature's library,
    // shipped only when that feature is selected, but declared at the top
    // level when it is
    'VoxgigSekreto', 'VoxgigPlugin',
    'ExistsTest', 'FeatureCorpusTest', 'FeatureTest', 'NetsimTest',
    'PipelineTest', 'PrimaryUtilityTest', 'ReadmeExamplesTest',
    'SecretsFeatureTest',
    'TestHookFeature', 'TestInitFeature',
]);
// Does `Name` collide with a constant the generated Ruby SDK already declares?
function isRbSdkConstant(Name) {
    return RB_SDK_CONSTANTS.has(Name);
}
function rbSafeTypeName(Name) {
    return isRbCoreConstant(Name) || isRbSdkConstant(Name) ? Name + 'Type' : Name;
}
const SWIFT_SDK_TYPES = new Set([
    'Context', 'Control', 'Entity', 'Operation', 'Point', 'Response', 'Result',
    'SdkConfig', 'SdkSchema', 'Spec', 'Utility',
    'Injection', 'Injector', 'JSON', 'JSONParseError', 'Modify',
    'OrderedDictionary', 'Sentinel', 'Value', 'VList', 'VMap', 'WalkApply',
    'FetcherFunc', 'Formatter', 'NativeCall0', 'NativeRef', 'SystemFetch',
    'ManualRedirectDelegate',
    'AuditFeature', 'BaseFeature', 'CacheFeature', 'ClienttrackFeature',
    'CostBucket', 'CostBudget', 'CostFeature', 'CostPending', 'CostRecord',
    'CostTotal', 'DebugFeature', 'IdempotencyFeature', 'LogFeature',
    'MetricsBucket', 'MetricsFeature', 'NetsimFeature', 'PagingFeature',
    'ProxyFeature', 'RatelimitFeature', 'RbacFeature', 'RetryFeature',
    'SecretsFeature', 'StreamingFeature', 'TelemetryFeature', 'TestFeature',
    'TimeoutFeature', 'ValidateFeature',
]);
function isSwiftSdkType(Name) {
    return SWIFT_SDK_TYPES.has(Name);
}
function swiftSafeTypeName(Name) {
    return isSwiftSdkType(Name) ? Name + 'Type' : Name;
}
const PHP_RESERVED_TYPES = new Set([
    'abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch',
    'class', 'clone', 'const', 'continue', 'declare', 'default', 'do', 'echo',
    'else', 'elseif', 'empty', 'enddeclare', 'endfor', 'endforeach', 'endif',
    'endswitch', 'endwhile', 'enum', 'eval', 'exit', 'extends', 'final',
    'finally', 'fn', 'for', 'foreach', 'function', 'global', 'goto', 'if',
    'implements', 'include', 'include_once', 'instanceof', 'insteadof',
    'interface', 'isset', 'list', 'match', 'namespace', 'new', 'or', 'print',
    'private', 'protected', 'public', 'readonly', 'require', 'require_once',
    'return', 'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use',
    'var', 'while', 'xor', 'yield',
    '__class__', '__dir__', '__file__', '__function__', '__line__',
    '__method__', '__namespace__', '__trait__',
    // reserved as type names / cannot be declared as a class
    'bool', 'false', 'float', 'int', 'iterable', 'mixed', 'never', 'null',
    'numeric', 'object', 'parent', 'resource', 'self', 'string', 'true', 'void',
]);
function isPhpReservedType(Name) {
    return PHP_RESERVED_TYPES.has(String(Name).toLowerCase());
}
const PHP_SDK_CLASSES = new Set([
    'existstest', 'featurecorpustest', 'featuretest', 'netsimtest',
    'omnismoketest', 'pipelinetest', 'primaryutilitytest',
    'readmeexamplestest', 'structutilitytest',
    'ftclient', 'ftclock', 'ftctrl', 'ftentity', 'ftharness', 'ftrecorder',
    'plclient', 'plentity', 'plentityitem',
]);
function isPhpSdkClass(Name) {
    return PHP_SDK_CLASSES.has(String(Name).toLowerCase());
}
function phpSafeTypeName(Name) {
    return isPhpReservedType(Name) || isPhpSdkClass(Name) ? Name + 'Type' : Name;
}
const TS_RESERVED_TYPES = new Set([
    'Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude',
    'Extract', 'NonNullable', 'Parameters', 'ReturnType', 'InstanceType',
    'Awaited', 'ConstructorParameters',
    'Array', 'Object', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Date', 'Error',
    'Function', 'Promise', 'RegExp', 'String', 'Number', 'Boolean', 'Symbol',
    'ArrayBuffer', 'Proxy', 'Reflect', 'JSON', 'Math',
]);
function isTsReservedType(Name) {
    return TS_RESERVED_TYPES.has(Name);
}
// A collision-free TS type name for a generated type: unchanged, unless it
// shadows a TS/JS global, in which case `Type` is appended (`Record` ->
// `RecordType`). Mirrors rbSafeTypeName / swiftSafeTypeName. Applied ONLY
// to the bare entity data type, for the same reason as both of those.
function tsSafeTypeName(Name) {
    return isTsReservedType(Name) ? Name + 'Type' : Name;
}
function isReservedName(name, lang) {
    const set = RESERVED[lang];
    return !!set && set.has(name);
}
// A collision-free variable name for the target language: the name unchanged
// unless it is reserved, in which case a trailing `_` is appended.
function safeVarName(name, lang) {
    return isReservedName(name, lang) ? name + '_' : name;
}
const PHP_SDK_METHODS = new Set([
    'construct', '__construct', 'direct', 'get_root_ctx', 'get_utility',
    'graphql', 'op_allowed', 'op_denied', 'options_map', 'prepare',
    'raw_request', 'test',
]);
// Backing fields the generated SDK object already holds, in EVERY target that
// caches its entity accessors in `_<name>`. php spells it `$this->_utility`
// and lua `self._utility`, but it is one hazard: the accessor's cache slot
// silently aliases the SDK's own field, so `client:Utility()` hands back the
// internal utility object and every entity method on it is nil.
const SDK_FIELDS = new Set(['rootctx', 'utility', 'client', 'entctx']);
function phpEntityAccessor(Name) {
    return PHP_SDK_METHODS.has(String(Name).toLowerCase()) ? Name + '_' : Name;
}
/**
 * The backing field for an entity accessor's cache slot (`$this->_<name>`,
 * `self._<name>`). Target-neutral: the colliding names are the SDK's own
 * fields, which the targets share.
 */
function entityCacheField(name) {
    return SDK_FIELDS.has(String(name).toLowerCase()) ? name + '_' : name;
}
const EXAMPLE_GLOBALS = {
    ts: ['console', 'process', 'globalThis'],
    js: ['console', 'process', 'globalThis'],
    py: ['print'],
    rb: ['puts'],
    lua: ['print'],
    go: ['fmt'],
};
function exampleVarName(name, lang) {
    const v = safeVarName(name, lang);
    if ('client' === v)
        return v + '_';
    if ((EXAMPLE_GLOBALS[lang] || []).includes(v))
        return v + '_';
    return v;
}
function prefixLeadingDigit(s) {
    if (null == s || '' === s)
        return s;
    const first = s.charCodeAt(0);
    if (first < 48 || first > 57)
        return s;
    const letter = s.match(/[a-zA-Z]/);
    const upper = null != letter && letter[0] >= 'A' && letter[0] <= 'Z';
    return (upper ? 'N' : 'n') + s;
}
const JS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function jsProp(obj, name) {
    return JS_IDENT.test(name) ? `${obj}.${name}` : `${obj}[${JSON.stringify(name)}]`;
}
// A safe JS/TS OBJECT-LITERAL key for a spec-derived field name: bare when
// the name is a valid identifier, single-quoted otherwise. `{ 3ds_session_id:
// 1 }` is a syntax error (TS1351) — doc examples must quote such keys.
function jsKey(name) {
    return JS_IDENT.test(name) ? name : `'${name}'`;
}
const LUA_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
function luaKey(name) {
    return LUA_IDENT.test(name) && !isReservedName(name, 'lua')
        ? name
        : `["${name}"]`;
}
// As `jsProp`, but optional-chained: `obj?.name` / `obj?.["3ds_session_id"]`.
function jsOptProp(obj, name) {
    return JS_IDENT.test(name) ? `${obj}?.${name}` : `${obj}?.[${JSON.stringify(name)}]`;
}
//# sourceMappingURL=naming.js.map