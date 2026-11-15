import { canonKey, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'call',
  async: false,
  result: 'die',
  collection: '`arrayref`',
  record: '${var}->data_get',
  recordType: 'hashref',
  prints: 'fields',
}

// The fixed API the reference page documents: Main.fragment.pm,
// Entity.fragment.pm, the Entity*Op fragments and MainEntity_perl.
const refFacts: RefFacts = {
  entityBy: 'class',
  noun: 'Methods',
  none: 'undef',
  keys: 'member',
  maps: 'hashrefs',
  container: 'hashref',
  valueType: { STRING: 'string', OBJECT: 'hashref', ANY: 'any' },
  ctor: ['use lib \'lib\';', 'use {module};', '', 'my $client = {ctor}($options);'],
  test: [{ sig: '{client}->test($testopts, $sdkopts)', call: 'my $client = {client}->test();', args: true }],
  accessor: { sig: '{accessor}($data)', arg: 'entopts', param: 'data' },
  op: {
    list: 'list($reqmatch, $ctrl) -> arrayref',
    load: 'load($reqmatch, $ctrl) -> {Class}',
    create: 'create($reqdata, $ctrl) -> {Class}',
    update: 'update($reqdata, $ctrl) -> {Class}',
    patch: 'patch($reqdata, $ctrl) -> {Class}',
    remove: 'remove($reqmatch, $ctrl) -> {Class}',
  },
  client: [
    { kind: 'options', sig: 'options_map() -> hashref', copy: true },
    { kind: 'utility', sig: 'get_utility() -> utility' },
    { kind: 'direct', sig: 'direct($fetchargs) -> hashref' },
    { kind: 'prepare', sig: 'prepare($fetchargs) -> hashref' },
  ],
  entity: [
    { kind: 'dataGet', sig: 'data_get() -> hashref', copy: true },
    { kind: 'dataSet', sig: 'data_set($data)' },
    { kind: 'matchGet', sig: 'match_get() -> hashref' },
    { kind: 'matchSet', sig: 'match_set($match)' },
    { kind: 'make', sig: 'make() -> {Class}' },
    { kind: 'streamFunction', sig: 'stream($action, $args, $callopts) -> coderef', runs: 'call' },
    { kind: 'name', sig: 'get_name() -> string' },
  ],
  direct: { returns: 'hashref', okFalse: '0' },
  prepare: { returns: 'hashref', fails: 'style' },
  body: { values: 'a byte string, a character string, sent as UTF-8, or a filehandle', once: 'a filehandle' },
  cancel: false,
}

// A single-quoted Perl string: it interpolates nothing, so only the backslash
// and the quote are escaped.
const str = (s: string): string => '\'' + String(s).replace(/\\/g, '\\\\').replace(/'/g, '\\\'') + '\''

// A scalar variable is written with its sigil.
const scalar = (name: string): string => '$' + name

const name = (r: Ref): string => scalar(r.name)

// A hash key: bare where Perl reads it as a string, quoted otherwise.
const hkey = (k: string): string => /^[A-Za-z_]\w*$/.test(k) ? k : str(k)

// Perl has no static types; a field's shape in idiomatic Perl terms.
const type = (t: any): string => ({
  STRING: 'string', INTEGER: 'integer', NUMBER: 'number',
  BOOLEAN: 'boolean', ARRAY: 'arrayref', OBJECT: 'hashref', NULL: 'undef',
} as Record<string, string>)[canonKey(t)] || 'scalar'

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: '1', NUMBER: '1', BOOLEAN: '1', ARRAY: '[]', OBJECT: '{}', NULL: 'undef',
} as Record<string, string>)[e.type] ?? str(e.text)

const read = (r: Ref, field: string): string => `${name(r)}->data_get->{${hkey(field)}}`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return str(e.text)
    case 'env': return `$ENV{${str(e.name)}}`
    case 'record': return name(e.of) + '->data_get'
    case 'field': return read(e.of, e.field)
    case 'fields': return `join(' ', ${e.fields.map((f) => read(e.of, f)).join(', ')})`
    case 'map': return 0 === e.entries.length ? '{}' : '{ ' + e.entries.map(pair).join(', ') + ' }'
  }
}

