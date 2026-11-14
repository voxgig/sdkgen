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
  prints: 'record',
}

// The fixed API the reference page documents: Main.fragment.rs,
// Entity.fragment.rs, the Entity<Op>Op fragments and core/types.rs.
const refFacts: RefFacts = {
  classes: true,
  noun: 'Methods',
  none: 'Value::Noval',
  keys: 'bare',
  maps: 'maps',
  container: 'Value',
  valueType: { STRING: 'string', OBJECT: 'map', ANY: 'any' },
  ctor: ['use {module}::{jo, {sdk}EntityBase, {client}, Entity, Value};', '', 'let client = {ctor}(options);'],
  test: [{
    sig: 'test_sdk(testopts: Value, sdkopts: Value) -> Rc<{client}>',
    call: 'use {module}::{test_sdk, Value};\n\nlet client = test_sdk(Value::Noval, Value::Noval);',
    args: true,
  }],
  accessor: { sig: '{accessor}(entopts: Value) -> Rc<{Class}>', arg: 'entopts' },
  op: {
    list: 'list(reqmatch: Value, ctrl: Value) -> Result<Vec<Rc<Self>>, {sdk}Error>',
    load: 'load(reqmatch: Value, ctrl: Value) -> Result<Rc<Self>, {sdk}Error>',
    create: 'create(reqdata: Value, ctrl: Value) -> Result<Rc<Self>, {sdk}Error>',
    update: 'update(reqdata: Value, ctrl: Value) -> Result<Rc<Self>, {sdk}Error>',
    patch: 'patch(reqdata: Value, ctrl: Value) -> Result<Rc<Self>, {sdk}Error>',
    remove: 'remove(reqmatch: Value, ctrl: Value) -> Result<Rc<Self>, {sdk}Error>',
  },
  client: [
    { kind: 'options', sig: 'options_map() -> Value' },
    { kind: 'utility', sig: 'get_utility() -> Rc<Utility>' },
    { kind: 'direct', sig: 'direct(fetchargs: Value) -> Result<Value, {sdk}Error>' },
    { kind: 'prepare', sig: 'prepare(fetchargs: Value) -> Result<Value, {sdk}Error>' },
  ],
  entity: [
    { kind: 'data', sig: 'data(args: Option<&Value>) -> Value' },
    { kind: 'match', sig: 'matchv(args: Option<&Value>) -> Value' },
    { kind: 'make', sig: 'make() -> Rc<dyn Entity>' },
    { kind: 'streamList', sig: 'stream(action: &str, args: Value, callopts: Value) -> Result<std::vec::IntoIter<Value>, {sdk}Error>' },
    { kind: 'name', sig: 'get_name() -> String' },
  ],
  direct: { returns: 'Result<Value, {sdk}Error>' },
  prepare: { returns: 'Result<Value, {sdk}Error>', fails: 'style' },
  body: { values: 'a string, or bytes as `bytes_value(&[u8])`' },
  cancel: false,
}

const str = (s: string): string => JSON.stringify(s)

const name = (r: Ref): string =>
  'created' === r.role ? 'created' : ('many' === r.role ? r.entity.sym.vars : r.entity.sym.var)

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

// One member per line; a map two levels down stays on its member's line.
const members = (entries: Entry[], pad: string, depth = 0): string[] =>
  entries.flatMap((en) => 'map' === en.value.k && 0 === depth
    ? [`${pad}(${str(en.key)}, jo(vec![`, ...members(en.value.entries, pad + '    ', depth + 1), `${pad}])),`]
    : [`${pad}${pair(en)},`])

const callExpr = (s: Extract<Stmt, { k: 'call' }>): string =>
  `client.${s.entity.sym.accessor}(Value::Noval).${(facts.method as any)[s.op]}(` +
  `${null == s.arg ? 'Value::Noval' : expr({ k: 'map', entries: s.arg })}, Value::Noval)`

// A statement printed as a match arm: the trailing `;` becomes the arm's `,`.
const arm = (line: string): string => line.replace(/;$/, ',')


const Syntax: SyntaxType = {
  fence: 'rust',
  facts,

  // getp is imported whether or not this section reads a field: the README's
  // other sections are compiled with the imports this block declares.
  client: (s, desc) => [
    `use ${desc.layout.module}::{getp, jo, ` +
    `${(desc.layout.names || {}).entityBase}, ${desc.layout.client}, Entity, Value};`,
    '',
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
  },
}


export {
  Syntax
}
