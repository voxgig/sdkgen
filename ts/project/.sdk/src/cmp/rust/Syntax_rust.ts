import { canonToType, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'call',
  async: false,
  result: 'union',
  collection: '`Vec`',
  record: 'data(None)',
  ok: 'Ok',
  err: 'Err',
  arity: 2,
  prints: 'record',
}

// The fixed API the reference page documents: Main.fragment.rs,
// Entity.fragment.rs, the Entity<Op>Op fragments and core/types.rs.
const refFacts: RefFacts = {
  entityBy: 'class',
  noun: 'Methods',
  none: 'Value::Noval',
  setArg: '`Some(&map)`',
  keys: 'bare',
  maps: 'maps',
  container: 'Value',
  valueType: { STRING: 'string', OBJECT: 'map', ANY: 'any' },
  ctor: ['use {module}::{jo, ProjectNameEntityBase, {client}, Entity, Value};', '', 'let client = {ctor}(options);'],
  test: [{
    sig: 'test_sdk(testopts: Value, sdkopts: Value) -> Rc<{client}>',
    call: 'use {module}::{test_sdk, Value};\n\nlet client = test_sdk(Value::Noval, Value::Noval);',
    args: true,
  }],
  accessor: { sig: '{accessor}(entopts: Value) -> Rc<{Class}>', arg: 'entopts', param: 'entopts' },
  op: {
    list: 'list(reqmatch: Value, ctrl: Value) -> Result<Vec<Rc<Self>>, ProjectNameError>',
    load: 'load(reqmatch: Value, ctrl: Value) -> Result<Rc<Self>, ProjectNameError>',
    create: 'create(reqdata: Value, ctrl: Value) -> Result<Rc<Self>, ProjectNameError>',
    update: 'update(reqdata: Value, ctrl: Value) -> Result<Rc<Self>, ProjectNameError>',
    patch: 'patch(reqdata: Value, ctrl: Value) -> Result<Rc<Self>, ProjectNameError>',
    remove: 'remove(reqmatch: Value, ctrl: Value) -> Result<Rc<Self>, ProjectNameError>',
  },
  client: [
    { kind: 'options', sig: 'options_map() -> Value', copy: true },
    { kind: 'utility', sig: 'get_utility() -> Rc<Utility>', copy: true },
    { kind: 'direct', sig: 'direct(fetchargs: Value) -> Result<Value, ProjectNameError>' },
    { kind: 'prepare', sig: 'prepare(fetchargs: Value) -> Result<Value, ProjectNameError>' },
  ],
  entity: [
    { kind: 'dataArg', sig: 'data(args: Option<&Value>) -> Value', copy: true },
    { kind: 'matchArg', sig: 'matchv(args: Option<&Value>) -> Value', copy: true },
    { kind: 'make', sig: 'make() -> Rc<dyn Entity>' },
    { kind: 'streamList', sig: 'stream(action: &str, args: Value, callopts: Value) -> Result<std::vec::IntoIter<Value>, ProjectNameError>', runs: 'call' },
    { kind: 'name', sig: 'get_name() -> String' },
  ],
  direct: { returns: 'Result<Value, ProjectNameError>', okFalse: 'false' },
  prepare: { returns: 'Result<Value, ProjectNameError>', fails: 'style' },
  body: { values: 'a string, or bytes as `bytes_value(&[u8])`' },
  cancel: false,
  deleted: '{var}.deleted()',
  testMock: 'generated',
}

const str = (s: string): string => JSON.stringify(s)

const name = (r: Ref): string => r.name

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: 'Value::Num(1.0)', NUMBER: 'Value::Num(1.0)', BOOLEAN: 'Value::Bool(true)',
  ARRAY: 'Value::empty_list()', OBJECT: 'Value::empty_map()', NULL: 'Value::Null',
} as Record<string, string>)[e.type] ?? `Value::str(${str(e.text)})`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return `Value::str(${str(e.text)})`
    case 'env': return `Value::str(std::env::var(${str(e.name)}).unwrap_or_default())`
    case 'record': return `${name(e.of)}.data(None)`
    case 'field': return `getp(&${name(e.of)}.data(None), ${str(e.field)})`
    case 'fields': return e.fields.map((f) => `getp(&${name(e.of)}.data(None), ${str(f)})`).join(', ')
    case 'map': return `jo(vec![${e.entries.map(pair).join(', ')}])`
  }
}

