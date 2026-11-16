import { canonToType, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'call',
  async: false,
  result: 'throw',
  collection: '`std::vector`',
  record: 'data()',
  recordType: 'Value',
  arity: 2,
  prints: 'record',
}

// The fixed API the reference page documents: core/types.hpp (SdkClient,
// SdkEntity, EntityBase), Main.fragment.cpp, Entity.fragment.cpp, the
// Entity<Op>Op fragments and MainEntity_cpp.
const refFacts: RefFacts = {
  entityBy: 'class',
  noun: 'Methods',
  none: 'Value::undef()',
  keys: 'member',
  maps: 'maps',
  container: 'Value',
  valueType: { STRING: 'std::string', OBJECT: 'Value', ANY: 'Value' },
  ctor: ['#include "{module}"', '', 'using namespace sdk;', '', 'auto client = std::make_shared<{ctor}>(options);'],
  ctorAlts: [{ call: '{client}::create()', kind: 'defaults' }],
  test: [
    {
      sig: '{client}::testSDK(Value testopts, Value sdkopts) -> std::shared_ptr<{client}>',
      call: 'auto client = {client}::testSDK(Value::undef(), Value::undef());', args: true,
    },
    { sig: '{client}::testSDK() -> std::shared_ptr<{client}>', call: 'auto client = {client}::testSDK();', args: false },
  ],
  testMock: 'generated',
  accessor: { sig: '{accessor}(Value entopts = Value::undef()) -> std::shared_ptr<{Class}>', arg: 'entopts', param: 'entopts' },
  op: {
    list: 'list(const Value& reqmatch, const Value& ctrl) -> std::vector<SdkEntityPtr>',
    load: 'load(const Value& reqmatch, const Value& ctrl) -> SdkEntityPtr',
    create: 'create(const Value& reqdata, const Value& ctrl) -> SdkEntityPtr',
    update: 'update(const Value& reqdata, const Value& ctrl) -> SdkEntityPtr',
    patch: 'patch(const Value& reqdata, const Value& ctrl) -> SdkEntityPtr',
    remove: 'remove(const Value& reqmatch, const Value& ctrl) -> SdkEntityPtr',
  },
  client: [
    { kind: 'options', sig: 'optionsMap() -> Value', copy: true },
    { kind: 'utility', sig: 'getUtility() -> UtilityPtr', copy: true },
    { kind: 'direct', sig: 'direct(const Value& fetchargs) -> Value' },
    { kind: 'prepare', sig: 'prepare(const Value& fetchargs) -> Value' },
  ],
  entity: [
    { kind: 'data', sig: 'data(const Value& arg = Value::undef()) -> Value', copy: true },
    { kind: 'match', sig: 'match(const Value& arg = Value::undef()) -> Value', copy: true },
    { kind: 'make', sig: 'make() -> EntityPtr' },
    {
      kind: 'streamList',
      sig: 'stream(const std::string& action, const Value& args = Value::undef(), const Value& callopts = Value::undef()) -> std::vector<Value>',
      runs: 'call',
    },
    { kind: 'name', sig: 'getName() -> std::string' },
  ],
  direct: { returns: 'Value', okFalse: 'false' },
  prepare: { returns: 'Value', fails: 'style' },
  body: { values: 'a string `Value` holding the bytes, which is sent as given' },
  cancel: false,
  streamSignal: false,
  deleted: '{var}->deleted()',
  removeKeeps: true,
}

// A double-quoted C++ string literal.
const str = (s: string): string => '"' + s
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\n/g, '\\n')
  .replace(/\r/g, '\\r')
  .replace(/\t/g, '\\t') + '"'

const name = (r: Ref): string => r.name

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: 'Value(1)', NUMBER: 'Value(1)', BOOLEAN: 'Value(true)', ARRAY: 'vlist()', OBJECT: 'vmap()', NULL: 'Value(nullptr)',
} as Record<string, string>)[e.type] ?? `Value(${str(e.text)})`

const data = (r: Ref): string => `${name(r)}->data()`

