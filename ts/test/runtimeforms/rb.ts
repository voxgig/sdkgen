// How the rb runtime writes things: methods of the client and entity classes,
// a method with no parameters written without a parameter list, and the
// return a method documents in its comment block.
import type { Forms } from './forms'
import { defaultSigName, defaultSigParams, defaultSigReturns } from './forms'

const MAIN = 'src/cmp/rb/fragment/Main.fragment.rb'
const ENTITY = 'src/cmp/rb/fragment/Entity.fragment.rb'
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
    client: ['src/cmp/rb/fragment/Main.fragment.rb', 'src/cmp/rb/MainEntity_rb.ts'],
    entity: ['src/cmp/rb/fragment/Entity.fragment.rb'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]+def (?:self\\.)?${name}(?=[(\\s])`, 'm'),
  bare: true,
  param: (p) => ({ name: (/^\*{0,2}&?(\w+)/.exec(p.trim()) || ['', ''])[1], type: '' }),
  optional: (p) => /=/.test(p),
  returns: (_after, before) => (/@return \[([^\]]+)\]/.exec(docOf(before)) || [])[1] || '',
  entityCtor: 'initialize',
  ctorDecl: 'initialize',
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
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'ProjectNameSDK.new', accessor: '${entity.Name}' },
  types: { column: 'rb' },

  // The porter's, from here on.
  renames: { args: ['data', 'match'] },
  namesWhy: 'Ruby passes these by position; the runtime names the setter argument args',
  uncompared: { returns: 'the runtime documents a return with `@return` on some methods only; the facts that rest on the others are cited' },
  cite: {
    'ref.facts.client[0].copy': { value: true, file: "src/cmp/rb/fragment/Main.fragment.rb", quote: "out = VoxgigStruct.clone(@options)" },
    'ref.facts.none': { file: 'src/cmp/rb/fragment/EntityLoadOp.fragment.rb', quote: 'def load(reqmatch = nil, ctrl = nil)' },
    'ref.facts.direct.okFalse': { file: MAIN, quote: 'return { "ok" => false, "err" => err }' },
    'ref.facts.entity[0].copy': { value: true, file: "src/cmp/rb/fragment/Entity.fragment.rb", quote: "VoxgigStruct.clone(@_data)" },
    'facts.recordType': { file: ENTITY, quote: '@return [EntityName, Hash]' },
    'ref.facts.container': { file: MAIN, quote: 'out.is_a?(Hash) ? out : {}' },
    'ref.facts.ctor[0]': { file: 'src/cmp/rb/Main_rb.ts', quote: 'require_relative \'feature/base_feature\'' },
    'ref.facts.client[1].kind': { value: "utility", file: MAIN, quote: 'def get_utility\n    ProjectNameUtility.copy(@_utility)' },
    'ref.facts.direct.returns': { file: MAIN, quote: ['"ok" => false,', '# ({ "ok" => ..., ... }) and never raises.'], unquoted: { Hash: 'the result is a Hash literal' } },
    'ref.facts.prepare.returns': { file: MAIN, quote: ['fetchdef, fd_err = utility.make_fetch_def.call(ctx)', '# return just the fetchdef Hash (raising on error) so callers'] },
    'ref.facts.prepare.fails': { value: "style", file: MAIN, quote: 'raise fd_err if fd_err' },
    'ref.facts.body.values': { value: "a `String`, or an IO that responds to `read`",
      file: 'tm/rb/utility/fetcher.rb',
      quote: 'if body_str.is_a?(String)\n        request.body = body_str\n      elsif body_str.respond_to?(:read)',
    },
    'ref.facts.body.once': { value: "an IO", file: 'tm/rb/utility/media.rb', quote: 'body.respond_to?(:read) ? body.read : body' },
    // Searched over the whole rb runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context/i, except: [
      { file: "src/cmp/rb/fragment/Entity.fragment.rb", quote: ["#   - `ctrl` (pipeline control) and `signal` (cancellation) honoured.", "signal = callopts[\"signal\"]", "aborted = lambda do", "return false if signal.nil?", "return !!signal.call if signal.respond_to?(:call)", "return !!signal.aborted if signal.respond_to?(:aborted)", "stream_enum.each do |item|\n              throw :stream_stop if aborted.call", "items.each do |item|\n              throw :stream_stop if aborted.call"],
        why: "the stream reads callopts.signal between the items it hands over (ref.facts.streamSignal); no operation reads it", fact: "ref.facts.streamSignal" },
      { file: "tm/rb/feature/cost_feature.rb", quote: ["# supersedes it loses precision to catastrophic cancellation.", "# \"piped\" is set by PrePoint, so its absence is the signal."],
        why: "the cost feature's comments: floating-point 'catastrophic cancellation', and 'the signal' as an English word" },
    ] } },
    // The stream reads callopts.signal between items, which no operation does: cited ahead of a provider.
    'ref.facts.streamSignal': { value: true, file: "src/cmp/rb/fragment/Entity.fragment.rb", quote: ["signal = callopts[\"signal\"]", "throw :stream_stop if aborted.call"] },
  },
  exceptions: {
    'returns:entity dataGet': 'the runtime documents `[EntityName, Hash]`: the typed Struct name or a Hash; the page names the Hash, as the old page did',
  },
  // What the table states besides names, parameters and returns.
  testDecl: 'test',
  on: (d) => 'initialize' === d.name || /def self\./.test(d.head) ? 'type' : 'instance',
  field: () => false,
  parenless: true,
  returnsFrom: () => 'comment',
  stream: {
    file: "src/cmp/rb/fragment/Entity.fragment.rb",
    construct: "Enumerator.new do |yielder|", starts: "on iteration",
    run: "failed = _stream_steps(ctx)",
    draw: "stream_enum.each do |item|",
    runs: "as the caller iterates", items: "as the caller iterates",
  },
}

export { forms }
