// How the elixir runtime writes things: def functions of the client module
// and of each entity module, typed by @spec.
import type { Forms } from './forms'

const MAIN = 'src/cmp/elixir/fragment/Main.fragment.ex'
const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/elixir/fragment/Entity${o}Op.fragment.ex`)

const forms: Forms = {
  files: {
    client: ['src/cmp/elixir/fragment/Main.fragment.ex', 'src/cmp/elixir/MainEntity_elixir.ts'],
    entity: ['tm/elixir/lib/projectname/entity_base.ex', 'src/cmp/elixir/fragment/Entity.fragment.ex'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*def ${name}(?=\\()`, 'm'),
  param: (p) => ({ name: (/^(\w+)/.exec(p.trim()) || ['', ''])[1], type: '' }),
  optional: (p) => /\\\\/.test(p),
  // The return is the @spec's, ahead of the def.
  returns: (_after, before) => {
    const specs = [...before.matchAll(/@spec [\w?!]+\(.*\)\s*::\s*(.+)/g)]
    return 0 < specs.length ? specs[specs.length - 1][1] : ''
  },
  entityCtor: 'new',
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
  tokens: { Class: 'EntyClass', client: 'ProjectName', sdk: 'ProjectName', ctor: 'new', module: 'ProjectName', accessor: '${accessor}' },
  types: { column: 'elixir' },

  // The porter's, from here on.
  renames: { ent: 'entity', args: ['data', 'match'] },
  namesWhy: 'elixir passes by position; the page names the entity argument entity and the setter argument by what it holds',
  uncompared: { returns: 'the runtime writes @spec on the operations only; the client and entity members carry none, so their declared returns are compared with nothing' },
  cite: {
    'ref.facts.client[0].copy': { value: true, file: "src/cmp/elixir/fragment/Main.fragment.ex", quote: "out = S.clone(S.getprop(client, \"options\"))" },
    'notes.tutorial:list': { value: '`Voxgig.Struct.getelem/2` reads an item.', file: 'tm/elixir/lib/utility/struct/voxgig_struct.ex', quote: ['defmodule Voxgig.Struct do', 'def getelem(val, key, alt \\\\ nil)'], unquoted: { 'Voxgig.Struct.getelem/2': 'the arity name of def getelem(val, key, alt \\\\ nil) called with two arguments, in the module Voxgig.Struct' } },
    'ref.facts.none': { file: 'src/cmp/elixir/fragment/EntityLoadOp.fragment.ex', quote: 'def load(ent, reqmatch \\\\ nil, ctrl \\\\ nil) do' },
    'ref.facts.direct.okFalse': { file: MAIN, quote: 'S.jm(["ok", false, "err", err])' },
    'ref.facts.entity[0].copy': { value: true, file: "tm/elixir/lib/projectname/entity_base.ex", quote: "S.clone(S.getprop(ent, \"_data\"))" },
    'notes.ctor': { value: "Build `options` from a native map with `{names.helpers}.deep/1`.", file: "tm/elixir/lib/projectname/helpers.ex", quote: ["def deep(v) do"], also: [{ file: MAIN, quote: 'def new(options \\\\ nil) do' }], unquoted: { '{names.helpers}.deep/1': 'the arity name of def deep(v), behind the helpers module the slot names' } },
    'facts.collection': { value: "`Voxgig.Struct` list",
      file: 'src/cmp/elixir/fragment/EntityListOp.fragment.ex', quote: '# Returns a list of entityname entities, one per record, whose data_get/1',
      also: [{ file: MAIN, quote: 'alias Voxgig.Struct, as: S' }],
    },
    'ref.facts.container': { file: MAIN, quote: ['alias Voxgig.Struct, as: S', 'fetchargs = if S.ismap(fetchargs), do: fetchargs, else: S.jm([])'] },
    'ref.facts.client[1].kind': { value: "utilityBase", file: MAIN, quote: 'def get_utility(client), do: S.getprop(client, "_utility")' },
    'ref.facts.direct.returns': { file: MAIN, quote: 'S.jm(["ok", false, "err", err])', unquoted: { 'map()': 'S.jm builds a map' } },
    'ref.facts.prepare.returns': { file: MAIN, quote: 'def prepare(client, fetchargs \\\\ nil) do', unquoted: { 'map()': 'the fetch definition, a map' } },
    'ref.facts.prepare.fails': { value: "style", file: MAIN, quote: 'raise Context.make_error(ctx, "spec_method_allow",' },
    'ref.facts.body.values': { value: "a binary",
      file: 'tm/elixir/lib/projectname/utility.ex',
      quote: ['scalar = is_binary(body) or is_number(body) or is_boolean(body)', 'S.setprop(fetchdef, "body", body)'],
    },
    // Searched over the whole elixir runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context|:abort\b/i, except: [
      { file: "tm/elixir/lib/projectname/entity_base.ex", quote: ["#   - signal: an optional 0-arity fn; when it returns true iteration stops.", "signal = S.getprop(callopts, \"signal\")", "|> Stream.take_while(fn _ -> not (S.isfunc(signal) and signal.() == true) end)"],
        why: "the stream reads callopts.signal between the items it hands over (ref.facts.streamSignal); no operation reads it", fact: "ref.facts.streamSignal" },
      { file: "tm/elixir/lib/projectname/feature/cost.ex", quote: ["# supersedes it loses precision to catastrophic cancellation", "# PrePoint, so its absence is the signal."],
        why: "the cost feature's comments: floating-point 'catastrophic cancellation', and 'the signal' as an English word" },
      { file: "tm/elixir/lib/projectname/feature/timeout.ex", quote: ["# Annotate the fetch definition so a real transport can cancel itself", "# (Python-idiomatic analog of an abort signal). Copy so the caller's"],
        why: "the timeout feature's own deadline on the transport, which ends a request by time; no caller can cancel an operation through it" },
      { file: "tm/elixir/lib/projectname/utility.ex", quote: [":aborted ->"],
        why: ":global.trans answers :aborted when the clean registry's lock is held elsewhere, and registering retries; no request is involved" },
    ] } },
    // The stream reads callopts.signal between items, which no operation does: cited ahead of a provider.
    'ref.facts.streamSignal': { value: true, file: "tm/elixir/lib/projectname/entity_base.ex", quote: ["signal = S.getprop(callopts, \"signal\")", "|> Stream.take_while(fn _ -> not (S.isfunc(signal) and signal.() == true) end)"] },
    'notes.member:utilityBase': { value: "It is the client's own node, not a copy.", file: MAIN, quote: 'def get_utility(client), do: S.getprop(client, "_utility")' },
  },
  exceptions: {
    'optional:opMatched list': 'the runtime defaults the match, and a nested entity\'s list needs its parent: the page shows it required, beside the sentence naming the members (stage 3, ref-10)',
    ...Object.fromEntries(['op list', 'op load', 'op create', 'op update', 'op patch', 'op remove', 'opMatched list']
    .map((w) => ['returns:' + w, 'the @spec says term(); the page names what the term is, as the old page did'])),
  },
  // What the table states besides names, parameters and returns.
  testDecl: 'test',
  on: () => 'module',
  stream: {
    file: "tm/elixir/lib/projectname/entity_base.ex",
    construct: "|> Stream.take_while(", starts: "on iteration",
    run: "Pipeline.run_op(ctx, fn -> nil end)\n\n    result",
    draw: "        source(ctx, stream_fn)\n",
    runs: "before it returns", items: "before it returns",
  },
}

export { forms }
