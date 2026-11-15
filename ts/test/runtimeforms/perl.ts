// How the perl runtime writes things: `sub name {` in the client and entity
// packages, the parameters unpacked by the body's first statement
// (`my ($self, $a, $b) = @_;`), the receiver first. Perl checks no arity, so
// any parameter may be left out, and declares no types.
import type { Forms } from './forms'

const MAIN = 'src/cmp/perl/fragment/Main.fragment.pm'
const ENTITY = 'src/cmp/perl/fragment/Entity.fragment.pm'
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
  // How a call is written: `->` for a method on an object or the package, parentheses optional.
  calls: { on: { instance: ['->'], type: ['->'], module: ['::'] }, parenless: true },
  types: { column: null, reason: 'the code generator has no perl column in canonToType (every type maps to any); the page\'s type words are the provider\'s own',
    // The words the page prints, pinned: no generator map checks them, the reviewer audits them.
    words: { STRING: 'string', INTEGER: 'integer', NUMBER: 'number', BOOLEAN: 'boolean', NULL: 'undef', ARRAY: 'arrayref', OBJECT: 'hashref', ANY: 'scalar' } },
  uncompared: { paramTypes: 'perl declares no parameter types', returns: 'perl declares no return types' },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, cite and exceptions.
  // What the table states besides names, parameters and returns.
  testDecl: 'test',
  on: (d) => /^\s*\{\s*(?:#[^\n]*\n\s*)*my\s*\(\s*\$class\b/.test(d.rest) ? 'type' : (/^\s*\{\s*(?:#[^\n]*\n\s*)*my\s*\(\s*\$self\b/.test(d.rest) ? 'instance' : 'module'),
  expect: { test: { on: 'type' }, new: { on: 'type' }, load: { on: 'instance' } },
  shows: {
    'direct\'s `ok`': {
      value: '`0` or `1`, not a boolean',
      file: 'src/cmp/perl/fragment/Main.fragment.pm',
      quote: ["return { 'ok' => 0, 'err' => $prep_err };", "'ok' => (!defined $body_err && $status >= 200 && $status < 300) ? 1 : 0,"],
    },
  },
  stream: {
    file: "src/cmp/perl/fragment/Entity.fragment.pm",
    construct: "    return sub {\n      return undef if $aborted->();\n      my $item = eval {", starts: "on iteration",
    run: "$self->_run_op($ctx, sub { return });",
    draw: "my $next = $src->();",
    runs: "before it returns", items: "as the caller iterates",
  },
  // The porter's part.
  renames: { args: ['data', 'match'] },
  namesWhy: 'Perl passes these by position; the runtime names the setter argument $args, the page names what it holds',
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    // Cited ahead of the provider (brief 7): a later declaration must equal the pinned value.
    'ref.facts.entity[2].copy': { value: true, file: 'src/cmp/perl/fragment/Entity.fragment.pm', quote: 'return Voxgig::Struct::clone($self->{_match});' },
    'ref.facts.direct.okFalse': { value: "0", file: "src/cmp/perl/fragment/Main.fragment.pm", quote: "'ok' => 0," },
    // The test client's mock without the test feature, cited ahead: the factory's fallback.
    'ref.facts.testMock': { value: "generated", file: "src/cmp/perl/Main_perl.ts", quote: "  return ${model.const.Name}BaseFeature->new;" },
    // `use lib '<sdk>/lib'` read from the SDK's own directory, which is where the Makefile runs its suite with -Ilib.
    'ref.facts.ctor[0]': { file: 'src/cmp/perl/Main_perl.ts', quote: "// callers write `use lib '<sdk>/lib'; use <Name>SDK;`.", also: [{ file: 'tm/perl/Makefile', quote: ['# netsim tests) with prove (TAP). -Ilib puts the generated SDK module on', '\tprove -r -Ilib t/'] }] },
    // The module a caller loads, as the generator says a caller writes it, and the package it names.
    'ref.facts.ctor[1]': { file: 'src/cmp/perl/Main_perl.ts', quote: "// callers write `use lib '<sdk>/lib'; use <Name>SDK;`.",
      also: [{ file: MAIN, quote: 'package ProjectNameSDK;' }] },
    'ref.facts.direct.returns': { file: MAIN, quote: ['# direct() is the raw-HTTP escape hatch: it always returns a result hash', '# ({ ok => ..., ... }) and never dies.'], unquoted: { hashref: 'the result is a hash reference literal; the runtime says "a result hash"' } },
    'ref.facts.prepare.returns': { file: MAIN, quote: '# return just the fetchdef hashref (dying on error) so callers -' },
    'ref.facts.none': { file: 'src/cmp/perl/fragment/EntityLoadOp.fragment.pm', quote: '# (undef is treated as an empty match). ctrl: optional per-call control.' },
    'facts.collection': { file: 'src/cmp/perl/fragment/EntityListOp.fragment.pm', quote: '# Returns the matching EntityName items as an arrayref of entities, one per' },
    'facts.recordType': { file: ENTITY, quote: '# Returns the current EntityName data (hashref).' },
    'ref.facts.container': { file: MAIN, quote: '$options = {} unless defined $options;', unquoted: { hashref: 'the options default to a `{}` literal, a hash reference; the runtime names hashref for a match, request data and a record (EntityLoadOp.fragment.pm:5, EntityCreateOp.fragment.pm:5, Entity.fragment.pm:99), never in a comment on the options themselves' } },
    'ref.facts.client[0].copy': { value: true, file: MAIN, quote: 'my $out = Voxgig::Struct::clone($self->{options});' },
    'ref.facts.client[1].kind': { value: 'utility', file: MAIN, quote: 'return ProjectNameUtility->copy($self->{_utility});' },
    'ref.facts.entity[0].copy': { value: true, file: ENTITY, quote: 'return Voxgig::Struct::clone($self->{_data});' },
    'ref.facts.prepare.fails': { value: 'style', file: MAIN, quote: 'die $fd_err if $fd_err;' },
    'ref.facts.body.values': { value: 'a byte string, a character string, sent as UTF-8, or a filehandle', file: 'tm/perl/utility/media.pm', quote: '# A string of bytes, a character string (sent as UTF-8), or a filehandle. A' },
    'ref.facts.body.once': { value: 'a filehandle', file: 'tm/perl/utility/media.pm', quote: '# filehandle can be read once, so it is read here, before the first attempt,' },
    // Searched over the whole perl runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context|\balarm\b/i, except: [
      { file: "src/cmp/perl/fragment/Entity.fragment.pm", quote: ["#   - signal: an optional coderef; when it returns true the iterator stops.", "my $signal = ProjectNameHelpers::gp($callopts, 'signal');", "my $aborted = sub {", "return (ref $signal eq 'CODE' && $signal->()) ? 1 : 0;", "return sub {\n      return undef if $aborted->();", "return sub {\n    return undef if $aborted->();"],
        why: "the stream reads callopts.signal between the items it hands over (ref.facts.streamSignal); no operation reads it", fact: "ref.facts.streamSignal" },
      { file: "tm/perl/feature/cost_feature.pm", quote: ["# supersedes it loses precision to catastrophic cancellation.", "# \"piped\" is set by PrePoint, so its absence is the signal."],
        why: "the cost feature's comments: floating-point 'catastrophic cancellation', and 'the signal' as an English word" },
      { file: "tm/perl/feature/secrets/plugins/Voxgig/Sekreto/Plugins/Proc.pm", quote: ["# $? packs the exit code in the HIGH byte and the killing signal in the", "# low one, so `$? >> 8` alone reads a signal-killed child as exit 0 - and", "# A child that died from a signal did not answer. Reported as the shells", "# do, 128 + the signal, so it is non-zero and distinguishable. waitpid"],
        why: "the secrets feature's own client for fetching a secret (its HTTP, TLS or process calls), which no operation's request goes through" },
    ] } },
    // The stream reads callopts.signal between items, which no operation does: cited ahead of a provider.
    'ref.facts.streamSignal': { value: true, file: "src/cmp/perl/fragment/Entity.fragment.pm", quote: ["my $signal = ProjectNameHelpers::gp($callopts, 'signal');", "return undef if $aborted->();"] },
    'notes.member:streamFunction': { value: 'An entity is yielded as the hashref its `data_get` returns.', file: ENTITY, quote: '# An entity is yielded as its record, the hashref its data_get returns.' },
  },
}

export { forms }
