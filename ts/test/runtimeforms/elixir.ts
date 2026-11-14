// How the elixir runtime writes things: def functions of the client module
// and of each entity module, typed by @spec.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/elixir/fragment/Entity${o}Op.fragment.ex`)

const forms: Forms = {
  files: {
    client: ['src/cmp/elixir/fragment/Main.fragment.ex'],
    entity: ['tm/elixir/lib/projectname/entity_base.ex', 'src/cmp/elixir/fragment/Entity.fragment.ex'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*def ${name}(?=\\()`, 'm'),
  optional: (p) => /\\\\/.test(p),
  // The return is the @spec's, ahead of the def.
  returns: (_after, before) => {
    const specs = [...before.matchAll(/@spec [\w?!]+\(.*\)\s*::\s*(.+)/g)]
    return 0 < specs.length ? specs[specs.length - 1][1] : ''
  },
  public: {
    client: /^  def ([a-z]\w*)\(/gm,
    entity: /^  def ([a-z]\w*)\(/gm,
  },
  undocumented: {
    get_root_ctx: 'the pipeline\'s root context, for features; not part of the documented API',
    mode: 'the client\'s mode (live or test); not documented by the old pages',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
    new: 'each entity module\'s constructor, which the client\'s accessor calls',
    construct: 'EntityBase\'s constructor behind each entity module\'s new/2',
    op_return: 'EntityBase\'s step that makes an operation resolve to the entity',
    mark_deleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance; not documented by the old pages',
  },
  members: {
    options: 'options_map', utility: 'get_utility', direct: 'direct', prepare: 'prepare',
    dataGet: 'data_get', dataSet: 'data_set', matchGet: 'match_get', matchSet: 'match_set',
    make: 'make', name: 'get_name', stream: 'stream',
  },
  streamKind: (d) => /\bStream\.\w+/.test(d.rest.split(/\n  def /)[0]) ? 'streamLazy' : 'unknown',
  style: { exception: 'raise', raises: /\braise\b/ },
  record: (rec) => {
    const m = /^(\w+)\/(\d+)$/.exec(rec)
    return null == m ? { name: rec } : { name: m[1], arity: +m[2] }
  },
  sigName: (sig) => (/(?:^|[.\s])([a-z_{][\w{}]*)\s*\(/.exec(sig.replace(/^\{module\}\./, '')) || [])[1] || '',
  tokens: { Class: 'EntyClass', client: 'ProjectName', sdk: 'ProjectName', ctor: 'new', module: 'ProjectName' },
  types: { column: 'elixir' },
  exceptions: {
    'optional:opMatched list': 'the runtime defaults the match, and a nested entity\'s list needs its parent: the page shows it required, beside the sentence naming the members (stage 3, ref-10)',
    ...Object.fromEntries(['op list', 'op load', 'op create', 'op update', 'op patch', 'op remove', 'opMatched list']
    .map((w) => ['returns:' + w, 'the @spec says term(); the page names what the term is, as the old page did'])),
  },
}

export { forms }