const pair = (en: Entry): string => `(${str(en.key)}, ${expr(en.value)})`

// One member per line; a map two levels down stays on its member's line; a
// member's type, where it has one, follows it.
const members = (entries: Entry[], pad: string, depth = 0): string[] =>
  entries.flatMap((en) => 'map' === en.value.k && 0 === depth
    ? [`${pad}(${str(en.key)}, jo(vec![`, ...members(en.value.entries, pad + '    ', depth + 1), `${pad}])),`]
    : [`${pad}${pair(en)},` + (null == en.type ? '' : '  // ' + canonToType(en.type, 'rust'))])

// A write's data with types or a note is laid out a member per line.
const argOf = (s: Extract<Stmt, { k: 'call' }>): string => {
  if (null == s.arg) return 'Value::Noval'
  if (!(s.wide && (null != s.note || s.arg.some((en) => null != en.type)))) return expr({ k: 'map', entries: s.arg })
  return 'jo(vec![\n' + [...members(s.arg, '    '), ...(null == s.note ? [] : ['    // ' + s.note])].join('\n') + '\n])'
}

const callExpr = (s: Extract<Stmt, { k: 'call' }>): string =>
  `client.${s.entity.sym.accessor}(Value::Noval).${(facts.method as any)[s.op]}(${argOf(s)}, Value::Noval)`

// A statement printed as a match arm: the trailing `;` becomes the arm's `,`.
const arm = (line: string): string => line.replace(/;$/, ',')


const Syntax: SyntaxType = {
  interface: '3.3',
  fence: 'rust',
  facts,

  // The page's imports: the README's other sections are compiled with them, so
  // getp is imported whether or not the tutorial reads a field.
  imports: (desc) => [
    `use ${desc.layout.module}::{getp, jo, ${(desc.layout.names || {}).entityBase}, ${desc.layout.client}, Entity, Value};`,
  ],

  client: (s, desc) => [
    0 === s.options.length
      ? `let client = ${desc.layout.ctor}(Value::Noval);`
      : `let client = ${desc.layout.ctor}(jo(vec![\n${members(s.options, '    ').join('\n')}\n]));`,
  ],

  // Inside an attempt the call is the match's scrutinee; outside one its
  // Result is unwrapped.
  call: (s, _desc, _sc, cx) => {
    if (cx.inAttempt) return [callExpr(s)]
    return [`${null == s.bind ? '' : `let ${name(s.bind)} = `}${callExpr(s)}.unwrap();`]
  },

  each: (s, inner) => [
    `for ${name(s.item)} in &${name(s.of)} {`,
    ...indentLines(inner(s.body), '    '),
    '}',
  ],

  print: (s) => 'fields' === s.what.k
    ? [`println!("${s.what.fields.map(() => '{:?}').join(' ')}", ${expr(s.what)});`]
    : [`println!("{:?}", ${expr(s.what)});`],

  // The first statement is the call matched on; the rest is its Ok arm.
  attempt: (s, inner) => {
    const [first, ...rest] = s.body
    const bound = 'call' === first.k && null != first.bind ? name(first.bind) : '_'
    const body = inner(rest)
    const ok = 1 === body.length
      ? [`    Ok(${bound}) => ${arm(body[0])}`]
      : [`    Ok(${bound}) => {`, ...indentLines(body, '        '), '    }']
    return [
      `match ${inner([first]).join('\n')} {`,
      ...ok,
      `    Err(err) => eprintln!("${s.what} failed: {}", err),`,
      '}',
    ]
  },

  comment: (text) => '// ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => canonToType(t, 'rust'),
    key: (_container, path) => path.join('.'),
    instance: (e) => [`let ${e.sym.var} = client.${e.sym.accessor}(Value::Noval);`],
    read: (value, key, truth) => `getp(&${value}, ${str(key)})` + (truth ? ' == Value::Bool(true)' : ''),
  },

  notes: {
    'member:direct': 'The result map always comes back inside `Ok`.',
  },
}


export {
  Syntax
}
