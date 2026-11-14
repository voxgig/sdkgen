// How the go runtime writes things: methods on *ProjectNameSDK and
// *EntyClass, the operations returning (any, error).
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/go/fragment/Entity${o}Op.fragment.go`)

const forms: Forms = {
  files: {
    client: ['src/cmp/go/fragment/Main.fragment.go', 'src/cmp/go/Main_go.ts'],
    entity: ['src/cmp/go/fragment/Entity.fragment.go'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^func (?:\\([^)]*\\)\\s*)?${name}(?=\\()`, 'm'),
  optional: (p) => /\.\.\./.test(p),
  // A generator component writes the client type through the model's name;
  // the sdk package re-exports core's types (Main_go: type Entity = core.Entity).
  returns: (after) => after.replace(/\$\{model\.const\.Name\}/g, 'ProjectName').replace(/\{.*$/, '')
    .replace(/\bcore\./g, '').trim(),
  public: {
    client: /^func (?:\(sdk \*ProjectNameSDK\) )?([A-Z]\w*)\(/gm,
    entity: /^func \(e \*EntyClass\) ([A-Z]\w*)\(/gm,
  },
  undocumented: {
    GetRootCtx: 'the pipeline\'s root context, for features; not part of the documented API',
    Graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
  },
  members: {
    options: 'OptionsMap', utility: 'GetUtility', direct: 'Direct', prepare: 'Prepare',
    data: 'Data', match: 'Match', make: 'Make', name: 'GetName', stream: 'Stream',
  },
  streamKind: (d) => /<-chan/.test(d.returns) ? 'stream' : 'unknown',
  style: { exception: 'throw', raises: /$^/, pair: (d) => /^\(\s*\w+\s*,\s*error\s*\)$/.test(d.returns) },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'NewProjectNameSDK' },
  types: { column: 'go' },
}

export { forms }
