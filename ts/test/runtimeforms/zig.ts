// How the zig runtime writes things: pub fns of the client and entity
// structs, an entity's data and match on the core Entity interface.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/zig/fragment/Entity${o}Op.fragment.zig`)

const forms: Forms = {
  files: {
    client: ['src/cmp/zig/fragment/Main.fragment.zig'],
    entity: ['src/cmp/zig/fragment/Entity.fragment.zig', 'tm/zig/core/types.zig'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*pub fn ${name}(?=\\()`, 'm'),
  receiver: /^self\s*:/,
  optional: () => false,
  returns: (after) => after.replace(/\{.*$/, '').trim(),
  public: {
    client: /^\s*pub fn ([a-z]\w*)\(/gm,
    entity: /^    pub fn ([a-z]\w*)\(self: (?:\*EntyClass|Entity\b)/gm,
  },
  undocumented: {
    new_with: 'a constructor that also takes extra features; the old page did not document it',
    get_root_ctx: 'the pipeline\'s root context, for features; not part of the documented API',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
    mark_deleted: 'set by remove itself; the entity reports it through is_deleted',
    is_deleted: 'whether remove succeeded on this instance; not documented by the old pages',
  },
  members: {
    options: 'options_map', utility: 'get_utility', direct: 'direct', prepare: 'prepare',
    data: 'data', match: 'matchv', name: 'get_name', stream: 'stream',
  },
  streamKind: (d) => /^StreamResult$/.test(d.returns) ? 'streamList' : 'unknown',
  style: { exception: 'throw', raises: /$^/, union: (d) => /^\w*Result$/.test(d.returns) },
  record: (rec) => {
    const m = /(\w+)\(([^()]*)\)$/.exec(rec)
    return null == m ? { name: rec } : { name: m[1], arity: '' === m[2] ? 0 : m[2].split(',').length }
  },
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'new' },
  types: { column: null },
}

export { forms }
