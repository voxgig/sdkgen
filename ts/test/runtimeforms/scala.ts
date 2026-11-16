// How the scala runtime writes things: `def` members of ProjectNameSDK, its
// SdkClient base and companion object, and of the entity and its EntityBase;
// a member may be written with no parameter list (`def toString: String`) or
// be a `val`/`var`; a return after `): Type`.
import type { Forms } from './forms'

const MAIN = 'src/cmp/scala/fragment/Main.fragment.scala'
const BASE = 'src/cmp/scala/fragment/EntityBase.fragment.scala'
const CLIENT = 'tm/scala/core/SdkClient.scala'
const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/scala/fragment/Entity${o}Op.fragment.scala`)

const forms: Forms = {
  files: {
    client: ['src/cmp/scala/fragment/Main.fragment.scala', 'tm/scala/core/SdkClient.scala', 'src/cmp/scala/MainEntity_scala.ts'],
    entity: ['src/cmp/scala/fragment/EntityBase.fragment.scala', 'src/cmp/scala/fragment/Entity.fragment.scala'],
    ops: OPS,
  },
  // The client class's auxiliary constructor, `def this() = this(null)`
  // (Main.fragment.scala:10), is a declaration of ProjectNameSDK too.
  decl: (name) => 'ProjectNameSDK' === name
    ? /^[ \t]*(?:class ProjectNameSDK|def this)(?=\()/m
    : new RegExp(`^[ \\t]*(?:override |final )*(?:def|val|var|class) ${name}(?=[(:\\s=])`, 'm'),
  bare: true,
  param: (p) => {
    const m = /^(\w+)\s*:\s*([^=]+?)\s*(?:=.*)?$/.exec(p.trim())
    return null == m ? { name: '', type: '' } : { name: m[1], type: m[2] }
  },
  optional: (p) => /=|\*$/.test(p),
  returns: (after) => (/^\s*:\s*([^={]+)/.exec(after) || [])[1] || '',
  entityCtor: 'EntyClass',
  opName: /^  override def ([a-z]\w*)\(/gm,
  public: {
    client: /^  (?:override )?(?:def|val|var) ((?!this\b)[a-z]\w*)/gm,
    entity: /^  (?:override )?(?:def|val|var) ([a-z]\w*)/gm,
  },
  undocumented: {
    mode: 'a property holding "live" or "test", which the constructors set',
    features: 'a property holding the installed features, for the pipeline',
    toString: 'the printed form',
    getRootCtx: 'the pipeline\'s root context, for features',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    testOptions: 'the helper testSDK uses to build test-mode options',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance',
  },
  members: {
    options: 'optionsMap', utility: 'getUtility', direct: 'direct', prepare: 'prepare',
    data: 'data', match: 'matchArgs', make: 'make', name: 'getName', stream: 'stream',
  },
  streamKind: (d) => /^Iterator\[/.test(d.returns) ? 'streamSync' : 'stream',
  style: { exception: 'throw', raises: /\bthrow\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'ProjectNameSDK', accessor: '${accessor}' },
  types: { column: 'scala' },
  // How a call is written: `.` for every member, on an instance or the
  // companion object; `new` before the class runs its constructor.
  calls: { on: { instance: ['.'], type: ['.'] } },
  // The runtime spells the java map through its import alias, and names the
  // raw arguments with a 0 suffix.
  typeNames: { 'JMap[String,Object]': 'java.util.Map[String,Object]' },
  renames: { fetchargs0: 'fetchargs' },
  namesWhy: 'the templates import java.util.Map as JMap (Main.fragment.scala:3, SdkClient.scala:3), which a caller does not have, so the page names the type in full; SdkClient.scala:92,160 names the argument fetchargs0 and copies it to fetchargs, the name the page gives',
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, uncompared, cite and exceptions.
  // What the table states besides names, parameters and returns.
  testDecl: 'testSDK',
  // A def with no parameter list is still a method; only val and var are fields.
  field: (d) => /\b(val|var)\s/.test(d.head),
  on: (d) => 'ProjectNameSDK' === d.name || 'EntyClass' === d.name || /\nobject \w+ \{/.test(d.before) ? 'type' : 'instance',
  expect: { testSDK: { on: 'type' } },
  stream: {
    file: "src/cmp/scala/fragment/EntityBase.fragment.scala",
    construct: "new Iterator[Object] {", starts: "on iteration",
    run: "val materialised = runOp(ctx, () => {})",
    draw: "item = if (ready) source.next() else null",
    runs: "before it returns", items: "as the caller iterates",
  },
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    'facts.collection': { file: 'tm/scala/utility/Make.scala', quote: ['val entities = new ArrayList[Object]()', 'result.resdata = entities'] },
    'ref.facts.none': { file: MAIN, quote: 'def testSDK(): ProjectNameSDK = testSDK(null, null)' },
    'ref.facts.container': { file: 'src/cmp/scala/MainEntity_scala.ts', quote: 'def ${accessor}(entopts: java.util.Map[String, Object]): SdkEntity =',
      also: [{ file: MAIN, quote: ['import java.util.{Map => JMap}', 'class ProjectNameSDK(options: JMap[String, Object]) extends SdkClient(options) {'] }] },
    'ref.facts.ctorAlts[0].kind': { value: 'defaults', file: MAIN, quote: 'def this() = this(null)' },
    'ref.facts.client[0].copy': { value: true, file: CLIENT, quote: 'def optionsMap(): JMap[String, Object] = Struct.clone(this.options) match {' },
    // The getter returns what the copy function builds, a new object.
    'ref.facts.client[1].kind': { value: 'utility', file: CLIENT, quote: 'def getUtility(): Utility = this.utility.copy()' },
    'ref.facts.client[1].copy': { value: true, file: CLIENT, quote: 'def getUtility(): Utility = this.utility.copy()',
      also: [{ file: 'tm/scala/core/Utility.scala', quote: ['def copy(): Utility = {\n    val u = new Utility(true)'] }] },
    'ref.facts.entity[0].copy': { value: true, file: BASE, quote: 'Struct.clone(this.dataState)' },
    'ref.facts.entity[1].copy': { value: true, file: BASE, quote: 'Struct.clone(this.matchState)' },
    'ref.facts.prepare.fails': { value: 'style', file: CLIENT, quote: 'throw ctx.makeError("spec_method_allow",' },
    'ref.facts.body.values': { value: 'an `Array[Byte]`, a `java.io.InputStream` or a `String`', file: 'tm/scala/utility/Media.scala',
      quote: ['// Bytes, an InputStream or a String, sent as they are. An InputStream can be', 'case _: Array[Byte] | _: java.io.InputStream => body'],
      also: [{ file: 'tm/scala/utility/Fetcher.scala', quote: ['case b: String if b != "" => bodyPublisher = HttpRequest.BodyPublishers.ofString(b)'] }] },
    'ref.facts.body.once': { value: 'a `java.io.InputStream`', file: 'tm/scala/utility/Media.scala', quote: 'case stream: java.io.InputStream => stream.readAllBytes()' },
    // Searched over the whole scala runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context/i, except: [
      { file: BASE, quote: ['//   - callopts["ctrl"] threads pipeline control and callopts["signal"] (a', '//     () => Boolean that returns true when aborted) is honoured between', 'val signal = opts.get("signal")', 'val aborted: () => Boolean = signal match {', 'if (ended || aborted()) false'],
        why: 'the stream reads callopts.signal between the items it hands over (ref.facts.streamSignal); no operation reads it', fact: 'ref.facts.streamSignal' },
      { file: 'tm/scala/feature/CostFeature.scala', quote: ['// supersedes it loses precision to catastrophic cancellation', '// is set by prePoint, so its absence is the signal.'],
        why: "the cost feature's comments: floating-point 'catastrophic cancellation', and 'the signal' as an English word" },
    ] } },
    // Cited ahead of the provider (brief 7): a later declaration must equal the pinned value.
    'ref.facts.streamSignal': { value: true, file: 'src/cmp/scala/fragment/EntityBase.fragment.scala', quote: ['val signal = opts.get("signal")', 'val aborted: () => Boolean = signal match {'] },
    // The token a Scala reader compares with: `ok` is an Object, and Object == false does not compile.
    'ref.facts.direct.okFalse': { value: 'java.lang.Boolean.FALSE', file: 'tm/scala/core/SdkClient.scala', quote: 'out.put("ok", java.lang.Boolean.FALSE)' },
    // The test client's mock without the test feature, cited ahead: the factory's fallback.
    'ref.facts.testMock': { value: "generated", file: "src/cmp/scala/Config_scala.ts", quote: "case _ => new ${scalapackage}.feature.BaseFeature()" },
  },
}

export { forms }
