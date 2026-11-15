// How the csharp runtime writes things: public methods of the client and the
// entity classes, the type ahead of the name, a parameter as `Type name =
// default`; each operation overrides EntityBase's virtual method.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/csharp/fragment/Entity${o}Op.fragment.cs`)
const MODS = '(?:public |static |virtual |override |abstract |async )+'

const forms: Forms = {
  files: {
    client: ['src/cmp/csharp/fragment/Main.fragment.cs', 'src/cmp/csharp/MainEntity_csharp.ts'],
    entity: ['src/cmp/csharp/fragment/EntityBase.fragment.cs', 'src/cmp/csharp/fragment/Entity.fragment.cs'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*${MODS}(?:[\\w.<>?,\\[\\]$\\{\\}]+(?:<[^>]*>)?\\??\\s+)?${name}(?=\\()`, 'm'),
  param: (p) => {
    const m = /^(.*\S)\s+(\w+)\s*(?:=.*)?$/.exec(p.trim())
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
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    'ref.facts.direct.okFalse': { value: "false", file: "src/cmp/csharp/fragment/Main.fragment.cs", quote: "[\"ok\"] = false," },
    // The test client's mock without the test feature, cited ahead: the factory's fallback.
    'ref.facts.testMock': { value: "model", file: "src/cmp/csharp/Config_csharp.ts", quote: "return new Feature.BaseFeature();" },
  },
}

export { forms }
