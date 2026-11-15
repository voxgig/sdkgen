import { canonToType, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'List', load: 'Load', create: 'Create', update: 'Update', patch: 'Patch', remove: 'Remove' },
  named: 'call',
  async: false,
  result: 'throw',
  collection: 'list',
  record: 'Data()',
  arity: 1,
  prints: 'record',
}

const MAP = 'Dictionary<string, object?>'

// The fixed API the reference page documents: Main.fragment.cs,
// EntityBase.fragment.cs, Entity.fragment.cs, the Entity*Op fragments and
// MainEntity_csharp.
const refFacts: RefFacts = {
  entityBy: 'class',
  noun: 'Methods',
  none: 'null',
  keys: 'member',
  maps: 'dictionaries',
  container: MAP,
  valueType: { STRING: 'string', OBJECT: MAP, ANY: 'object?' },
  ctor: ['using {module};', '', 'var client = new {ctor}(options);'],
  test: [{
    sig: `{client} {client}.TestSDK(${MAP}? testopts, ${MAP}? sdkopts)`,
    call: 'var client = {client}.TestSDK(null, null);', args: true,
  }],
  testMock: 'generated',
  accessor: { sig: `{sdk}EntityBase {accessor}(${MAP}? entopts = null)`, arg: 'entopts', param: 'entopts' },
  op: {
    list: `object? List(${MAP}? reqmatch, ${MAP}? ctrl = null)`,
    load: `object? Load(${MAP}? reqmatch, ${MAP}? ctrl = null)`,
    create: `object? Create(${MAP}? reqdata, ${MAP}? ctrl = null)`,
    update: `object? Update(${MAP}? reqdata, ${MAP}? ctrl = null)`,
    patch: `object? Patch(${MAP}? reqdata, ${MAP}? ctrl = null)`,
    remove: `object? Remove(${MAP}? reqmatch, ${MAP}? ctrl = null)`,
  },
  client: [
    { kind: 'options', sig: `${MAP} OptionsMap()`, copy: true },
    { kind: 'utility', sig: 'Utility GetUtility()', copy: true },
    { kind: 'direct', sig: `${MAP} Direct(${MAP}? fetchargs)` },
    { kind: 'prepare', sig: `${MAP} Prepare(${MAP}? fetchargs)` },
  ],
  entity: [
    { kind: 'data', sig: 'object? Data(object? newdata = null)', copy: true },
    { kind: 'match', sig: 'object? Match(object? newmatch = null)', copy: true },
    { kind: 'make', sig: 'IEntity Make()' },
    {
      kind: 'streamIterator',
      sig: `IAsyncEnumerable<object?> Stream(string action, ${MAP}? args = null, ${MAP}? callopts = null, CancellationToken cancel = default)`,
      runs: 'iterate',
    },
    { kind: 'name', sig: 'string GetName()' },
  ],
  direct: { returns: MAP, okFalse: 'false' },
  prepare: { returns: MAP, fails: 'style' },
  body: { values: 'a `byte[]`, a `string` or a `Stream`', once: 'a `Stream`' },
  cancel: false,
  deleted: '{var}.Deleted()',
  streamSignal: true,
}

// A double-quoted C# string literal: JSON's escapes mean the same in C#, and
// the three line terminators JSON leaves raw end a C# literal.
const str = (s: string): string => JSON.stringify(s)
  .replace(/[\u0085\u2028\u2029]/g, (c) => '\\u' + (c.codePointAt(0) as number).toString(16).padStart(4, '0'))

const name = (r: Ref): string => r.name

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: '1L', NUMBER: '1.0', BOOLEAN: 'true', ARRAY: 'new List<object?>()', OBJECT: `new ${MAP}()`, NULL: 'null',
} as Record<string, string>)[e.type] ?? str(e.text)

// An operation returns `object?`: a list item is cast to the entity
// interface where its record is read; a bound single entity already is one.
const data = (r: Ref): string => 'item' === r.role ? `((IEntity)${name(r)}!).Data()` : `${name(r)}.Data()`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return str(e.text)
    case 'env': return `Environment.GetEnvironmentVariable(${str(e.name)})`
    case 'record': return data(e.of)
    case 'field': return `StructUtils.GetProp(${data(e.of)}, ${str(e.field)})`
    case 'fields': return e.fields.map((f) => `StructUtils.GetProp(${data(e.of)}, ${str(f)})`).join(', ')
    case 'map': return 0 === e.entries.length ? `new ${MAP}()` : `new ${MAP} { ${e.entries.map(pair).join(', ')} }`
  }
}

const pair = (en: Entry): string => `[${str(en.key)}] = ${expr(en.value)}`

// One member per line; a map two levels down stays on its member's line; a
// member's type, where it has one, follows it.
const members = (entries: Entry[], pad: string, depth = 0): string[] =>
  entries.flatMap((en) => 'map' === en.value.k && 0 === depth
    ? [`${pad}[${str(en.key)}] = new ${MAP}`, `${pad}{`, ...members(en.value.entries, pad + '    ', depth + 1), `${pad}},`]
    : [`${pad}${pair(en)},` + (null == en.type ? '' : '  // ' + canonToType(en.type, 'csharp'))])

const block = (lines: string[]): string => `new ${MAP}\n{\n${lines.join('\n')}\n}`

const argOf = (s: Extract<Stmt, { k: 'call' }>): string => {
  if (null == s.arg) return 'null'
  if (!s.wide || (0 === s.arg.length && null == s.note)) return expr({ k: 'map', entries: s.arg })
  return block([...members(s.arg, '    '), ...(null == s.note ? [] : ['    // ' + s.note])])
}

// What a bound result is cast to: a list's value is a `List<object?>` of
// entities, any other operation's the entity.
const cast = (r: Ref): string => 'many' === r.role ? '(List<object?>)' : '(IEntity)'


const Syntax: SyntaxType = {
  fence: 'csharp',
  facts,

  // Voxgig.Struct holds StructUtils, which the printed reads use.
  imports: (desc, used) => [`using ${desc.layout.module};`, ...(used.print || used.field ? ['using Voxgig.Struct;'] : [])],

  client: (s, desc) => [
    0 === s.options.length
      ? `var client = new ${desc.layout.ctor}();`
      : `var client = new ${desc.layout.ctor}(${block(members(s.options, '    '))});`,
  ],

  call: (s) => {
    const call = `client.${s.entity.sym.accessor}().${(facts.method as any)[s.op]}(${argOf(s)})`
    return [null == s.bind ? `${call};` : `var ${name(s.bind)} = ${cast(s.bind)}${call}!;`]
  },

  each: (s, inner) => [
    `foreach (var ${name(s.item)} in ${name(s.of)})`,
    '{',
    ...indentLines(inner(s.body), '    '),
    '}',
  ],

  print: (s) => [`Console.WriteLine(StructUtils.Jsonify(${expr(s.what)}));`],

  attempt: (s, inner) => [
    'try',
    '{',
    ...indentLines(inner(s.body), '    '),
    '}',
    'catch (Exception err)',
    '{',
    `    Console.WriteLine($"${s.what} failed: {err.Message}");`,
    '}',
  ],

  comment: (text) => '// ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => canonToType(t, 'csharp'),
    key: (container, path) => container + path.map((k) => `[${str(k)}]`).join(''),
    instance: (e) => [`var ${e.sym.var} = client.${e.sym.accessor}();`],
    read: (value, key, truth) => `${value}[${str(key)}]` + (truth ? ' is true' : ''),
  },

  notes: {
    'member:streamIterator': 'It also ends early once its own `cancel` token is cancelled.',
  },
}


export {
  Syntax
}
