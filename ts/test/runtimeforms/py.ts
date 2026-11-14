// How the py runtime writes things: methods of the client and entity classes.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/py/fragment/Entity${o}Op.fragment.py`)

const forms: Forms = {
  files: {
    client: ['src/cmp/py/fragment/Main.fragment.py'],
    entity: ['src/cmp/py/fragment/Entity.fragment.py'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]+def ${name}(?=\\()`, 'm'),
  receiver: /^(self|cls)$/,
  optional: (p) => /=/.test(p),
  returns: (after) => (/^\s*->\s*([^:]+):/.exec(after) || [])[1] || '',
  public: {
    client: /^    def ([a-z]\w*)\(/gm,
    entity: /^    def ([a-z]\w*)\(/gm,
  },
  undocumented: {
    options: 'a property over the same options options_map() copies',
    get_root_ctx: 'the pipeline\'s root context, for features; not part of the documented API',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
  },
  members: {
    options: 'options_map', utility: 'get_utility', direct: 'direct', prepare: 'prepare',
    dataGet: 'data_get', dataSet: 'data_set', matchGet: 'match_get', matchSet: 'match_set',
    make: 'make', name: 'get_name', stream: 'stream',
  },
  streamKind: (d) => /\byield\b/.test(d.rest.split(/\n    def /)[0]) ? 'streamGenerator' : 'stream',
  style: { exception: 'raise', raises: /\braise\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName' },
  types: { column: 'py' },
  exceptions: {
    'optional:opMatched list': 'the runtime defaults the match, and a nested entity\'s list needs its parent: the page shows it required, beside the sentence naming the members (stage 3, ref-10)',
    'returns:entity dataGet': 'EntityName is a TypedDict, so a dict; the page names the dict, as the old page did',
    'returns:entity matchGet': 'EntityName is a TypedDict, so a dict; the page names the dict, as the old page did',
  },
}

export { forms }
