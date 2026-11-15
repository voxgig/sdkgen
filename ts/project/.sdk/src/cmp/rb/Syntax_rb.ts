import { canonToType, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'bare',
  async: false,
  result: 'raise',
  collection: '`Array`',
  record: 'data_get',
  recordType: 'Hash',
  prints: 'listFields',
}

// The fixed API the reference page documents: Main.fragment.rb,
// Entity.fragment.rb, the Entity*Op fragments and MainEntity_rb.
const refFacts: RefFacts = {
  entityBy: 'class',
  noun: 'Methods',
  none: 'nil',
  keys: 'member',
  maps: 'hashes',
  container: 'Hash',
  valueType: { STRING: 'String', OBJECT: 'Hash', ANY: 'any' },
  ctor: ['require_relative \'{module}\'', '', 'client = {ctor}(options)'],
  test: [{ sig: '{client}.test(testopts = nil, sdkopts = nil)', call: 'client = {client}.test', args: true }],
  accessor: { sig: '{accessor}(data = nil)', arg: 'entopts', param: 'data' },
  op: {
    list: 'list(reqmatch = nil, ctrl = nil) -> Array<{Class}>',
    load: 'load(reqmatch = nil, ctrl = nil) -> {Class}',
    create: 'create(reqdata, ctrl = nil) -> {Class}',
    update: 'update(reqdata, ctrl = nil) -> {Class}',
    patch: 'patch(reqdata, ctrl = nil) -> {Class}',
    remove: 'remove(reqmatch = nil, ctrl = nil) -> {Class}',
  },
  client: [
    { kind: 'options', sig: 'options_map -> Hash', copy: true },
    { kind: 'utility', sig: 'get_utility -> Utility' },
    { kind: 'direct', sig: 'direct(fetchargs = {}) -> Hash' },
    { kind: 'prepare', sig: 'prepare(fetchargs = {}) -> Hash' },
  ],
  entity: [
    { kind: 'dataGet', sig: 'data_get -> Hash', copy: true },
    { kind: 'dataSet', sig: 'data_set(data)' },
    { kind: 'matchGet', sig: 'match_get -> Hash' },
    { kind: 'matchSet', sig: 'match_set(match)' },
    { kind: 'make', sig: 'make -> {Class}' },
    { kind: 'streamSync', sig: 'stream(action, args = nil, callopts = nil) -> Enumerator', runs: 'iterate' },
    { kind: 'name', sig: 'get_name -> String' },
  ],
  direct: { returns: 'Hash', okFalse: 'false' },
  prepare: { returns: 'Hash', fails: 'style' },
  body: { values: 'a `String`, or an IO that responds to `read`', once: 'an IO' },
  cancel: false,
  testMock: 'generated',
}

// A double-quoted Ruby string; `#` is escaped only where it would open an
// interpolation.
const str = (s: string): string => JSON.stringify(s).replace(/#(?=[{$@])/g, '\\#')

const name = (r: Ref): string => r.name

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: '1', NUMBER: '1', BOOLEAN: 'true', ARRAY: '[]', OBJECT: '{}', NULL: 'nil',
} as Record<string, string>)[e.type] ?? str(e.text)

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return str(e.text)
    case 'env': return `ENV[${str(e.name)}]`
    case 'record': return name(e.of) + '.data_get'
    case 'field': return `${name(e.of)}.data_get[${str(e.field)}]`
    case 'fields': return '"' + e.fields.map((f) => `#{${name(e.of)}.data_get[${str(f)}]}`).join(' ') + '"'
    case 'map': return 0 === e.entries.length ? '{}' : '{ ' + e.entries.map(pair).join(', ') + ' }'
  }
}

const pair = (en: Entry): string => `${str(en.key)} => ${expr(en.value)}`

// A map one level down stays on its member's line; a member's type, where it
// has one, follows it as a comment.
const members = (entries: Entry[], pad: string, depth = 0): string[] =>
  entries.flatMap((en) => 'map' === en.value.k && 0 === depth && 0 < en.value.entries.length
    ? [`${pad}${str(en.key)} => {`, ...members(en.value.entries, pad + '  ', depth + 1), `${pad}},`]
    : [`${pad}${pair(en)},` + (null == en.type ? '' : ' # ' + canonToType(en.type, 'rb'))])

// A call's argument: none, a map on one line, or a map laid out a member per
// line where it carries types or a closing note.
const argOf = (s: Extract<Stmt, { k: 'call' }>): string => {
  if (null == s.arg) return ''
  const laid = s.wide && (null != s.note || s.arg.some((en) => null != en.type))
  if (!laid) return '(' + expr({ k: 'map', entries: s.arg }) + ')'
  return '({\n' + [...members(s.arg, '  '), ...(null == s.note ? [] : ['  # ' + s.note])].join('\n') + '\n})'
}


const Syntax: SyntaxType = {
  fence: 'ruby',
  facts,

  imports: (desc) => [`require_relative ${str(desc.layout.module)}`],

  client: (s, desc) => [
    0 === s.options.length
      ? `client = ${desc.layout.ctor}`
      : `client = ${desc.layout.ctor}({\n${members(s.options, '  ').join('\n')}\n})`,
  ],

  call: (s) => {
    const call = `client.${s.entity.sym.accessor}.${(facts.method as any)[s.op]}${argOf(s)}`
    return [null == s.bind ? call : `${name(s.bind)} = ${call}`]
  },

  // A one-line body takes a brace block; a longer one, do ... end.
  each: (s, inner) => {
    const body = inner(s.body)
    return 1 === body.length
      ? [`${name(s.of)}.each { |${name(s.item)}| ${body[0]} }`]
      : [`${name(s.of)}.each do |${name(s.item)}|`, ...indentLines(body, '  '), 'end']
  },

  // Chosen fields are read off the record once, then interpolated.
  print: (s) => 'fields' === s.what.k
    ? [`record = ${name(s.what.of)}.data_get`,
      'puts "' + s.what.fields.map((f) => `#{record[${str(f)}]}`).join(' ') + '"']
    : [`puts ${expr(s.what)}`],

  attempt: (s, inner) => [
    'begin',
    ...indentLines(inner(s.body), '  '),
    'rescue => err',
    `  warn "${s.what} failed: #{err}"`,
    'end',
  ],

  comment: (text) => '# ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => canonToType(t, 'rb'),
    key: (container, path) => container + path.map((k) => `[${str(k)}]`).join(''),
    instance: (e) => [`${e.sym.var} = client.${e.sym.accessor}`],
    read: (value, key) => `${value}[${str(key)}]`,
  },
}


export {
  Syntax
}
