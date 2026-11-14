import { canonToType, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Scope, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'bare',
  async: false,
  result: 'raise',
  collection: '`Voxgig.Struct` list',
  record: 'data_get/1',
  prints: 'record',
}

// The fixed API the reference page documents: Main.fragment.ex,
// Entity.fragment.ex, the Entity<Op>Op fragments and lib/projectname/entity_base.ex.
const refFacts: RefFacts = {
  classes: false,
  noun: 'Functions',
  none: 'nil',
  keys: 'bare',
  maps: 'maps',
  container: 'Voxgig.Struct',
  valueType: { STRING: 'String.t()', OBJECT: 'map()', ANY: 'any()' },
  ctor: ['sdk = {ctor}(options)'],
  test: [{ sig: '{module}.test(testopts \\\\ nil, sdkopts \\\\ nil)', call: 'sdk = {module}.test()', args: true }],
  accessor: { sig: '{accessor}(client, entopts \\\\ nil)', arg: 'entopts' },
  op: {
    list: 'list(entity, reqmatch \\\\ nil, ctrl \\\\ nil) :: list()',
    load: 'load(entity, reqmatch \\\\ nil, ctrl \\\\ nil) :: entity',
    create: 'create(entity, reqdata, ctrl \\\\ nil) :: entity',
    update: 'update(entity, reqdata, ctrl \\\\ nil) :: entity',
    patch: 'patch(entity, reqdata, ctrl \\\\ nil) :: entity',
    remove: 'remove(entity, reqmatch \\\\ nil, ctrl \\\\ nil) :: entity',
  },
  client: [
    { kind: 'options', sig: 'options_map(client) :: map()' },
    // get_utility/1 hands back the client's own utility node.
    { kind: 'utilityShared', sig: 'get_utility(client) :: map()' },
    { kind: 'direct', sig: 'direct(client, fetchargs) :: map()' },
    { kind: 'prepare', sig: 'prepare(client, fetchargs) :: map()' },
  ],
  entity: [
    { kind: 'dataGet', sig: 'data_get(entity) :: map()' },
    { kind: 'dataSet', sig: 'data_set(entity, data)' },
    { kind: 'matchGet', sig: 'match_get(entity) :: map()' },
    { kind: 'matchSet', sig: 'match_set(entity, match)' },
    { kind: 'make', sig: 'make(entity) :: entity' },
    { kind: 'streamLazy', sig: 'stream(entity, action, args \\\\ nil, callopts \\\\ nil) :: Enumerable.t()' },
    { kind: 'name', sig: 'get_name(entity) :: String.t()' },
  ],
  direct: { returns: 'map()' },
  prepare: { returns: 'map()', fails: 'style' },
  body: { values: 'a binary' },
  cancel: false,
}

// An Elixir string literal: `#` is escaped, since `#{` interpolates.
const str = (s: string): string => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  .replace(/#/g, '\\#').replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"'

// The client is `sdk`; an item of a list is read off it by index.
const name = (r: Ref): string => {
  switch (r.role) {
    case 'many': return r.entity.sym.vars
    case 'item': return `Voxgig.Struct.getelem(${r.entity.sym.vars}, i)`
    case 'one': return r.entity.sym.var
    case 'created': return 'created'
  }
}

const mod = (r: Ref): string => r.entity.sym.module as string

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: '1', NUMBER: '1', BOOLEAN: 'true', ARRAY: '[]', OBJECT: '%{}', NULL: 'nil',
} as Record<string, string>)[e.type] ?? str(e.text)

const record = (r: Ref): string => `${mod(r)}.data_get(${name(r)})`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return str(e.text)
    case 'env': return `System.get_env(${str(e.name)})`
    case 'record': return `Voxgig.Struct.jsonify(${record(e.of)})`
    case 'field': return `Voxgig.Struct.getprop(${record(e.of)}, ${str(e.field)})`
    case 'fields': return e.fields.map((f) => `Voxgig.Struct.jsonify(Voxgig.Struct.getprop(${record(e.of)}, ${str(f)}))`).join(' <> " " <> ')
    case 'map': return '%{' + e.entries.map(pair).join(', ') + '}'
  }
}

const pair = (en: Entry): string => `${str(en.key)} => ${expr(en.value)}`

// A native map handed to the SDK is made a struct value by Helpers.deep/1,
// aliased `H` once the client block has declared the alias.
const deep = (entries: Entry[], sc: Scope, helpers: string): string => {
  const fn = (sc.declared.has('H') ? 'H' : helpers) + '.deep'
  const mapOfMaps = (e: Expr) => 'map' === e.k && e.entries.some((en) => 'map' === en.value.k)
  if (!entries.some((en) => mapOfMaps(en.value))) return `${fn}(${expr({ k: 'map', entries })})`
  const lines = entries.map((en) => 'map' === en.value.k && mapOfMaps(en.value)
    ? [`  ${str(en.key)} => %{`, ...en.value.entries.map((x) => `    ${pair(x)},`), '  }'].join('\n')
    : `  ${pair(en)}`)
  return `${fn}(%{\n${lines.join(',\n')}\n})`
}

const calls = (stmts: Stmt[]): Extract<Stmt, { k: 'call' }>[] => stmts.flatMap((s: Stmt) =>
  'call' === s.k ? [s] : ('each' === s.k ? calls(s.body) : []))

// The handle each entity's operations take, bound from the client.
const handles = (stmts: Stmt[], have: Set<string>): string[] => {
  const out: string[] = []
  for (const s of calls(stmts)) {
    if (have.has(s.entity.sym.var)) continue
    have.add(s.entity.sym.var)
    out.push(`${s.entity.sym.var} = ${s.entity.sym.accessor}(sdk)`)
  }
  return out
}

const helpers = (desc: any): string => (desc.layout.names || {}).helpers as string


const Syntax: SyntaxType = {
  fence: 'elixir',
  facts,

  client: (s, desc, sc) => {
    sc.declared.add('H')
    return [
      `alias ${helpers(desc)}, as: H`,
      '',
      0 === s.options.length ? `sdk = ${desc.layout.ctor}()` : `sdk = ${desc.layout.ctor}(${deep(s.options, sc, helpers(desc))})`,
    ]
  },

  // A block whose calls stand outside an attempt binds their handles first.
  before: (stmts, _desc, sc) => {
    const found = handles(stmts, sc.local)
    return 0 === found.length ? [] : [...found, '']
  },

  call: (s, desc, sc) => {
    const args = [s.entity.sym.var, ...(null == s.arg ? [] : [deep(s.arg, sc, helpers(desc))])]
    const call = `${s.entity.sym.module}.${(facts.method as any)[s.op]}(${args.join(', ')})`
    return [null == s.bind ? call : `${name(s.bind)} = ${call}`]
  },

  each: (s, inner) => [
    `for i <- 0..(Voxgig.Struct.size(${name(s.of)}) - 1)//1 do`,
    ...indentLines(inner(s.body), '  '),
    'end',
  ],

  print: (s) => [`IO.puts(${expr(s.what)})`],

  // A binding made inside `try` does not outlive it, so the handle is bound
  // there too.
  attempt: (s, inner) => [
    'try do',
    ...indentLines([...handles(s.body, new Set()), ...inner(s.body)], '  '),
    'rescue',
    `  err -> IO.puts("${s.what} failed: " <> inspect(err))`,
    'end',
  ],

  comment: (text) => '# ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => canonToType(t, 'elixir'),
    key: (_container, path) => path.join('.'),
    instance: (e) => [`${e.sym.var} = ${e.sym.accessor}(sdk)`],
  },
}


export {
  Syntax
}
