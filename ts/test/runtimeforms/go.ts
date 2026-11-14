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
  types: { column: 'go' },

  // The porter's, from here on.
  cite: {
    'facts.collection': { file: 'tm/go/utility/make_result.go', quote: 'var entities []any' },
    'ref.facts.container': { file: MAIN, quote: 'func NewProjectNameSDK(options map[string]any) *ProjectNameSDK {' },
    'ref.facts.client[1].kind': { file: MAIN, quote: 'return CopyUtility(sdk.utility)' },
    'ref.facts.prepare.fails': { file: MAIN, quote: 'func (sdk *ProjectNameSDK) Prepare(fetchargs map[string]any) (map[string]any, error) {' },
    'ref.facts.body.values': {
      file: 'tm/go/utility/fetcher.go',
      quote: '\tcase string:\n\t\tif body != "" {\n\t\t\tbodyReader = strings.NewReader(body)\n\t\t}\n\tcase []byte:\n\t\tbodyReader = bytes.NewReader(body)\n\tcase io.Reader:',
    },
    'ref.facts.body.once': { file: 'tm/go/utility/media.go', quote: 'if r, ok := body.(io.Reader); ok {\n\t\tdata, err := io.ReadAll(r)' },
    'ref.facts.cancel': { file: 'tm/go/utility/fetcher.go', quote: 'req, err := http.NewRequest(method, fullurl, bodyReader)' },
    'notes.member:stream': {
      file: ENTITY,
      quote: [
        'func (e *EntyClass) Stream(action string, args map[string]any, callopts map[string]any) <-chan core.StreamItem {',
        'defer close(out)',
        '// What MakeError or Done hands back: the error, as the last value, or\n\t// under `throw: false` the data there is.',
      ],
      also: [{ file: 'tm/go/core/types.go', quote: 'type StreamItem struct {\n\tItem any\n\tErr  error\n}' }],
    },
  },
  exceptions: {
    'ref.facts.accessor.arg': 'WRONG: the accessor passes its argument to the entity constructor as entopts (MainEntity_go.ts `return New${entity.Name}EntityFunc(sdk, data)`; Entity.fragment.go `func NewEntyClass(client *core.ProjectNameSDK, entopts map[string]any)`); the page says "Pass `nil` for no initial data."',
  },
}

export { forms }
