import { canonToType, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'call',
  async: false,
  result: 'raise',
  collection: '`list`',
  record: 'data_get()',
  recordType: 'dict',
  prints: 'record',
}

// The fixed API the reference page documents: Entity.fragment.py,
// Main.fragment.py and MainEntity_py.
const refFacts: RefFacts = {
  entityBy: 'class',
  noun: 'Methods',
  none: 'None',
  keys: 'member',
  maps: 'dicts',
  container: 'dict',
  valueType: { STRING: 'str', OBJECT: 'dict', ANY: 'any' },
  ctor: ['from {module} import {client}', '', 'client = {ctor}(options)'],
  test: [{ sig: '{client}.test(testopts=None, sdkopts=None)', call: 'client = {client}.test()', args: true }],
  accessor: { sig: '{accessor}(data=None)', arg: 'entopts', param: 'data' },
  op: {
    list: 'list(reqmatch=None, ctrl=None) -> list[{Class}]',
    load: 'load(reqmatch=None, ctrl=None) -> {Class}',
    create: 'create(reqdata, ctrl=None) -> {Class}',
    update: 'update(reqdata, ctrl=None) -> {Class}',
    patch: 'patch(reqdata, ctrl=None) -> {Class}',
    remove: 'remove(reqmatch=None, ctrl=None) -> {Class}',
  },
  client: [
    { kind: 'options', sig: 'options_map() -> dict', copy: true },
    { kind: 'utility', sig: 'get_utility() -> Utility' },
    { kind: 'direct', sig: 'direct(fetchargs=None) -> dict' },
    { kind: 'prepare', sig: 'prepare(fetchargs=None) -> dict' },
  ],
  entity: [
    { kind: 'dataGet', sig: 'data_get() -> dict', copy: true },
    { kind: 'dataSet', sig: 'data_set(args=None)' },
    { kind: 'matchGet', sig: 'match_get() -> dict' },
    { kind: 'matchSet', sig: 'match_set(args=None)' },
    { kind: 'make', sig: 'make() -> Entity' },
    { kind: 'streamGenerator', sig: 'stream(action, args=None, callopts=None)', runs: 'iterate' },
    { kind: 'name', sig: 'get_name() -> str' },
  ],
  direct: { returns: 'dict', okFalse: 'False' },
  prepare: { returns: 'dict', fails: 'style' },
  body: { values: '`bytes`, `bytearray`, `memoryview`, a `str` or a file object', once: 'a file object' },
  cancel: false,
  testMock: 'generated',
}

const str = (s: string): string => JSON.stringify(s)

const name = (r: Ref): string => r.name

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: '1', NUMBER: '1', BOOLEAN: 'True', ARRAY: '[]', OBJECT: '{}', NULL: 'None',
} as Record<string, string>)[e.type] ?? str(e.text)

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return str(e.text)
    case 'env': return `os.environ.get(${str(e.name)})`
    case 'record': return name(e.of) + '.data_get()'
    case 'field': return `${name(e.of)}.data_get()[${str(e.field)}]`
    case 'fields': return e.fields.map((f) => `${name(e.of)}.data_get().get(${str(f)})`).join(', ')
    case 'map': return '{' + e.entries.map(pair).join(', ') + '}'
  }
}

const pair = (en: Entry): string => `${str(en.key)}: ${expr(en.value)}`

// A map two levels down stays on its member's line; a member's type, where it
// has one, follows it.
const members = (entries: Entry[], pad: string, depth = 0): string[] =>
  entries.flatMap((en) => 'map' === en.value.k && 0 === depth
    ? [`${pad}${str(en.key)}: {`, ...members(en.value.entries, pad + '    ', depth + 1), `${pad}},`]
    : [`${pad}${pair(en)},` + (null == en.type ? '' : '  # ' + canonToType(en.type, 'py'))])

// A write's data is laid out a member per line where it carries types or a
// note; otherwise on one line, as the py examples always were.
const argOf = (s: Extract<Stmt, { k: 'call' }>): string => {
  if (null == s.arg) return ''
  const laid = s.wide && (null != s.note || s.arg.some((en) => null != en.type))
  if (!laid) return expr({ k: 'map', entries: s.arg })
  return '{\n' + [...members(s.arg, '    '), ...(null == s.note ? [] : ['    # ' + s.note])].join('\n') + '\n}'
}


const Syntax: SyntaxType = {
  fence: 'python',
  facts,

  imports: (desc, used) => [
    ...(used.env ? ['import os'] : []),
    `from ${desc.layout.module} import ${desc.layout.client}`,
  ],

  client: (s, desc) => [
    0 === s.options.length
      ? `client = ${desc.layout.ctor}()`
      : `client = ${desc.layout.ctor}({\n${members(s.options, '    ').join('\n')}\n})`,
  ],

  call: (s) => {
    const call = `client.${s.entity.sym.accessor}().${(facts.method as any)[s.op]}(${argOf(s)})`
    return [null == s.bind ? call : `${name(s.bind)} = ${call}`]
  },

  each: (s, inner) => [
    `for ${name(s.item)} in ${name(s.of)}:`,
    ...indentLines(inner(s.body), '    '),
  ],

  print: (s) => [`print(${expr(s.what)})`],

  attempt: (s, inner) => [
    'try:',
    ...indentLines(inner(s.body), '    '),
    'except Exception as err:',
    `    print(f"${s.what} failed: {err}")`,
  ],

  comment: (text) => '# ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => canonToType(t, 'py'),
    key: (container, path) => container + path.map((k) => `[${str(k)}]`).join(''),
    instance: (e) => [`${e.sym.var} = client.${e.sym.accessor}()`],
    read: (value, key) => `${value}[${str(key)}]`,
  },
}


export {
  Syntax
}