// std::getenv gives a null pointer for an unset variable, which a Value
// cannot be built from.
const env = (v: string): string => `Value(${v} ? ${v} : "")`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return `Value(${str(e.text)})`
    case 'env': return env(`std::getenv(${str(e.name)})`)
    case 'record': return data(e.of)
    case 'field': return `getp(${data(e.of)}, ${str(e.field)})`
    case 'fields': return e.fields.map((f) => `getp(${data(e.of)}, ${str(f)})`).join(', ')
    case 'map': return 0 === e.entries.length ? 'vmap()' : 'vmap({' + e.entries.map(pair).join(', ') + '})'
  }
}

const pair = (en: Entry): string => `{${str(en.key)}, ${expr(en.value)}}`

// One member per line; a map two levels down stays on its member's line; a
// member's type, where it has one, follows it.
const members = (entries: Entry[], pad: string, depth = 0): string[] =>
  entries.flatMap((en) => 'map' === en.value.k && 0 === depth && 0 < en.value.entries.length
    ? [`${pad}{${str(en.key)}, vmap({`, ...members(en.value.entries, pad + '    ', depth + 1), `${pad}})},`]
    : [`${pad}${'env' === en.value.k ? `{${str(en.key)}, ${env(en.key)}}` : pair(en)},` +
      (null == en.type ? '' : '  // ' + canonToType(en.type, 'cpp'))])

// A write's data with types or a note is laid out a member per line.
const argOf = (s: Extract<Stmt, { k: 'call' }>): string => {
  if (null == s.arg) return 'Value::undef()'
  if (!(s.wide && (null != s.note || s.arg.some((en) => null != en.type)))) return expr({ k: 'map', entries: s.arg })
  return 'vmap({\n' + [...members(s.arg, '    ', 1), ...(null == s.note ? [] : ['    // ' + s.note])].join('\n') + '\n})'
}

const printed = (e: Expr): string => 'fields' === e.k
  ? e.fields.map((f) => `Struct::jsonify(getp(${data(e.of)}, ${str(f)}))`).join(' << " " << ')
  : `Struct::jsonify(${expr(e)})`


const Syntax: SyntaxType = {
  interface: '3.3',
  fence: 'cpp',
  facts,

  // std::getenv is <cstdlib>'s and std::cout <iostream>'s; core/sdk.hpp
  // includes neither for the caller.
  imports: (desc, used) => [
    ...(used.env ? ['#include <cstdlib>'] : []),
    ...(used.print ? ['#include <iostream>'] : []),
    `#include "${desc.layout.module}"`,
    '',
    `using namespace ${(desc.layout.names || {}).namespace};`,
  ],

  // A credential read from the environment is held first, so that an unset
  // variable can be told from a set one.
  client: (s, desc) => {
    if (0 === s.options.length) return [`auto client = ${desc.layout.client}::create();`]
    const held = s.options.filter((en) => 'env' === en.value.k)
      .map((en) => `const char* ${en.key} = std::getenv(${str((en.value as Extract<Expr, { k: 'env' }>).name)});`)
    return [...held, `auto client = std::make_shared<${desc.layout.ctor}>(vmap({`, ...members(s.options, '    '), '}));']
  },

  call: (s) => {
    const call = `client->${s.entity.sym.accessor}()->${(facts.method as any)[s.op]}(${argOf(s)}, Value::undef());`
    if (null == s.bind) return [call]
    return [`${'many' === s.bind.role ? 'std::vector<SdkEntityPtr>' : 'SdkEntityPtr'} ${name(s.bind)} = ${call}`]
  },

  each: (s, inner) => [
    `for (const auto& ${name(s.item)} : ${name(s.of)}) {`,
    ...indentLines(inner(s.body), '  '),
    '}',
  ],

  print: (s) => [`std::cout << ${printed(s.what)} << std::endl;`],

  attempt: (s, inner) => [
    'try {',
    ...indentLines(inner(s.body), '  '),
    '} catch (const SdkErrorPtr& err) {',
    `  std::cerr << "${s.what} failed: " << err->msg << std::endl;`,
    '}',
  ],

  comment: (text) => '// ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => canonToType(t, 'cpp'),
    key: (container, path) => container + path.map((k) => `[${str(k)}]`).join(''),
    instance: (e) => [`auto ${e.sym.var} = client->${e.sym.accessor}();`],
    read: (value, key, truth) => truth ? `is_true(getp(${value}, ${str(key)}))` : `getp(${value}, ${str(key)})`,
  },
}


export {
  Syntax
}
