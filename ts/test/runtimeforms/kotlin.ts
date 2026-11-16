// How the kotlin runtime writes things: `fun` members of ProjectNameSDK, its
// SdkClient base and companion, and of the entity and its EntityBase; a
// member may be a property (`val`/`var`, no parameter list); a return after
// `): Type`.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/kotlin/fragment/Entity${o}Op.fragment.kt`)
const MODS = '(?:override |open |abstract |public |suspend |inline )*'
const MAIN = 'src/cmp/kotlin/fragment/Main.fragment.kt'
const CLIENT = 'tm/kotlin/core/SdkClient.kt'
const BASE = 'src/cmp/kotlin/fragment/EntityBase.fragment.kt'

const forms: Forms = {
  files: {
    client: ['src/cmp/kotlin/fragment/Main.fragment.kt', 'tm/kotlin/core/SdkClient.kt', 'src/cmp/kotlin/MainEntity_kotlin.ts'],
    entity: ['src/cmp/kotlin/fragment/EntityBase.fragment.kt', 'src/cmp/kotlin/fragment/Entity.fragment.kt'],
    ops: OPS,
  },
  // The client class's secondary constructor, `constructor() : this(null)`, is a
  // second declaration of the class's constructor.
  decl: (name) => new RegExp(`^[ \\t]*(?:${MODS}(?:fun|val|var|class) ${name}${'ProjectNameSDK' === name ? '|constructor' : ''})(?=[(:\\s])`, 'm'),
  bare: true,
  param: (p) => {
    const m = /^(?:vararg\s+)?(\w+)\s*:\s*([^=]+?)\s*(?:=.*)?$/.exec(p.trim())
    return null == m ? { name: '', type: '' } : { name: m[1], type: m[2] }
  },
  optional: (p) => /=|^vararg\b/.test(p),
  // A class header's `: Base(...)` names its superclass, not a return.
  // A secondary constructor's `: this(...)` delegates to the primary one.
  returns: (after, _before, head) => /\bclass\s|\bconstructor$/.test(head) ? '' : (/^\s*:\s*([^={]+)/.exec(after) || [])[1] || '',
  entityCtor: 'EntyClass',
  opName: /^  override fun ([a-z]\w*)\(/gm,
  public: {
    client: /^  (?:override |open )*(?:fun|val|var) ([a-z]\w*)|^    fun ([a-z]\w*)/gm,
    entity: /^  (?:override |open )*(?:fun|val|var) ([a-z]\w*)/gm,
  },
  undocumented: {
    testOptions: 'the helper testSDK uses to build test-mode options',
    mode: 'a property holding "live" or "test", which the constructors set',
    features: 'a property holding the installed features, for the pipeline',
    toString: 'the printed form',
    getRootCtx: 'the pipeline\'s root context, for features',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance',
  },
  members: {
    options: 'optionsMap', utility: 'getUtility', direct: 'direct', prepare: 'prepare',
    data: 'data', match: 'match', make: 'make', name: 'name', stream: 'stream',
  },
  streamKind: (d) => /^Sequence</.test(d.returns) ? 'streamLazy' : 'stream',
  style: { exception: 'throw', raises: /\bthrow\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'ProjectNameSDK', accessor: '${accessor}' },
  types: { column: 'kotlin' },
  // The porter's, from here on.
  // How a call is written: `.` for every member; the class called is its constructor.
  calls: { on: { instance: ['.'], type: ['.'] } },
  // A field is written `name: Type`; anything else is a call.
  sigName: (sig) => /^[\w$]+\s*:/.test(sig) && !sig.includes('(') ? (/^[\w$]+/.exec(sig) as RegExpExecArray)[0]
    : ((/([\w{}$-]+)\s*\(/.exec(sig.replace(/^[^(]*?(->|\.)(?=[\w{}]+\s*\()/, '')) || [])[1] || ''),
  // A return follows the parameter list after `:`, as the runtime writes it.
  sigReturns: (sig) => {
    if (!sig.includes('(')) return ((/:\s*(.+)$/.exec(sig) || [])[1] || '').trim()
    return sig.slice(sig.lastIndexOf(')') + 1).replace(/^\s*:\s*/, '').trim()
  },
  renames: { fetchargsIn: 'fetchargs' },
  namesWhy: 'the client names its raw arguments with an In suffix (SdkClient.kt: fetchargsIn); the page gives them the name the other members use',
  // What the table states besides names, parameters and returns.
  testDecl: 'testSDK',
  on: (d) => 'ProjectNameSDK' === d.name || 'EntyClass' === d.name || (/^    fun /.test(d.head) && /companion object \{/.test(d.before)) ? 'type' : 'instance',
  expect: { testSDK: { on: 'type' }, name: { field: true } },
  stream: {
    file: "src/cmp/kotlin/fragment/EntityBase.fragment.kt",
    construct: "return sequence {", starts: "on iteration",
    run: "val materialised = runOp(ctx) {}",
    draw: "if (source.hasNext() && !aborted()) source.next() else end",
    runs: "before it returns", items: "as the caller iterates",
  },
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    // Cited ahead of the provider (brief 7): a later declaration must equal the pinned value.
    'ref.facts.streamSignal': { value: true, file: 'src/cmp/kotlin/fragment/EntityBase.fragment.kt', quote: ['val signal = opts["signal"]', 'val aborted: () -> Boolean = when (signal) {', 'if (source.hasNext() && !aborted()) source.next() else end'] },
    'ref.facts.direct.okFalse': { value: "false", file: "tm/kotlin/core/SdkClient.kt", quote: "out[\"ok\"] = false" },
    // The test client's mock without the test feature, cited ahead: the factory's fallback.
    'ref.facts.testMock': { value: "generated", file: "src/cmp/kotlin/Config_kotlin.ts", quote: "else -> ${kotlinpackage}.feature.BaseFeature()" },
    // The porter's.
    'facts.collection': { value: 'list', file: 'tm/kotlin/utility/MakeReqRes.kt', quote: ['if ("list" == op.name) {', 'val entities = mutableListOf<Any?>()', 'result.resdata = entities'] },
    'ref.facts.none': { file: MAIN, quote: 'fun testSDK(): ProjectNameSDK = testSDK(null, null)' },
    'ref.facts.container': { file: MAIN, quote: 'class ProjectNameSDK(options: MutableMap<String, Any?>?) : SdkClient(options) {' },
    'ref.facts.client[0].copy': { value: true, file: CLIENT, quote: 'val out = Struct.clone(this.options)' },
    // Decision 13: the getter returns what the copy function builds, a new object.
    'ref.facts.client[1].copy': { value: true, file: CLIENT, quote: 'return this.util.copy()', also: [{ file: 'tm/kotlin/core/Utility.kt', quote: 'fun copy(): Utility {\n    val u = Utility(false)' }] },
    'ref.facts.client[1].kind': { value: 'utility', file: CLIENT, quote: 'return this.util.copy()' },
    'ref.facts.entity[0].copy': { value: true, file: BASE, quote: 'return Struct.clone(this.data)' },
    'ref.facts.entity[1].copy': { value: true, file: BASE, quote: 'return Struct.clone(this.match)' },
    'ref.facts.prepare.fails': { value: 'style', file: CLIENT, quote: 'throw ctx.makeError("spec_method_allow",' },
    'ref.facts.body.values': { value: 'a `ByteArray`, a `String` or an `InputStream`', file: 'tm/kotlin/utility/Media.kt', quote: ['// Bytes, an InputStream or a String, sent as they are. An InputStream can be', 'return if (body is InputStream) body.readBytes() else body'],
      also: [{ file: 'tm/kotlin/utility/Fetcher.kt', quote: ['if (body is String && "" != body) {', '} else if (body is ByteArray) {'] }] },
    'ref.facts.body.once': { value: 'an `InputStream`', file: 'tm/kotlin/utility/Media.kt', quote: ['// read once, so it is read here, before the first attempt, and a retry sends', 'return if (body is InputStream) body.readBytes() else body'] },
    'ref.facts.streamSignalForm': { value: 'a function of no arguments, a `Function0`, that returns `true` once the stream is to end', file: BASE, quote: ['is Function0<*> -> {', '{ (signal as Function0<Any?>).invoke() == true }', '{ false }'] },
    // Searched over the whole kotlin runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context/i, except: [
      { file: BASE, quote: ['*   - callopts["ctrl"] threads pipeline control and callopts["signal"] (a', '*     () -> Boolean that returns true when aborted) is honoured between', 'val signal = opts["signal"]', 'val aborted: () -> Boolean = when (signal) {', '{ (signal as Function0<Any?>).invoke() == true }', 'if (source.hasNext() && !aborted()) source.next() else end'],
        why: 'the stream reads callopts.signal between the items it hands over (ref.facts.streamSignal); no operation reads it', fact: 'ref.facts.streamSignal' },
      { file: 'tm/kotlin/feature/CostFeature.kt', quote: ['// supersedes it loses precision to catastrophic cancellation', '// is set by prePoint, so its absence is the signal.'],
        why: "the cost feature's comments: floating-point 'catastrophic cancellation', and 'the signal' as an English word" },
    ] } },
  },
}

export { forms }
