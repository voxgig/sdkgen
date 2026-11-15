// How the go runtime writes things: methods on *ProjectNameSDK and
// *EntyClass, the operations returning (any, error).
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/go/fragment/Entity${o}Op.fragment.go`)
const MAIN = 'src/cmp/go/fragment/Main.fragment.go'
const ENTITY = 'src/cmp/go/fragment/Entity.fragment.go'

const forms: Forms = {
  files: {
    client: [MAIN, 'src/cmp/go/Main_go.ts', 'src/cmp/go/MainEntity_go.ts'],
    entity: [ENTITY],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^func (?:\\([^)]*\\)\\s*)?${name}(?=\\()`, 'm'),
  param: (p) => {
    const m = /^(\w+)(?:\s+(.+))?$/.exec(p.trim())
    return null == m ? { name: '', type: '' } : { name: m[1], type: (m[2] || '').trim() }
  },
  optional: (p) => /\.\.\./.test(p),
  // A generator component writes the client type through the model's name;
  // the sdk package re-exports core's types (Main_go: type Entity = core.Entity).
  returns: (after) => after.replace(/\$\{model\.const\.Name\}/g, 'ProjectName').replace(/\{.*$/, '')
    .replace(/\bcore\./g, '').trim(),
  // The typed wrappers (LoadTyped) sit beside each operation for the CLI.
  opName: /^func \(e \*EntyClass\) ([A-Z][a-z]+)\(/gm,
  entityCtor: 'NewEntyClass',
  public: {
    client: /^func (?:\(sdk \*ProjectNameSDK\) )?([A-Z]\w*)\(/gm,
    entity: /^func \(e \*EntyClass\) ([A-Z]\w*)\(/gm,
  },
  undocumented: {
    GetRootCtx: 'the pipeline\'s root context, for features; not part of the documented API',
    Graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
    New: 'a shorthand for the constructor with no options (Main_go.ts); the page shows the constructor itself',
    DataTyped: 'the typed form of Data, for go-cli and go-mcp; the page documents the untyped member',
    MatchTyped: 'the typed form of Match, for go-cli and go-mcp; the page documents the untyped member',
    String: 'the printed form (fmt); not part of the documented API',
    GoString: 'the %#v form (fmt); not part of the documented API',
    MarshalJSON: 'the JSON form (encoding/json); not part of the documented API',
    MarkDeleted: 'set by Remove itself; the entity reports it through Deleted',
    Deleted: 'whether Remove succeeded on this instance; not documented by the old pages',
  },
  members: {
    options: 'OptionsMap', utility: 'GetUtility', direct: 'Direct', prepare: 'Prepare',
    data: 'Data', match: 'Match', make: 'Make', name: 'GetName', stream: 'Stream',
  },
  streamKind: (d) => /<-chan/.test(d.returns) ? 'stream' : 'unknown',
  style: { exception: 'throw', raises: /$^/, pair: (d) => /^\(\s*\w+\s*,\s*error\s*\)$/.test(d.returns) },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'NewProjectNameSDK', accessor: '${entity.Name}' },
  // How a call is written: `.` on a value, `sdk.` for a package function.
  calls: { on: { instance: ['.'], module: ['.'] } },
  types: { column: 'go' },

  // The porter's, from here on.
  cite: {
    // Cited ahead of the provider (brief 7): a later declaration must equal the pinned value.
    'ref.facts.entity[1].copy': { value: true, file: 'src/cmp/go/fragment/Entity.fragment.go', quote: 'out := vs.Clone(e.match)' },
    'ref.facts.client[0].copy': { value: true, file: "src/cmp/go/fragment/Main.fragment.go", quote: "out := vs.Clone(sdk.options)" },
    'facts.pairForm': { value: '(value, error)', file: 'src/cmp/go/fragment/EntityLoadOp.fragment.go', quote: 'func (e *EntyClass) Load(reqmatch map[string]any, ctrl map[string]any) (any, error) {', unquoted: { value: 'the page names the first result by what it is; the runtime types it any' } },
    'facts.noError': { file: 'src/cmp/go/fragment/Entity.fragment.go', quote: 'return e, nil' },
    'ref.facts.none': { file: MAIN, quote: 'return nil, err' },
    'ref.facts.direct.okFalse': { file: MAIN, quote: 'return map[string]any{"ok": false, "err": sdk.cleanErr(sdk.rootctx, err)}, nil' },
    'ref.facts.entity[0].copy': { value: true, file: "src/cmp/go/fragment/Entity.fragment.go", quote: "out := vs.Clone(e.data)" },
    'facts.collection': { file: 'tm/go/utility/make_result.go', quote: 'var entities []any' },
    'ref.facts.container': { file: MAIN, quote: 'func NewProjectNameSDK(options map[string]any) *ProjectNameSDK {' },
    'ref.facts.client[1].kind': { value: "utility", file: MAIN, quote: 'return CopyUtility(sdk.utility)' },
    'ref.facts.prepare.fails': { value: "style", file: MAIN, quote: 'func (sdk *ProjectNameSDK) Prepare(fetchargs map[string]any) (map[string]any, error) {' },
    'ref.facts.body.values': { value: "a `[]byte`, a `string` or an `io.Reader`",
      file: 'tm/go/utility/fetcher.go',
      quote: '\tcase string:\n\t\tif body != "" {\n\t\t\tbodyReader = strings.NewReader(body)\n\t\t}\n\tcase []byte:\n\t\tbodyReader = bytes.NewReader(body)\n\tcase io.Reader:',
    },
    'ref.facts.body.once': { value: "an `io.Reader`", file: 'tm/go/utility/media.go', quote: 'if r, ok := body.(io.Reader); ok {\n\t\tdata, err := io.ReadAll(r)' },
    // Searched over the whole go runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context/i, except: [
      { file: "src/cmp/go/fragment/Entity.fragment.go", quote: ["var signal <-chan struct{}", "switch s := callopts[\"signal\"].(type) {", "case <-chan struct{}:\n\t\tsignal = s", "case chan struct{}:\n\t\tsignal = s", "case <-signal:"],
        why: "the stream reads callopts.signal between the items it hands over (ref.facts.streamSignal); no operation reads it", fact: "ref.facts.streamSignal" },
    ] } },
    // The stream reads callopts.signal between items, which no operation does: cited ahead of a provider.
    'ref.facts.streamSignal': { value: true, file: "src/cmp/go/fragment/Entity.fragment.go", quote: ["switch s := callopts[\"signal\"].(type) {", "case <-signal:"] },
    'notes.member:stream': { value: "It sends the items on the returned channel, which closes when the stream\nends. A `StreamItem` holds one item in `Item`, or in `Err` the error that\nended the stream: the error the operation itself would return, sent as the\nlast value. Under `throw: false` in `callopts[\"ctrl\"]`, no error is sent.",
      file: ENTITY,
      quote: [
        'func (e *EntyClass) Stream(action string, args map[string]any, callopts map[string]any) <-chan core.StreamItem {',
        'defer close(out)',
        '// What MakeError or Done hands back: the error, as the last value, or\n\t// under `throw: false` the data there is.',
        'if c := core.ToMapAny(callopts["ctrl"]); c != nil {',
      ],
      also: [{ file: 'tm/go/core/types.go', quote: 'type StreamItem struct {\n\tItem any\n\tErr  error\n}' }],
    },
  },
  // What the table states besides names, parameters and returns.
  testDecl: 'TestSDK',
  on: (d) => /^func \(/.test(d.head) ? 'instance' : 'module',
  fails: (d) => /\berror\)$/.test(d.returns) ? 'second value error' : '',
  failure: { shows: 'error', call: 'err' },
  stream: {
    file: "src/cmp/go/fragment/Entity.fragment.go",
    construct: "go func() {", starts: "at call",
    run: "if err := e.streamSteps(ctx); err != nil {",
    draw: "for item := range ctx.Result.Stream() {",
    runs: "from the call, beside the caller", items: "from the call, beside the caller",
  },
}

export { forms }
