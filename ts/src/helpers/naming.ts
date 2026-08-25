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

const JS_RESERVED = new Set<string>([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
  'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try',
  'typeof', 'var', 'void', 'while', 'with', 'yield',
  // strict-mode / contextual words that are invalid as a `const`/`let` binding
  'await', 'implements', 'interface', 'let', 'package', 'private',
  'protected', 'public', 'static',
])

const GO_RESERVED = new Set<string>([
  'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
  'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface',
  'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type',
  'var',
])

// Ruby keywords — illegal as a local-variable name (e.g. `self`, `end`).
const RB_RESERVED = new Set<string>([
  'alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined?',
  'do', 'else', 'elsif', 'end', 'ensure', 'false', 'for', 'if', 'in',
  'module', 'next', 'nil', 'not', 'or', 'redo', 'rescue', 'retry', 'return',
  'self', 'super', 'then', 'true', 'undef', 'unless', 'until', 'when',
  'while', 'yield', '__FILE__', '__LINE__', '__ENCODING__', 'BEGIN', 'END',
])

// Python keywords — illegal as a variable name.
const PY_RESERVED = new Set<string>([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
])

// Lua keywords — illegal as a variable name. (`self` is NOT reserved in Lua.)
const LUA_RESERVED = new Set<string>([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while',
])

const RESERVED: Record<string, Set<string>> = {
  ts: JS_RESERVED,
  js: JS_RESERVED,
  go: GO_RESERVED,
  rb: RB_RESERVED,
  py: PY_RESERVED,
  lua: LUA_RESERVED,
}


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
const RB_CORE_CONSTANTS = new Set<string>([
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
])


// Is `Name` a constant Ruby already defines at top level?
function isRbCoreConstant(Name: string): boolean {
  return RB_CORE_CONSTANTS.has(Name)
}


// RUBY SDK-OWNED CONSTANTS — the OTHER half of "already taken".
//
// `RB_CORE_CONSTANTS` guards names the LANGUAGE owns. This guards names the
// GENERATED SCAFFOLDING claims for itself, which is a distinct hazard and the
// one that stayed open: an entity named `Runner` produced `class Runner` in
// `<Sdk>_types.rb`, and the generated harness then does
//
//   Runner = ProjectNameTestRunner        # tm/rb/test/runner.rb
//
// so inside the test process the entity TYPE silently *is* the test runner.
// Ruby warns (`already initialized constant Runner`) and carries on, which is
// why it survived: nothing in the suite exercises the type, so `rb` passed.
// Reported on gitlab-sdk, which has a `Runner` entity (issue #64).
//
// EVERYTHING SHARES ONE NAMESPACE HERE, unlike swift. Swift's Tests module is
// separate from the SDK module, so `SWIFT_SDK_TYPES` can exclude test-only
// declarations. Ruby has no such split — the types file and the test files are
// all required into one process when the suite runs, which is exactly the
// reported symptom — so test-declared names belong in this set.
//
// PREFIXED DECLARATIONS ARE DELIBERATELY ABSENT. `ProjectNameUtility` and
// friends substitute to `<Sdk>Utility`, and a generated entity type is the
// bare entity name, so those cannot collide. Only the UNPREFIXED declarations
// are reachable.
//
// `rb-sdk-constants.test.ts` re-derives this list from the templates AND the
// components and fails on drift — the same discipline as
// `swift-sdk-types.test.ts`, and for the same reason: the first cut of that
// list was collected by hand and missed three names, one of them declared by
// a component rather than a template.
const RB_SDK_CONSTANTS = new Set<string>([
  // module-level aliases the test harness defines for convenience
  'Helpers', 'Runner', 'Vs',
  // vendored struct library and its test scaffolding
  'StructRunner', 'StructTestClient', 'StructUtilityTest', 'VoxgigStruct',
  'STRUCT_TEST_JSON_FILE',
  // the generated/templated test classes
  'ExistsTest', 'FeatureTest', 'NetsimTest', 'PipelineTest',
  'PrimaryUtilityTest', 'ReadmeExamplesTest', 'TestHookFeature',
  'TestInitFeature',
])


