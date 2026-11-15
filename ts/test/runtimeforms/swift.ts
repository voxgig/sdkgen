// How the swift runtime writes things: public and open members of
// ProjectNameSDK, EntityBase and the entity class; a parameter as
// `label name: Type = default`; a return after `throws ->` or `->`, which may
// sit on the line after the parameter list.
import type { Forms } from './forms'
import { bracketed } from './forms'

const MAIN = 'src/cmp/swift/fragment/Main.fragment.swift'
const BASE = 'src/cmp/swift/fragment/EntityBase.fragment.swift'
const TYPES = 'tm/swift/Sources/ProjectNameSDK/core/Types.swift'
const OPS =['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/swift/fragment/Entity${o}Op.fragment.swift`)

const forms: Forms = {
  files: {
    client: ['src/cmp/swift/fragment/Main.fragment.swift', 'src/cmp/swift/MainEntity_swift.ts'],
    // Types.swift: the Entity protocol's extension gives data() and matchv()
    // with no argument, which every example's record read calls.
    entity: ['src/cmp/swift/fragment/Entity.fragment.swift', 'src/cmp/swift/fragment/EntityBase.fragment.swift', TYPES],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*(?:(?:public |open |override |static |final )+(?:func |var |let )?|@discardableResult func )${name}(?=[(:\\s])`, 'm'),
  bare: true,
  param: (p) => {
    const m = /^(?:\w+\s+)?(\w+)\s*:\s*([^=]+?)\s*(?:=.*)?$/.exec(p.trim())
    return null == m ? { name: '', type: '' } : { name: m[1], type: m[2] }
  },
  optional: (p) => /=/.test(p),
  returns: (_after, _before, _head, rest) => {
    const m = /^\s*(?:throws\s*)?->\s*((?:\$\{[^}]*\}|[^{\n])+)/.exec(rest) || /^\s*:\s*((?:\$\{[^}]*\}|[^={\n])+)/.exec(rest)
    return null == m ? '' : m[1].trim()
  },
  entityCtor: 'init',
  opName: /^public override func ([a-z]\w*)\(/gm,
  public: {
    client: /^  (?:public |open )(?:static |override )*(?:func|var|let) ([a-z]\w*)/gm,
    entity: /^  (?:public |open )(?:static |override )*(?:func|var|let) ([a-z]\w*)/gm,
  },
  undocumented: {
    mode: 'a property holding "live" or "test", which the constructors set',
    features: 'a property holding the installed features, for the pipeline',
    description: 'the printed form (CustomStringConvertible)',
    debugDescription: 'the debug form (CustomDebugStringConvertible)',
    customMirror: 'the mirror the debugger shows (CustomReflectable)',
    getRootCtx: 'the pipeline\'s root context, for features',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance',
  },
  members: {
    options: 'optionsMap', utility: 'getUtility', direct: 'direct', prepare: 'prepare',
    data: 'data', match: 'matchv', make: 'make', name: 'getName', stream: 'stream',
  },
  streamKind: (d) => /^AsyncStream</.test(d.returns) ? 'streamIterator' : 'stream',
  // An operation returns the entity inside a Value and throws on failure.
  style: { exception: 'throw', raises: /\bthrow\b/, wrapped: (d) => /\bthrows\s*->\s*Value\b/.test(d.rest.slice(0, 200)) },
  // The accessor the record ends with; the unwrap before it is checked whole,
  // against facts.unwrap, by the shared guard.
  record: (rec) => { const m = /\.(\w+)\(\)$/.exec(rec); return null == m ? { name: rec } : { name: m[1], arity: 0 } },
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'init', accessor: '${entity.Name}' },
  types: { column: 'swift' },
  exceptions: {
  },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, uncompared, cite and exceptions.
  // A signature returns after `->`; a `throws` ahead of it is the failure, not the return.
  sigReturns: (sig) => ((/->\s*([^\n]+)$/.exec(sig) || [])[1] || '').trim(),
  renames: { fetchargsIn: 'fetchargs', testoptsIn: 'testopts', sdkoptsIn: 'sdkopts' },
  typeNames: {
    'ProjectNameSdk.VMap': 'VMap', 'ProjectNameSdk.VMap?': 'VMap?', 'ProjectNameSdk.Utility': 'Utility',
    '${Name}EntityBase': 'ProjectNameEntityBase',
  },
  namesWhy: 'the client class spells SDK types module-qualified inside its own body only, so an entity accessor cannot shadow them (Main.fragment.swift:3-15), and names its raw arguments with an In suffix; outside it they are VMap, Utility and the argument names the page gives. MainEntity_swift writes the accessor\'s return as ${Name}EntityBase, which is the ProjectNameEntityBase class of EntityBase.fragment.swift:8',
  cite: {
    'ref.facts.direct.okFalse': { value: "false", file: "src/cmp/swift/fragment/Main.fragment.swift", quote: "r.entries[\"ok\"] = .bool(false)" },
    // The test client's mock without the test feature, cited ahead: the factory's fallback.
    'ref.facts.testMock': { value: "generated", file: "src/cmp/swift/Config_swift.ts", quote: "default: return BaseFeature()" },
    'facts.collection': { file: 'tm/swift/Sources/ProjectNameSDK/Struct/Value.swift', quote: 'case list(VList)' },
    'facts.unwrap': { value: 'asNative as? Entity', file: 'tm/swift/Sources/ProjectNameSDK/feature/ValidateFeature.swift', quote: 'if let ent = record.asNative as? Entity {' },
    'ref.facts.none': { file: MAIN, quote: 'public init(_ optionsIn: ProjectNameSdk.VMap? = nil) {' },
    'ref.facts.setArg': { file: BASE, quote: 'public func data(_ newdata: Value?) -> Value {' },
    'ref.facts.container': { file: MAIN, quote: 'private var options: ProjectNameSdk.VMap = ProjectNameSdk.VMap()' },
    'ref.facts.client[0].copy': { value: true, file: MAIN, quote: 'return clone(.map(options)).asMap ?? ProjectNameSdk.VMap()' },
    'ref.facts.client[1].kind': { value: 'utility', file: MAIN, quote: 'return ProjectNameSdk.Utility.copy(utility)' },
    'ref.facts.entity[0].copy': { value: true, file: BASE, quote: 'return clone(data)' },
    'ref.facts.entity[1].copy': { value: true, file: BASE, quote: 'return clone(.map(match))' },
    'ref.facts.prepare.fails': { value: 'style', file: MAIN, quote: 'public func prepare(_ fetchargsIn: ProjectNameSdk.VMap?) throws -> ProjectNameSdk.VMap {' },
    'ref.facts.body.values': {
      value: 'a `String`, or `Data` or `[UInt8]` wrapped with `.nat`',
      file: 'tm/swift/Sources/ProjectNameSDK/utility/Fetcher.swift',
      quote: 'if let text = body.asString, text != "" {\n    req.httpBody = text.data(using: .utf8)\n    req.setValue("application/json", forHTTPHeaderField: "Content-Type")\n  } else if case .native(let ref) = body {\n    if let data = ref.value as? Data {\n      req.httpBody = data\n    } else if let bytes = ref.value as? [UInt8] {',
      // A text body is the string case; bytes are wrapped by the nat constructor, called as `.nat(...)`.
      also: [{ file: 'tm/swift/Sources/ProjectNameSDK/Struct/Value.swift', quote: ['case string(String)', 'public static func nat(_ v: Any) -> Value { .native(NativeRef(v)) }'] },
        { file: 'tm/swift/Sources/ProjectNameSDK/utility/MakeError.swift', quote: '_ = cleanUtil(ctx, .nat(sdkErr))' }],
    },
    // Searched over the whole swift runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context/i, except: [
      { file: "src/cmp/swift/fragment/EntityBase.fragment.swift", quote: ["//   - callopts[\"ctrl\"] threads pipeline control and callopts[\"signal\"] (a", "//     native () -> Bool that returns true when aborted) is honoured between", "let signal = opts.entries[\"signal\"]?.asNative as? @Sendable () -> Bool", "if let s = signal, s() { break }"],
        why: "the stream reads callopts.signal between the items it hands over (ref.facts.streamSignal); no operation reads it", fact: "ref.facts.streamSignal" },
      { file: "tm/swift/Sources/ProjectNameSDK/Struct/Transform.swift", quote: ["// Throw via fatalError isn't ideal — use a token to signal upstream."],
        why: "the vendored struct library's comment on its own error handling" },
      { file: "tm/swift/Sources/ProjectNameSDK/feature/CostFeature.swift", quote: ["// supersedes it loses precision to catastrophic cancellation", "// is set by prePoint, so its absence is the signal."],
        why: "the cost feature's comments: floating-point 'catastrophic cancellation', and 'the signal' as an English word" },
      { file: "tm/swift/Sources/ProjectNameSDK/feature/TimeoutFeature.swift", quote: ["sem.signal()"],
        why: "the timeout feature's own deadline on the transport, which ends a request by time; no caller can cancel an operation through it" },
      { file: "tm/swift/Sources/ProjectNameSDK/feature/secrets/plugins/Httpjson.swift", quote: ["/// The body is counted as it arrives and the task cancelled one byte over", "dataTask.cancel()", "finished.signal()"],
        why: "the secrets feature's own client for fetching a secret (its HTTP, TLS or process calls), which no operation's request goes through" },
      { file: "tm/swift/Sources/ProjectNameSDK/feature/secrets/plugins/Proc.swift", quote: ["drained.signal()"],
        why: "the secrets feature's own client for fetching a secret (its HTTP, TLS or process calls), which no operation's request goes through" },
      { file: "tm/swift/Sources/ProjectNameSDK/utility/Fetcher.swift", quote: ["box.data = d; box.resp = r; box.err = e; sem.signal()"],
        why: "a DispatchSemaphore's signal(), which wakes the fetch waiting for its response" },
    ] } },
    // The stream reads callopts.signal between items, which no operation does: cited ahead of a provider.
    'ref.facts.streamSignal': { value: true, file: "src/cmp/swift/fragment/EntityBase.fragment.swift", quote: ["let signal = opts.entries[\"signal\"]?.asNative as? @Sendable () -> Bool", "if let s = signal, s() { break }"] },
  },
  // What the table states besides names, parameters and returns.
  testDecl: 'testSDK',
  fails: (d) => { const b = bracketed(d.rest, 0, '('); return null != b && /^\s*throws\b/.test(d.rest.slice(b.end)) ? 'throws' : '' },
  failure: { shows: 'throws', call: 'try' },
  expect: { testSDK: { on: 'type', fails: '' }, prepare: { fails: 'throws' }, stream: { fails: 'throws' }, direct: { fails: '' } },
  stream: {
    file: "src/cmp/swift/fragment/EntityBase.fragment.swift",
    construct: "return AsyncStream { continuation in", starts: "at call",
    run: "let materialised = try runOp(ctx, {})",
    draw: "items = streamFn()",
    runs: "before it returns", items: "before it returns",
  },
  // direct's `ok` on a failure, cited ahead of the provider: a port declares
  // ref.facts.direct.okFalse as this value (in `cite` above).
}

export { forms }
