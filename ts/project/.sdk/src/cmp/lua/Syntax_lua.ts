import { canonToType, indentLines, luaKey, luaString } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'bare',
  async: false,
  result: 'pair',
  collection: 'array',
  record: 'data_get()',
  errVar: 'err',
  pairForm: 'value, err',
  noError: 'nil',
  prints: 'fields',
}

// The fixed API the reference page documents: Main.fragment.lua,
// Entity.fragment.lua, the Entity*Op fragments and MainEntity_lua.
const refFacts: RefFacts = {
  entityBy: 'class',
  noun: 'Methods',
  none: 'nil',
  keys: 'member',
  maps: 'tables',
  container: 'table',
  valueType: { STRING: 'string', OBJECT: 'table', ANY: 'any' },
  ctor: ['local sdk = require("{module}")', 'local client = {ctor}(options)'],
  test: [{ sig: 'sdk.test(testopts?, sdkopts?)', call: 'local client = sdk.test()', args: true }],
  testMock: 'generated',
  accessor: { sig: '{accessor}(data)', arg: 'entopts', param: 'data', cached: true },
  op: {
    list: 'list(reqmatch, ctrl) -> {Class}[], err',
    load: 'load(reqmatch, ctrl) -> {Class}, err',
    create: 'create(reqdata, ctrl) -> {Class}, err',
    update: 'update(reqdata, ctrl) -> {Class}, err',
    patch: 'patch(reqdata, ctrl) -> {Class}, err',
    remove: 'remove(reqmatch, ctrl) -> {Class}, err',
  },
  client: [
    { kind: 'options', sig: 'options_map() -> table', copy: true },
    { kind: 'utility', sig: 'get_utility() -> Utility', copy: true },
    { kind: 'direct', sig: 'direct(fetchargs) -> table' },
    { kind: 'prepare', sig: 'prepare(fetchargs) -> table, err' },
  ],
  entity: [
    { kind: 'dataGet', sig: 'data_get() -> table', copy: true },
    { kind: 'dataSet', sig: 'data_set(data)' },
    { kind: 'matchGet', sig: 'match_get() -> table', copy: true },
    { kind: 'matchSet', sig: 'match_set(match)' },
    { kind: 'make', sig: 'make() -> {Class}' },
    { kind: 'streamFunction', sig: 'stream(action, args, callopts) -> function', runs: 'iterate' },
    { kind: 'name', sig: 'get_name() -> string' },
  ],
  direct: { returns: 'table', okFalse: 'false' },
  prepare: { returns: 'table, err', fails: 'style' },
  body: { values: 'a string' },
  cancel: false,
  deleted: '{var}:deleted()',
  streamSignal: true,
}

const str = (s: string): string => luaString(s)

const name = (r: Ref): string => r.name

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: '1', NUMBER: '1', BOOLEAN: 'true', ARRAY: '{}', OBJECT: '{}', NULL: 'nil',
} as Record<string, string>)[e.type] ?? str(e.text)

// A key of a table read after its value: `.name`, or `["a-b"]` where the
// name is not an identifier.
const index = (k: string): string => luaKey(k) === k ? '.' + k : luaKey(k)

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return str(e.text)
    case 'env': return `os.getenv(${str(e.name)})`
    case 'record': return name(e.of) + ':data_get()'
    case 'field': return `${name(e.of)}:data_get()[${str(e.field)}]`
    case 'fields': return e.fields.map((f) => `${name(e.of)}:data_get()[${str(f)}]`).join(', ')
    case 'map': return 0 === e.entries.length ? '{}' : '{ ' + e.entries.map(pair).join(', ') + ' }'
  }
}

const pair = (en: Entry): string => `${luaKey(en.key)} = ${expr(en.value)}`

// A map one level down stays on its member's line; a member's type, where it
// has one, follows it as a comment.
const members = (entries: Entry[], pad: string, depth = 0): string[] =>
  entries.flatMap((en) => 'map' === en.value.k && 0 === depth && 0 < en.value.entries.length
    ? [`${pad}${luaKey(en.key)} = {`, ...members(en.value.entries, pad + '  ', depth + 1), `${pad}},`]
    : [`${pad}${pair(en)},` + (null == en.type ? '' : ' -- ' + canonToType(en.type, 'lua'))])

// A call's argument: none, a table on one line, or a table laid out a member
// per line where it carries types or a closing note.
const argOf = (s: Extract<Stmt, { k: 'call' }>): string => {
  if (null == s.arg) return ''
  const laid = s.wide && (null != s.note || s.arg.some((en) => null != en.type))
  if (!laid) return expr({ k: 'map', entries: s.arg })
  return '{\n' + [...members(s.arg, '  '), ...(null == s.note ? [] : ['  -- ' + s.note])].join('\n') + '\n}'
}

// Operations return value, err: the error is checked where it is made.
const check = 'if err then error(err) end'


const Syntax: SyntaxType = {
  fence: 'lua',
  facts,

  imports: (desc) => [`local sdk = require(${str(desc.layout.module)})`],

  client: (s, desc) => [
    0 === s.options.length
      ? `local client = ${desc.layout.ctor}()`
      : `local client = ${desc.layout.ctor}({\n${members(s.options, '  ').join('\n')}\n})`,
  ],

  call: (s) => [
    `local ${null == s.bind ? '_' : name(s.bind)}, err = client:${s.entity.sym.accessor}():${(facts.method as any)[s.op]}(${argOf(s)})`,
    check,
  ],

  each: (s, inner) => [
    `for _, ${name(s.item)} in ipairs(${name(s.of)}) do`,
    ...indentLines(inner(s.body), '  '),
    'end',
  ],

  // Chosen fields are read off the record once; a whole record is printed a
  // key at a time.
  print: (s) => {
    if ('fields' === s.what.k) {
      return [`local rec = ${name(s.what.of)}:data_get()`,
        'print(' + s.what.fields.map((f) => `rec[${str(f)}]`).join(', ') + ')']
    }
    if ('record' === s.what.k) return [`for k, val in pairs(${name(s.what.of)}:data_get()) do print(k, val) end`]
    return [`print(${expr(s.what)})`]
  },

  // The check each call carries is the handling; there is no block to open.
  attempt: (s, inner) => inner(s.body),

  comment: (text) => '-- ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => canonToType(t, 'lua'),
    key: (container, path) => container + path.map(index).join(''),
    instance: (e) => [`local ${e.sym.var} = client:${e.sym.accessor}(nil)`],
    read: (value, key) => value + index(key),
  },

  notes: {
    'member:direct': 'It also returns a second value, which is always `nil`: a failure is\nreported in the result, never in the second value.',
    'member:streamFunction': 'Unlike an operation, it reports a failure by raising it with `error`\nfrom the returned function, as the caller iterates.',
  },
}


export {
  Syntax
}
