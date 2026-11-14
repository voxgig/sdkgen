// How the c runtime writes things: the client's functions in Main.fragment.c,
// an entity's members as the EntityVT function pointers of core/sdk.h.
import type { Forms } from './forms'

const OPS = ['src/cmp/c/fragment/Entity.fragment.c', 'tm/c/core/sdk.h']

const forms: Forms = {
  files: {
    client: ['src/cmp/c/fragment/Main.fragment.c'],
    entity: ['tm/c/core/sdk.h', 'src/cmp/c/fragment/Entity.fragment.c'],
    ops: OPS,
  },
  // A function pointer of the vtable, or a function at the start of a line.
  decl: (name) => new RegExp(`(?:\\(\\*${name}\\)|^(?!static\\b)[A-Za-z_][\\w *]*?[\\s*]${name})(?=\\()`, 'm'),
  optional: () => false,
  // The return type is written ahead of the name.
  returns: (_after, before, head) =>
    (/^\s*(?:static\s+)?(.*?)\s*(?:\(\*\w+\)|\b\w+)$/.exec((before + head).split('\n').pop() as string) || [])[1] || '',
  public: {
    client: /^(?!static\b)[A-Za-z_][\w ]*?\**\s*\**([a-z_]\w*)\(/gm,
    entity: /\(\*([a-z_]+)\)\(Entity\*|^(?!static\b)[A-Za-z_]\w*\**\s+\**(entyvar_\w+)\(/gm,
  },
  undocumented: {
    sdk_graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
    mark_deleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance; not documented by the old pages',
  },
  members: {
    direct: 'sdk_direct', prepare: 'sdk_prepare',
    data: 'data', match: 'matchv', make: 'make', name: 'get_name', stream: 'entyvar_stream',
  },
  streamKind: (d) => /^voxgig_value\*$/.test(d.returns) ? 'streamList' : 'unknown',
  sigName: (sig) => (/([\w{}]+)\s*\(/.exec(sig.replace(/vt->/, '')) || [])[1] || '',
  sigReturns: (sig) => (/^\s*((?:const\s+)?[A-Za-z_{}][\w{}]*\s*\**)\s*(?:vt->)?[\w{}]+\s*\(/.exec(sig) || [])[1] || '',
  style: {
    exception: 'throw', raises: /$^/,
    errslot: (d) => /PNError\*\*\s*\w*$/.test(d.params[d.params.length - 1] || ''),
  },
  record: (rec) => ({ name: rec.replace(/^vt->/, '') }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'projectname_sdk_new', var: 'entyvar', accessor: 'entyvar_entity_new' },
  types: { column: 'c' },
  exceptions: {
    'types:ARRAY': 'the code generator\'s map gives voxgig_value* for arrays and maps alike; the page says which, as the old page did',
    'types:OBJECT': 'the code generator\'s map gives voxgig_value* for arrays and maps alike; the page says which, as the old page did',
  },
}

export { forms }
