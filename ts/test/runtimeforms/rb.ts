// How the rb runtime writes things: methods of the client and entity classes,
// a method with no parameters written without a parameter list, and the
// return a method documents in its `@return [Type]` comment.
import type { Forms } from './forms'
import { defaultSigName, defaultSigParams, defaultSigReturns } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/rb/fragment/Entity${o}Op.fragment.rb`)

// The comment block directly above a declaration.
const docOf = (before: string): string => {
  const lines = before.split('\n')
  lines.pop()
  const out: string[] = []
  while (0 < lines.length && /^\s*#/.test(lines[lines.length - 1])) out.unshift(lines.pop() as string)
  return out.join('\n')
}

const forms: Forms = {
  files: {
    client: ['src/cmp/rb/fragment/Main.fragment.rb'],
    entity: ['src/cmp/rb/fragment/Entity.fragment.rb'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]+def (?:self\\.)?${name}(?=[(\\s])`, 'm'),
  bare: true,
  optional: (p) => /=/.test(p),
  returns: (_after, before) => (/@return \[([^\]]+)\]/.exec(docOf(before)) || [])[1] || '',
  public: {
    client: /^  def (?:self\.)?((?!initialize\b)[a-z]\w*[?!]?)|(?<=^  attr_accessor[^\n]*:)(\w+)/gm,
    entity: /^  def (?:self\.)?((?!initialize\b)[a-z]\w*[?!]?)|(?<=^  attr_accessor[^\n]*:)(\w+)/gm,
  },
  undocumented: {
    mode: 'an accessor for "live" or "test", which the constructors set; not part of the documented API',
    features: 'an accessor for the installed features, for the pipeline; not part of the documented API',
    options: 'an accessor over the same options options_map copies',
    get_root_ctx: 'the pipeline\'s root context, for features; not part of the documented API',
    to_s: 'Ruby\'s printed form: the client\'s name, or the entity\'s data',
    inspect: 'Ruby\'s inspected form, the same as to_s',
    to_h: 'the entity as a Hash, which clean honours; the same copy data_get returns',
    'op_allowed?': 'the allow.op check direct and graphql share; public by omission, not documented',
    op_denied: 'the result direct and graphql return when allow.op refuses them; public by omission',
    raw_request: 'the ungated request path direct and graphql share; public by omission',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
    mark_deleted: 'how remove marks the entity; not for callers',
    deleted: 'whether remove has marked the entity; no reference page documents it (old pages neither)',
  },
  members: {
    options: 'options_map', utility: 'get_utility', direct: 'direct', prepare: 'prepare',
    dataGet: 'data_get', dataSet: 'data_set', matchGet: 'match_get', matchSet: 'match_set',
    make: 'make', name: 'get_name', stream: 'stream',
  },
  streamKind: (d) => /\bEnumerator\.new\b/.test(d.rest.split(/\n  def /)[0]) ? 'streamSync' : 'stream',
  style: { exception: 'raise', raises: /\braise\b/ },
  record: (rec) => ({ name: rec, arity: 0 }),
  // A signature with no parameter list names its method and returns after `->`.
  sigName: (sig) => sig.includes('(') ? defaultSigName(sig) : ((/^([\w{}]+[?!]?)/.exec(sig) || [])[1] || ''),
  sigParams: (sig) => sig.includes('(') ? defaultSigParams(sig) : [],
  sigReturns: (sig) => sig.includes('(') ? defaultSigReturns(sig) : ((/->\s*(.+)$/.exec(sig) || [])[1] || '').trim(),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'ProjectNameSDK.new' },
  types: { column: 'rb' },
  exceptions: {
    'returns:entity dataGet': 'the runtime documents `[EntityName, Hash]`: the typed Struct name or a Hash; the page names the Hash, as the old page did',
  },
}

export { forms }
