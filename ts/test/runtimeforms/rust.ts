// How the rust runtime writes things: pub fns of the client and entity
// structs, an entity's members on the core Entity trait.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/rust/fragment/Entity${o}Op.fragment.rs`)

const forms: Forms = {
  files: {
    client: ['src/cmp/rust/fragment/Main.fragment.rs'],
    entity: ['src/cmp/rust/fragment/Entity.fragment.rs', 'tm/rust/core/types.rs'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*(?:pub )?fn ${name}(?=\\()`, 'm'),
  receiver: /^(&?self|self\s*:)/,
  optional: () => false,
  returns: (after) => (/^\s*->\s*([^{;]+)/.exec(after) || [])[1] || '',
  public: {
    client: /^\s*pub fn ([a-z]\w*)\(/gm,
    // The struct's pub fns, and the Entity trait's methods it implements.
    entity: /^    (?:pub fn ([a-z]\w*)\(|fn ((?!fmt\b)[a-z]\w*)\(&self[^)]*\)(?: -> [^{]+)? \{)/gm,
  },
  undocumented: {
    get_root_ctx: 'the pipeline\'s root context, for features; not part of the documented API',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
    mark_deleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance; not documented by the old pages',
  },
  members: {
    options: 'options_map', utility: 'get_utility', direct: 'direct', prepare: 'prepare',
    data: 'data', match: 'matchv', make: 'make', name: 'get_name', stream: 'stream',
  },
  streamKind: (d) => /IntoIter/.test(d.returns) ? 'streamList' : 'unknown',
  style: { exception: 'throw', raises: /$^/, union: (d) => /^Result</.test(d.returns) },
  record: (rec) => {
    const m = /(\w+)\(([^()]*)\)$/.exec(rec)
    return null == m ? { name: rec } : { name: m[1], arity: '' === m[2] ? 0 : m[2].split(',').length }
  },
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'new' },
  types: { column: 'rust' },
}

export { forms }
