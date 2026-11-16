// How the csharp runtime writes things: public methods of the client and the
// entity classes, the type ahead of the name, a parameter as `Type name =
// default`; each operation overrides EntityBase's virtual method.
import type { Forms } from './forms'
import { defaultSigName } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/csharp/fragment/Entity${o}Op.fragment.cs`)
const MODS = '(?:public |static |virtual |override |abstract |async )+'
const MAIN = 'src/cmp/csharp/fragment/Main.fragment.cs'
const BASE = 'src/cmp/csharp/fragment/EntityBase.fragment.cs'

const forms: Forms = {
  files: {
    client: ['src/cmp/csharp/fragment/Main.fragment.cs', 'src/cmp/csharp/MainEntity_csharp.ts'],
    entity: ['src/cmp/csharp/fragment/EntityBase.fragment.cs', 'src/cmp/csharp/fragment/Entity.fragment.cs'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*${MODS}(?:[\\w.<>?,\\[\\]$\\{\\}]+(?:<[^>]*>)?\\??\\s+)?${name}(?=\\()`, 'm'),
  // The default is dropped first: `ctrl = null` names ctrl, not null.
  param: (p) => {
    const m = /^(.*\S)\s+(\w+)$/.exec(p.trim().replace(/\s*=[^=].*$/, ''))
    return null == m ? { name: '', type: '' } : { name: m[2], type: m[1] }
  },
  optional: (p) => /=/.test(p),
  // The return type is written ahead of the name.
  returns: (_after, _before, head) => (new RegExp(`^[ \\t]*${MODS}(.*?)\\s+[\\w$\\{\\}.]+$`).exec(head) || [])[1] || '',
  entityCtor: 'EntyClass',
  opName: /^public override object\? ([A-Z]\w*)\(/gm,
  public: {
    client: /^    public (?:static |virtual |override |abstract |async )*[^=(\n]*?\s([A-Z]\w*)\(/gm,
    entity: /^    public (?:static |virtual |override |abstract |async )*[^=(\n]*?\s([A-Z]\w*)\(/gm,
  },
  undocumented: {
    GetRootCtx: 'the pipeline\'s root context, for features',
    Graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    MarkDeleted: 'set by Remove itself; the entity reports it through Deleted',
    Deleted: 'whether Remove succeeded on this instance',
  },
  members: {
    options: 'OptionsMap', utility: 'GetUtility', direct: 'Direct', prepare: 'Prepare',
    data: 'Data', match: 'Match', make: 'Make', name: 'GetName', stream: 'Stream',
  },
  streamKind: (d) => /IAsyncEnumerable/.test(d.returns) ? 'streamIterator' : 'stream',
  style: { exception: 'throw', raises: /\bthrow\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'ProjectNameSDK', accessor: '${entity.Name}' },
  types: { column: 'csharp' },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, uncompared, cite and exceptions.
  // What the table states besides names, parameters and returns.
  testDecl: 'TestSDK',
  expect: { TestSDK: { on: 'type' } },
  stream: {
    file: "src/cmp/csharp/fragment/EntityBase.fragment.cs",
    construct: "public async IAsyncEnumerable<object?> Stream(", starts: "on iteration",
    run: "var materialised = RunOp(ctx, () =>",
    draw: "source ??= stream().GetEnumerator();",
    runs: "as the caller iterates", items: "as the caller iterates",
  },
  // How a call is written: `new` for the client class, `.` for every member.
  calls: { on: { instance: ['.'], type: ['.'] } },
  // The page writes a member as C# declares it, the return type first; a
  // member on the type is qualified by it (`{client} {client}.TestSDK(...)`).
  // A member written without a parameter list is a field, named by its last word.
  sigName: (sig) => sig.includes('(') ? defaultSigName(sig) : ((/([\w{}$]+)\s*$/.exec(sig) || [])[1] || ''),
  sigReturns: (sig) => {
    const n = defaultSigName(sig)
    const at = sig.indexOf(n + '(')
    return at < 0 ? '' : sig.slice(0, at).replace(/[\w{}$]+\.$/, '').trim()
  },
  namesWhy: 'the accessor is declared in MainEntity_csharp with the generated base class spelled from the model, which the page spells as the templates do; the stream\'s token parameter carries an attribute the page does not print',
  typeNames: {
    '${model.const.Name}EntityBase': 'ProjectNameEntityBase',
    '[EnumeratorCancellation]CancellationToken': 'CancellationToken',
  },
  cite: {
    // Cited ahead of the provider (brief 7): a later declaration must equal the pinned value.
    'ref.facts.streamSignal': { value: true, file: 'src/cmp/csharp/fragment/EntityBase.fragment.cs', quote: ['StructUtils.GetProp(callopts, "signal") is CancellationToken sigTok', 'signal.IsCancellationRequested'] },
    'ref.facts.direct.okFalse': { value: "false", file: "src/cmp/csharp/fragment/Main.fragment.cs", quote: "[\"ok\"] = false," },
    // The test client's mock without the test feature, cited ahead: the factory's fallback.
    'ref.facts.testMock': { value: "generated", file: "src/cmp/csharp/Config_csharp.ts", quote: "return new Feature.BaseFeature();" },
    'facts.collection': { value: 'list', file: 'tm/csharp/utility/MakeResult.cs', quote: ['var entities = new List<object?>();', 'result.Resdata = entities;'],
      also: [{ file: 'tm/csharp/utility/Done.cs', quote: 'return ctx.Result.Resdata;' }] },
    'ref.facts.none': { file: 'src/cmp/csharp/MainEntity_csharp.ts', quote: 'public ${model.const.Name}EntityBase ${entity.Name}(Dictionary<string, object?>? entopts = null)' },
    'ref.facts.container': { file: MAIN, quote: 'public ProjectNameSDK(Dictionary<string, object?>? options = null)' },
    // The module an example imports is the namespace every generated file declares.
    'ref.facts.ctor[0]': { file: MAIN, quote: ['using ProjectNameSdk.Feature;', 'namespace ProjectNameSdk;'],
      also: [{ file: 'src/cmp/csharp/Main_csharp.ts', quote: "ProjectNameSdk: model.const.Name + 'Sdk'," }] },
    'ref.facts.client[0].copy': { value: true, file: MAIN, quote: 'return global::Voxgig.Struct.StructUtils.Clone(_options) as Dictionary<string, object?>' },
    // Decision 13: the getter returns what the copy function allocates.
    'ref.facts.client[1].copy': { value: true, file: MAIN, quote: 'return global::ProjectNameSdk.Utility.Copy(_utility);',
      also: [{ file: 'tm/csharp/core/Utility.cs', quote: ['public static Utility Copy(Utility src)', 'var u = new Utility(true)'] }] },
    'ref.facts.client[1].kind': { value: 'utility', file: MAIN, quote: 'public Utility GetUtility()\n    {\n        return global::ProjectNameSdk.Utility.Copy(_utility);' },
    'ref.facts.entity[0].copy': { value: true, file: BASE, quote: 'return StructUtils.Clone(data);' },
    'ref.facts.entity[1].copy': { value: true, file: BASE, quote: 'return StructUtils.Clone(match);' },
    'ref.facts.prepare.fails': { value: 'style', file: MAIN, quote: 'throw ctx.MakeError("spec_method_allow",' },
    'ref.facts.body.values': { value: 'a `byte[]`, a `string` or a `Stream`', file: 'tm/csharp/utility/Fetcher.cs',
      quote: ['if (braw is string body && body != "")', 'else if (braw is byte[] bytes)', 'else if (braw is Stream stream)'],
      also: [{ file: 'tm/csharp/utility/Media.cs', quote: 'if (body is byte[] || body is Stream)' }] },
    'ref.facts.body.once': { value: 'a `Stream`', file: 'tm/csharp/utility/Media.cs', quote: ['// Bytes, a Stream or a string, sent as they are. A Stream can be read', 'if (body is Stream stream)'] },
    // Searched over the whole csharp runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context/i, except: [
      { file: BASE, quote: ['//   - callopts["ctrl"] threads pipeline control and callopts["signal"] (a', '//     CancellationToken) is honoured between yields.',
        '[EnumeratorCancellation] CancellationToken cancel = default)', '// Read between yields only: the request itself is not cancelled,', '// where ts and js cancel it in flight.', 'var signal =',
        'StructUtils.GetProp(callopts, "signal") is CancellationToken sigTok', ': CancellationToken.None;',
        'if (!more || cancel.IsCancellationRequested || signal.IsCancellationRequested)', 'if (cancel.IsCancellationRequested || signal.IsCancellationRequested)'],
        why: 'the stream reads callopts.signal, and its own cancel token, between the items it hands over (ref.facts.streamSignal, and the note on the stream); no operation reads either', fact: 'ref.facts.streamSignal' },
      { file: 'tm/csharp/feature/CostFeature.cs', quote: ['// figure supersedes it loses precision to catastrophic cancellation', '// signal.'],
        why: "the cost feature's comments: floating-point 'catastrophic cancellation', and 'signal' as an English word" },
      { file: 'tm/csharp/utility/struct/Struct.cs', quote: '// Last empty part cancels one ascend (the "." that',
        why: "the vendored struct library's path walk: an empty path part 'cancels' an ascend; nothing to do with a request" },
    ] } },
    // The stream's own enumerator token, which no other runtime has.
    'notes.member:streamIterator': { value: 'It also ends early once its own `cancel` token is cancelled.', file: BASE,
      quote: ['[EnumeratorCancellation] CancellationToken cancel = default)', 'if (!more || cancel.IsCancellationRequested || signal.IsCancellationRequested)'] },
  },
}

export { forms }
