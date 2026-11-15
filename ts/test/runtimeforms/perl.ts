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
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    'ref.facts.direct.okFalse': { value: "0", file: "src/cmp/perl/fragment/Main.fragment.pm", quote: "'ok' => 0," },
    // The test client's mock without the test feature, cited ahead: the factory's fallback.
    'ref.facts.testMock': { value: "generated", file: "src/cmp/perl/Main_perl.ts", quote: "  return ${model.const.Name}BaseFeature->new;" },
  },
}

export { forms }