const pair = (en: Entry): string => `${str(en.key)} => ${expr(en.value)}`

// A map one level down stays on its member's line; a member's type, where it
// has one, follows it as a comment.
const members = (entries: Entry[], pad: string, depth = 0): string[] =>
  entries.flatMap((en) => 'map' === en.value.k && 0 === depth && 0 < en.value.entries.length
    ? [`${pad}${str(en.key)} => {`, ...members(en.value.entries, pad + '    ', depth + 1), `${pad}},`]
    : [`${pad}${pair(en)},` + (null == en.type ? '' : '  # ' + type(en.type))])

// A call's argument: none, a map on one line, or a map laid out a member per
// line where it carries types or a closing note.
const argOf = (s: Extract<Stmt, { k: 'call' }>): string => {
  if (null == s.arg) return '()'
  const laid = s.wide && (null != s.note || s.arg.some((en) => null != en.type))
  if (!laid) return '(' + expr({ k: 'map', entries: s.arg }) + ')'
  return '({\n' + [...members(s.arg, '    '), ...(null == s.note ? [] : ['    # ' + s.note])].join('\n') + '\n})'
}

// An operation called on the entity the client's accessor yields.
const callOf = (s: Extract<Stmt, { k: 'call' }>): string =>
  `$client->${s.entity.sym.accessor}->${(facts.method as any)[s.op]}${argOf(s)}`


const Syntax: SyntaxType = {
  fence: 'perl',
  facts,

  // The page's imports serve the tutorial (read from the SDK's directory) and
  // the root quick start (read from the repository root) alike, so they name
  // no library path: where `lib` is depends on where the reader runs.
  imports: (desc) => [`use ${desc.layout.module};`],

  client: (s, desc) => [
    0 === s.options.length
      ? `my $client = ${desc.layout.ctor};`
      : `my $client = ${desc.layout.ctor}({\n${members(s.options, '    ').join('\n')}\n});`,
  ],

  // A name is declared with `my` where the block first binds it.
  call: (s, _desc, sc) => {
    const call = callOf(s) + ';'
    if (null == s.bind) return [call]
    const declared = sc.local.has(s.bind.name)
    sc.local.add(s.bind.name)
    return [`${declared ? '' : 'my '}${name(s.bind)} = ${call}`]
  },

  each: (s, inner) => [
    `for my ${name(s.item)} (@${name(s.of)}) {`,
    ...indentLines(inner(s.body), '    '),
    '}',
  ],

  // Chosen fields are printed one after another, a space between them; a
  // whole record in the runtime's own JSON form.
  print: (s) => 'fields' === s.what.k
    ? [`print ${s.what.fields.map((f) => read((s.what as any).of, f)).join(', \' \', ')}, "\\n";`]
    : ('record' === s.what.k
      ? [`print Voxgig::Struct::jsonify(${expr(s.what)}), "\\n";`]
      : [`print ${expr(s.what)}, "\\n";`]),

  // A body that opens by binding a call evaluates that call alone, and what
  // follows runs where it did not die; any other body is evaluated whole.
  attempt: (s, inner, sc) => {
    const [first, ...rest] = s.body
    const fails = `    print "${s.what} failed: $err\\n";`
    if (null != first && 'call' === first.k && null != first.bind) {
      sc.local.add(first.bind.name)
      return [
        `my ${name(first.bind)} = eval { ${callOf(first)} };`,
        'if (my $err = $@) {', fails, '}',
        'else {', ...indentLines(inner(rest), '    '), '}',
      ]
    }
    return ['eval {', ...indentLines(inner(s.body), '    '), '    1;', '};', 'if (my $err = $@) {', fails, '}']
  },

  comment: (text) => '# ' + text,

  expr: (e) => expr(e),

  notes: {
    'member:streamFunction': 'An entity is yielded as the hashref its `data_get` returns.',
  },

  ref: {
    facts: refFacts,
    type,
    key: (container, path) => scalar(container) + (0 === path.length ? '' : '->' + path.map((k) => `{${hkey(k)}}`).join('')),
    instance: (e) => [`my ${scalar(e.sym.var)} = $client->${e.sym.accessor};`],
    read: (value, key) => `${scalar(value)}->{${hkey(key)}}`,
  },
}


export {
  Syntax
}
