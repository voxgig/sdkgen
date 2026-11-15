import { canonToType, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'call',
  async: false,
  result: 'throw',
  collection: 'array',
  record: '${var}->data_get()',
  recordType: 'array',
  arity: 0,
  prints: 'listFields',
}

// The fixed API the reference page documents: Main.fragment.php,
// Entity.fragment.php, the Entity*Op fragments and MainEntity_php.
const refFacts: RefFacts = {
  entityBy: 'class',
  noun: 'Methods',
  none: 'null',
  keys: 'member',
  maps: 'arrays',
  container: 'array',
  valueType: { STRING: 'string', OBJECT: 'array', ANY: 'mixed' },
  ctor: ['require_once __DIR__ . \'/{module}\';', '', '$client = new {ctor}($options);'],
  test: [{ sig: '{client}::test(?array $testopts = null, ?array $sdkopts = null): self', call: '$client = {client}::test();', args: true }],
  testMock: 'generated',
  accessor: { sig: '{accessor}($data = null)', arg: 'entopts', param: 'data', cached: true },
  op: {
    list: 'list(?array $reqmatch = null, $ctrl = null): mixed',
    load: 'load(?array $reqmatch = null, $ctrl = null): mixed',
    create: 'create(?array $reqdata = null, $ctrl = null): mixed',
    update: 'update(?array $reqdata = null, $ctrl = null): mixed',
    patch: 'patch(?array $reqdata = null, $ctrl = null): mixed',
    remove: 'remove(?array $reqmatch = null, $ctrl = null): mixed',
  },
  client: [
    { kind: 'options', sig: 'options_map(): array', copy: true },
    { kind: 'utility', sig: 'get_utility()', returns: 'ProjectNameUtility', copy: true },
    { kind: 'direct', sig: 'direct(array $fetchargs = []): mixed' },
    { kind: 'prepare', sig: 'prepare(array $fetchargs = []): mixed' },
  ],
  entity: [
    { kind: 'dataGet', sig: 'data_get()', returns: 'array', copy: true },
    { kind: 'dataSet', sig: 'data_set($data): void' },
    { kind: 'matchGet', sig: 'match_get()', returns: 'array', copy: true },
    { kind: 'matchSet', sig: 'match_set($match): void' },
    { kind: 'make', sig: 'make(): self' },
    { kind: 'streamGenerator', sig: 'stream(string $action, ?array $args = null, ?array $callopts = null): \\Generator', runs: 'iterate' },
    { kind: 'name', sig: 'get_name(): string' },
  ],
  direct: { returns: 'array', okFalse: 'false' },
  prepare: { returns: 'array', fails: 'style' },
  body: { values: 'a string of bytes or text, or a stream', once: 'a stream' },
  cancel: false,
  deleted: '${var}->deleted()',
  streamSignal: true,
}

// A double-quoted PHP string: `$` is escaped, so nothing interpolates.
const str = (s: string): string => '"' + String(s).replace(/[\\"$]/g, '\\$&') + '"'

// A variable is written with its sigil.
const v = (name: string): string => '$' + name

const name = (r: Ref): string => v(r.name)

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: '1', NUMBER: '1', BOOLEAN: 'true', ARRAY: '[]', OBJECT: '[]', NULL: 'null',
} as Record<string, string>)[e.type] ?? str(e.text)

const read = (r: Ref, field: string): string => `${name(r)}->data_get()[${str(field)}]`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return str(e.text)
    case 'env': return `getenv(${str(e.name)})`
    case 'record': return name(e.of) + '->data_get()'
    case 'field': return read(e.of, e.field)
    case 'fields': return e.fields.map((f) => read(e.of, f)).join(' . " " . ')
    case 'map': return '[' + e.entries.map(pair).join(', ') + ']'
  }
}

const pair = (en: Entry): string => `${str(en.key)} => ${expr(en.value)}`

// A map one level down stays on its member's line; a member's type, where it
// has one, follows it as a comment.
const members = (entries: Entry[], pad: string, step: string, depth = 0): string[] =>
  entries.flatMap((en) => 'map' === en.value.k && 0 === depth && 0 < en.value.entries.length
    ? [`${pad}${str(en.key)} => [`, ...members(en.value.entries, pad + step, step, depth + 1), `${pad}],`]
    : [`${pad}${pair(en)},` + (null == en.type ? '' : ' // ' + canonToType(en.type, 'php'))])

// A call's argument: none, an array on one line, or an array laid out a
// member per line where it carries types or a closing note.
const argOf = (s: Extract<Stmt, { k: 'call' }>): string => {
  if (null == s.arg) return '()'
  const laid = s.wide && (null != s.note || s.arg.some((en) => null != en.type))
  if (!laid) return '(' + expr({ k: 'map', entries: s.arg }) + ')'
  return '([\n' + [...members(s.arg, '  ', '  '), ...(null == s.note ? [] : ['  // ' + s.note])].join('\n') + '\n])'
}


const Syntax: SyntaxType = {
  fence: 'php',
  facts,

  // require_once is read against the running script's directory: the SDK's
  // for the tutorial, the repository root for the root quick start.
  imports: (desc, _used, place) => {
    if ('top' === place && null == desc.layout.dir) throw new Error('php: the root quick start needs layout.dir')
    return ['<?php', `require_once '${'top' === place ? desc.layout.dir + '/' + desc.layout.module : desc.layout.module}';`]
  },

  client: (s, desc) => [
    0 === s.options.length
      ? `$client = new ${desc.layout.ctor}();`
      : `$client = new ${desc.layout.ctor}([\n${members(s.options, '    ', '    ').join('\n')}\n]);`,
  ],

  call: (s) => {
    const call = `$client->${s.entity.sym.accessor}()->${(facts.method as any)[s.op]}${argOf(s)};`
    return [null == s.bind ? call : `${name(s.bind)} = ${call}`]
  },

  each: (s, inner) => [
    `foreach (${name(s.of)} as ${name(s.item)}) {`,
    ...indentLines(inner(s.body), '    '),
    '}',
  ],

  // Chosen fields are read off the record once, then joined; a whole record
  // is shown by print_r.
  print: (s) => 'fields' === s.what.k
    ? [`$item = ${name(s.what.of)}->data_get();`,
      'echo ' + s.what.fields.map((f) => `$item[${str(f)}]`).join(' . " " . ') + ' . "\\n";']
    : ('record' === s.what.k
      ? [`print_r(${expr(s.what)});`]
      : [`echo ${expr(s.what)} . "\\n";`]),

  attempt: (_s, inner) => [
    'try {',
    ...indentLines(inner(_s.body), '    '),
    '} catch (\\Throwable $err) {',
    '    echo "Error: " . $err->getMessage();',
    '}',
  ],

  comment: (text) => '// ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => canonToType(t, 'php'),
    key: (container, path) => v(container) + path.map((k) => `[${str(k)}]`).join(''),
    instance: (e) => [`${v(e.sym.var)} = $client->${e.sym.accessor}();`],
    read: (value, key) => `${v(value)}[${str(key)}]`,
  },
}


export {
  Syntax
}