// Does `Name` collide with a constant the generated Ruby SDK already declares?
function isRbSdkConstant(Name: string): boolean {
  return RB_SDK_CONSTANTS.has(Name)
}


// A top-level-safe Ruby constant name for a generated type: the name
// unchanged, unless it is ALREADY TAKEN — by Ruby core, or by the SDK's own
// scaffolding — in which case `Type` is appended (`File` -> `FileType`,
// `Runner` -> `RunnerType`). Applied ONLY to the bare entity data type: the
// per-op type names always carry a suffix (`FileCreateData`,
// `FileLoadMatch`), which nothing in either set matches.
//
// The entity ACCESSOR keeps its original name (`client.File(...)`): methods
// and constants live in separate namespaces in Ruby, so the accessor never
// collided and the public surface is unchanged.
function rbSafeTypeName(Name: string): string {
  return isRbCoreConstant(Name) || isRbSdkConstant(Name) ? Name + 'Type' : Name
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
const SWIFT_SDK_TYPES = new Set<string>([
  // core runtime
  'Context', 'Control', 'Entity', 'Operation', 'Point', 'Response', 'Result',
  'SdkConfig', 'Spec', 'Utility',
  // struct library
  'Injection', 'Injector', 'JSON', 'JSONParseError', 'Modify',
  'OrderedDictionary', 'Sentinel', 'Value', 'VList', 'VMap', 'WalkApply',
  // function/callback aliases
  'FetcherFunc', 'Formatter', 'NativeCall0', 'NativeRef', 'SystemFetch',
  // transport plumbing
  'ManualRedirectDelegate',
  // features
  'AuditFeature', 'BaseFeature', 'CacheFeature', 'ClienttrackFeature',
  'CostBucket', 'CostBudget', 'CostFeature', 'CostPending', 'CostRecord',
  'CostTotal', 'DebugFeature', 'IdempotencyFeature', 'LogFeature',
  'MetricsBucket', 'MetricsFeature', 'NetsimFeature', 'PagingFeature',
  'ProxyFeature', 'RatelimitFeature', 'RbacFeature', 'RetryFeature',
  'StreamingFeature', 'TelemetryFeature', 'TestFeature', 'TimeoutFeature',
])


// Does `Name` collide with a type the swift SDK runtime already declares?
function isSwiftSdkType(Name: string): boolean {
  return SWIFT_SDK_TYPES.has(Name)
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
function swiftSafeTypeName(Name: string): string {
  return isSwiftSdkType(Name) ? Name + 'Type' : Name
}


// PHP RESERVED WORDS THAT CANNOT BE A CLASS NAME — a fifth hazard, and the
// only one of the five where the check must be CASE-INSENSITIVE.
//
// PHP's grammar refuses a reserved word where a class name is expected, so a
// spec with a `Namespace` entity emitted a file that does not parse at all:
//
//   /** Namespace entity data model. */
//   class Namespace
//   {
//   }
//   -> PHP Parse error: syntax error, unexpected token "namespace",
//                       expecting identifier
//
// Found on gitlab-sdk (issue #64), and LATENT in the worst way: `types/` is on
// the composer classmap but nothing references the file, so PHP never loads it
// and the php lane passed for as long as the target has existed. It would
// fatal the moment anything required it, and the documented type is unusable
// either way.
//
// CASE-INSENSITIVITY IS THE WHOLE TRICK. Class and function names in PHP are
// case-insensitive, so `Namespace`, `NAMESPACE` and `namespace` are one
// identifier — and the generated name is PascalCase while the reserved word is
// lowercase. A case-sensitive `Set.has('Namespace')` against a lowercase list
// therefore matches NOTHING and reopens the bug silently. Entries are stored
// folded, and the lookup folds too.
//
// Taken from the PHP manual's reserved-words tables wholesale rather than
// grown one collision at a time: the list is fixed by the language, and
// picking from it by hand is how the second `Namespace` gets shipped.
const PHP_RESERVED_TYPES = new Set<string>([
  // keywords
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
  // compile-time constants
  '__class__', '__dir__', '__file__', '__function__', '__line__',
  '__method__', '__namespace__', '__trait__',
  // reserved as type names / cannot be declared as a class
  'bool', 'false', 'float', 'int', 'iterable', 'mixed', 'never', 'null',
  'numeric', 'object', 'parent', 'resource', 'self', 'string', 'true', 'void',
])


// Does `Name` collide with a word PHP reserves, ignoring case as PHP does?
function isPhpReservedType(Name: string): boolean {
  return PHP_RESERVED_TYPES.has(String(Name).toLowerCase())
}


// A declarable PHP class name for a generated type: unchanged, unless PHP
// reserves the word, in which case `Type` is appended (`Namespace` ->
// `NamespaceType`). Mirrors rbSafeTypeName and swiftSafeTypeName deliberately
// — same suffix, same "only rename on an actual collision" rule, so every SDK
// that does not collide is byte-identical to before.
//
// Applied ONLY to the bare entity data class. Per-op type names already carry
// their own suffix (`NamespaceLoadData`, `NamespaceCreateData`), which no
// reserved word matches, and the entity ACCESSOR is a method rather than a
// class — PHP resolves those separately — so the public surface is unchanged.
function phpSafeTypeName(Name: string): string {
  return isPhpReservedType(Name) ? Name + 'Type' : Name
}


// TypeScript GLOBAL TYPE NAMES — a fourth hazard, same shape as the Ruby and
// Swift ones above but for TS/JS builtins, which are in scope everywhere
// with no import. An entity named `Record` emitted `export interface Record
// {...}` and canonToType's own generic-object mapping (`Record<string,
// any>`) then resolved to that flat interface INSIDE THE SAME FILE instead
// of the builtin: `error TS2315: Type 'Record' is not generic` — on a
// field of the `Record` entity itself.
//
// Utility types (`Record`, `Partial`, ...) and common global constructors
// (`Array`, `Map`, `Promise`, ...) that a REST entity name plausibly lands
// on. Mirrors RB_CORE_CONSTANTS / SWIFT_SDK_TYPES: only real builtins are
// listed, so a non-colliding SDK stays byte-identical to before.
const TS_RESERVED_TYPES = new Set<string>([
  // utility types
  'Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude',
  'Extract', 'NonNullable', 'Parameters', 'ReturnType', 'InstanceType',
  'Awaited', 'ConstructorParameters',
  // global constructors / builtins
  'Array', 'Object', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Date', 'Error',
  'Function', 'Promise', 'RegExp', 'String', 'Number', 'Boolean', 'Symbol',
  'ArrayBuffer', 'Proxy', 'Reflect', 'JSON', 'Math',
])


// Does `Name` collide with a TS/JS global type?
function isTsReservedType(Name: string): boolean {
  return TS_RESERVED_TYPES.has(Name)
}


// A collision-free TS type name for a generated type: unchanged, unless it
// shadows a TS/JS global, in which case `Type` is appended (`Record` ->
// `RecordType`). Mirrors rbSafeTypeName / swiftSafeTypeName. Applied ONLY
// to the bare entity data type, for the same reason as both of those.
function tsSafeTypeName(Name: string): string {
  return isTsReservedType(Name) ? Name + 'Type' : Name
}


// Is `name` a reserved word (an illegal identifier) in the target language?
function isReservedName(name: string, lang: string): boolean {
  const set = RESERVED[lang]
  return !!set && set.has(name)
}


// A collision-free variable name for the target language: the name unchanged
// unless it is reserved, in which case a trailing `_` is appended.
function safeVarName(name: string, lang: string): string {
  return isReservedName(name, lang) ? name + '_' : name
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
])

// Backing fields the generated SDK object already holds, in EVERY target that
// caches its entity accessors in `_<name>`. php spells it `$this->_utility`
// and lua `self._utility`, but it is one hazard: the accessor's cache slot
// silently aliases the SDK's own field, so `client:Utility()` hands back the
// internal utility object and every entity method on it is nil.
const SDK_FIELDS = new Set(['rootctx', 'utility', 'client', 'entctx'])


/** The PHP accessor method for an entity: `$client-><Name>()`. */
function phpEntityAccessor(Name: string): string {
  return PHP_SDK_METHODS.has(String(Name).toLowerCase()) ? Name + '_' : Name
}


/**
 * The backing field for an entity accessor's cache slot (`$this->_<name>`,
 * `self._<name>`). Target-neutral: the colliding names are the SDK's own
 * fields, which the targets share.
 */
function entityCacheField(name: string): string {
  return SDK_FIELDS.has(String(name).toLowerCase()) ? name + '_' : name
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
const EXAMPLE_GLOBALS: Record<string, string[]> = {
  ts: ['console', 'process', 'globalThis'],
  js: ['console', 'process', 'globalThis'],
  py: ['print'],
  rb: ['puts'],
  lua: ['print'],
  go: ['fmt'],
}


// A variable name for a doc EXAMPLE entity. Doc examples bind the SDK instance
// to `client` (e.g. `const client = ...SDK.test()`), so an entity whose
// lowercased name is also `client` — an API with a `Client` entity — would
// shadow it: `const client = client.Client()...` is self-referential (TS2448/
// TS7022) and breaks the readme_examples type-check. Append `_` to keep the
// example variable distinct from the SDK instance. The same applies to any
// symbol the example itself calls (EXAMPLE_GLOBALS). Also applies the normal
// language-reserved-word guard.
function exampleVarName(name: string, lang: string): string {
  const v = safeVarName(name, lang)
  if ('client' === v) return v + '_'
  if ((EXAMPLE_GLOBALS[lang] || []).includes(v)) return v + '_'
  return v
}


// A valid ECMAScript identifier — the only shape `obj.name` can express.
const JS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/


// A safe JS/TS property-access expression for a SPEC-DERIVED key: dot
// notation when the key is a valid identifier, bracket notation otherwise.
// OpenAPI path/query parameter names are not constrained to identifiers —
// e.g. Evervault's `/payments/3ds-sessions/{3ds_session_id}` yields
// `3ds_session_id`, and `params.3ds_session_id` is a syntax error (TS1434).
// The other language targets already quote these keys (`params["..."]`);
// this keeps ts/js in parity.
function jsProp(obj: string, name: string): string {
  return JS_IDENT.test(name) ? `${obj}.${name}` : `${obj}[${JSON.stringify(name)}]`
}


// A safe JS/TS OBJECT-LITERAL key for a spec-derived field name: bare when
// the name is a valid identifier, single-quoted otherwise. `{ 3ds_session_id:
// 1 }` is a syntax error (TS1351) — doc examples must quote such keys.
function jsKey(name: string): string {
  return JS_IDENT.test(name) ? name : `'${name}'`
}


// As `jsProp`, but optional-chained: `obj?.name` / `obj?.["3ds_session_id"]`.
function jsOptProp(obj: string, name: string): string {
  return JS_IDENT.test(name) ? `${obj}?.${name}` : `${obj}?.[${JSON.stringify(name)}]`
}


export {
  isReservedName,
  safeVarName,
  exampleVarName,
  phpEntityAccessor,
  entityCacheField,
  isRbCoreConstant,
  isRbSdkConstant,
  rbSafeTypeName,
  isSwiftSdkType,
  swiftSafeTypeName,
  isPhpReservedType,
  phpSafeTypeName,
  isTsReservedType,
  tsSafeTypeName,
  jsProp,
  jsOptProp,
  jsKey,
}
