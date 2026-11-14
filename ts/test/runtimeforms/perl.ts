// How the perl runtime writes things: `sub name {` in the client and entity
// packages, the parameters unpacked by the body's first statement
// (`my ($self, $a, $b) = @_;`), the receiver first. Perl checks no arity, so
// any parameter may be left out, and declares no types.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/perl/fragment/Entity${o}Op.fragment.pm`)

const forms: Forms = {
  files: {
    client: ['src/cmp/perl/fragment/Main.fragment.pm', 'src/cmp/perl/MainEntity_perl.ts'],
    entity: ['src/cmp/perl/fragment/Entity.fragment.pm'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^sub ${name}(?=\\s*\\{)`, 'm'),
  declReader: (after) => {
    const m = /^\s*\{\s*(?:#[^\n]*\n\s*)*my\s*\(([^)]*)\)\s*=\s*@_\s*;/.exec(after)
    if (null == m) return /^\s*\{/.test(after) ? { params: [] } : null
    return { params: m[1].split(',').map((p) => p.trim()).filter((p) => '' !== p && !/^\$(self|class)$/.test(p)) }
  },
  param: (p) => ({ name: (/^[$@%](\w+)/.exec(p.trim()) || ['', ''])[1], type: '' }),
  optional: () => true,
  returns: () => '',
  entityCtor: 'new',
  public: {
    client: /^sub ((?!_|new\b)[a-z]\w*|TO_JSON)\s*\{/gm,
    entity: /^sub ((?!_|new\b)[a-z]\w*|TO_JSON)\s*\{/gm,
  },
  undocumented: {
    TO_JSON: 'the JSON form (JSON::PP convert_blessed)',
    to_string: 'the printed form',
    get_root_ctx: 'the pipeline\'s root context, for features',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    mark_deleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance',
  },
  members: {
    options: 'options_map', utility: 'get_utility', direct: 'direct', prepare: 'prepare',
    dataGet: 'data_get', dataSet: 'data_set', matchGet: 'match_get', matchSet: 'match_set',
    make: 'make', name: 'get_name', stream: 'stream',
  },
  streamKind: (d) => /\n  return sub \{/.test(d.rest.split(/\nsub /)[0]) ? 'streamFunction' : 'stream',
  style: { exception: 'die', raises: /\bdie\b/ },
  record: (rec) => ({ name: (/(\w+)(?:\(\))?$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'new', accessor: '${entity.Name}' },
  types: { column: null, reason: 'the code generator has no perl column in canonToType (every type maps to any); the page\'s type words are the provider\'s own' },
  uncompared: { paramTypes: 'perl declares no parameter types', returns: 'perl declares no return types' },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, cite and exceptions.
}

export { forms }
