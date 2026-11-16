// How the java runtime writes things: public methods of ProjectNameSDK and
// its SdkClient base, and of the entity and its EntityBase; the type ahead of
// the name. Java has no default arguments: an argument that may be left out
// is an overload, so a declaration is matched by its parameter count.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/java/fragment/Entity${o}Op.fragment.java`)
const MODS = '(?:public |static |final |synchronized |abstract )+'
const MAIN = 'src/cmp/java/fragment/Main.fragment.java'
const BASE = 'src/cmp/java/fragment/EntityBase.fragment.java'
const CLIENT = 'tm/java/core/SdkClient.java'
const STRUCT = 'tm/java/utility/struct/Struct.java'

const forms: Forms = {
  files: {
    client: ['src/cmp/java/fragment/Main.fragment.java', 'tm/java/core/SdkClient.java', 'src/cmp/java/MainEntity_java.ts'],
    entity: ['src/cmp/java/fragment/EntityBase.fragment.java', 'src/cmp/java/fragment/Entity.fragment.java'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*${MODS}(?:[\\w.<>?,\\[\\]$\\{\\}]+(?:<[^>]*>)?\\s+)?${name}(?=\\()`, 'm'),
  param: (p) => {
    const m = /^(?:final\s+)?(.*\S)\s+(\w+)$/.exec(p.trim())
    return null == m ? { name: '', type: '' } : { name: m[2], type: m[1] }
  },
  optional: (p) => /\.\.\./.test(p),
  returns: (_after, _before, head) => (new RegExp(`^[ \\t]*${MODS}(.*?)\\s+[\\w$\\{\\}.]+$`).exec(head) || [])[1] || '',
  entityCtor: 'EntyClass',
  opName: /^  public Object ([a-z]\w*)\(/gm,
  public: {
    client: /^  public (?:static |final |synchronized )*[^=(\n]*?\s([a-z]\w*)\(/gm,
    entity: /^  public (?:static |final |synchronized )*[^=(\n]*?\s([a-z]\w*)\(/gm,
  },
  undocumented: {
    getRootCtx: 'the pipeline\'s root context, for features',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance',
  },
  members: {
    options: 'optionsMap', utility: 'getUtility', direct: 'direct', prepare: 'prepare',
    data: 'data', match: 'match', make: 'make', name: 'getName', stream: 'stream',
  },
  streamKind: (d) => /^Stream</.test(d.returns) ? 'streamLazy' : 'stream',
  style: { exception: 'throw', raises: /\bthrow\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'ProjectNameSDK', accessor: '${accessor}' },
  types: { column: 'java' },
  // How a call is written: `.` on an instance and on the class; `new` runs
  // the constructor, which the class declares under its own name.
  calls: { on: { instance: ['.'], type: ['.'] } },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, uncompared, cite and exceptions.
  // A signature is written as Java declares it, the return type ahead of the
  // name and `static` ahead of that for a member of the class.
  // A field is written as its type and name, with no parameter list.
  sigName: (sig) => ((sig.includes('(') ? /([\w{}$-]+)\s*\(/ : /([\w{}$]+)\s*$/).exec(sig) || [])[1] || '',
  sigReturns: (sig) => ((/^\s*(?:static\s+)?(.*?)\s*[\w{}$]+\s*\(/.exec(sig) || [])[1] || '').trim(),
  // What the table states besides names, parameters and returns.
  testDecl: 'testSDK',
  expect: { testSDK: { on: 'type' } },
  stream: {
    file: "src/cmp/java/fragment/EntityBase.fragment.java",
    construct: "Iterator<Object> guarded = new Iterator<Object>() {", starts: "on iteration",
    run: "Object materialised = runOp(ctx, () -> {});",
    draw: "item = ready ? src.next() : null;",
    runs: "before it returns", items: "as the caller iterates",
  },
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    // Cited ahead of the provider (brief 7): a later declaration must equal the pinned value.
    'ref.facts.streamSignal': { value: true, file: 'src/cmp/java/fragment/EntityBase.fragment.java', quote: ['Object signalObj = callopts.get("signal");', 'if (ended || (signal != null && signal.getAsBoolean())) {'] },
    'ref.facts.direct.okFalse': { value: "false", file: "tm/java/core/SdkClient.java", quote: "out.put(\"ok\", false);" },
    // The test client's mock without the test feature, cited ahead: the factory's fallback.
    'ref.facts.testMock': { value: "generated", file: "src/cmp/java/Config_java.ts", quote: "return new ${javapackage}.feature.BaseFeature();" },
    // What list resolves to: makeResult builds a List of entities, one per record.
    // Searched over the whole java runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context/i, except: [
      { file: BASE, quote: ['*   - callopts["ctrl"] threads pipeline control and callopts["signal"] (a', '*     BooleanSupplier that returns true when aborted) is honoured between', 'Object signalObj = callopts.get("signal");', 'final BooleanSupplier signal =', 'if (ended || (signal != null && signal.getAsBoolean())) {'],
        why: 'the stream reads callopts.signal between the items it hands over (ref.facts.streamSignal); no operation reads it', fact: 'ref.facts.streamSignal' },
      { file: 'tm/java/feature/CostFeature.java', quote: ['// supersedes it loses precision to catastrophic cancellation.'],
        why: "the cost feature's comment: floating-point 'catastrophic cancellation'" },
    ] } },
    // The no-argument constructor chains to the options one with no options.
    'ref.facts.ctorAlts[0].kind': { value: 'defaults', file: MAIN, quote: 'public ProjectNameSDK() {\n    this(null);' },
    'facts.collection': { value: '`List`', file: 'tm/java/utility/MakeResult.java', quote: 'List<Object> entities = new ArrayList<>();' },
    // The client constructor chains to the options one with null: no options.
    'ref.facts.none': { file: MAIN, quote: 'this(null);' },
    'ref.facts.container': { file: MAIN, quote: 'public ProjectNameSDK(Map<String, Object> options) {' },
    // Struct.clone builds a new map or list (the allocation quoted beside the call).
    'ref.facts.client[0].copy': { value: true, file: CLIENT, quote: 'Object out = Struct.clone(this.options);', also: [{ file: STRUCT, quote: ['Map<String, Object> out = new LinkedHashMap<>();', 'List<Object> out = new ArrayList<>(l.size());'] }] },
    // The getter returns what the copy function builds, a new object.
    'ref.facts.client[1].copy': { value: true, file: CLIENT, quote: 'return this.utility.copy();', also: [{ file: 'tm/java/core/Utility.java', quote: 'public Utility copy() {\n    Utility u = new Utility(true);' }] },
    'ref.facts.client[1].kind': { value: 'utility', file: CLIENT, quote: 'return this.utility.copy();' },
    'ref.facts.entity[0].copy': { value: true, file: BASE, quote: 'return Struct.clone(this.data);', also: [{ file: STRUCT, quote: 'Map<String, Object> out = new LinkedHashMap<>();' }] },
    'ref.facts.entity[1].copy': { value: true, file: BASE, quote: 'return Struct.clone(this.match);', also: [{ file: STRUCT, quote: 'Map<String, Object> out = new LinkedHashMap<>();' }] },
    // prepare throws (a refused method), as every other call does.
    'ref.facts.prepare.fails': { value: 'style', file: CLIENT, quote: 'throw ctx.makeError("spec_method_allow",' },
    'ref.facts.body.values': { value: 'a `byte[]`, a `String` or an `InputStream`', file: 'tm/java/utility/Fetcher.java',
      quote: ['if (body instanceof String && !"".equals(body)) {', 'else if (body instanceof byte[]) {', 'else if (body instanceof InputStream) {'] },
    'ref.facts.body.once': { value: 'an `InputStream`', file: 'tm/java/utility/Media.java', quote: '// read once, so it is read here, before the first attempt, and a retry sends', also: [{ file: 'tm/java/utility/Media.java', quote: 'return ((InputStream) body).readAllBytes();' }] },
  },
}

export { forms }
