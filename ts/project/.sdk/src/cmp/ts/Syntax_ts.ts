import { canonToType, indentLines, jsKey, jsProp, jsQuote } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'call',
  async: true,
  result: 'throw',
  collection: 'array',
  record: '.data()',
  listOf: '{Class}[]',
  prints: 'record',
}

// The fixed API the reference page documents: EntityBase.fragment.ts,
// Entity.fragment.ts and Main.fragment.ts.
const refFacts: RefFacts = {
  entityBy: 'class',
  noun: 'Methods',
  none: 'undefined',
  keys: 'member',
  maps: 'objects',
  container: 'object',
  valueType: { STRING: 'string', OBJECT: 'object', ANY: 'any' },
  ctor: ['new {ctor}(options?: object)'],
  test: [{ sig: '{client}.test(testopts?, sdkopts?)', call: 'const client = {client}.test()', args: true }],
  accessor: { sig: '{accessor}(entopts?: object)', arg: 'entopts', param: 'entopts' },
  op: {
    list: 'list(match?: object, ctrl?: object)',
    load: 'load(match?: object, ctrl?: object)',
    create: 'create(data?: object, ctrl?: object)',
    update: 'update(data?: object, ctrl?: object)',
    patch: 'patch(data?: object, ctrl?: object)',
    remove: 'remove(match?: object, ctrl?: object)',
  },
  client: [
    { kind: 'options', sig: 'options()', returns: 'object' },
    { kind: 'utility', sig: 'utility()', returns: 'object' },
    { kind: 'direct', sig: 'direct(fetchargs?: object)' },
    { kind: 'prepare', sig: 'prepare(fetchargs?: object)' },
    { kind: 'tester', sig: 'tester(testopts?, sdkopts?)' },
  ],
  entity: [
    { kind: 'data', sig: 'data(data?: object)', copy: true },
    { kind: 'match', sig: 'match(match?: object)' },
    { kind: 'make', sig: 'make()' },
    { kind: 'streamIterator', sig: 'stream(action: string, args?: object, callopts?: object)', runs: 'iterate' },
    { kind: 'client', sig: 'client()' },
    { kind: 'entopts', sig: 'entopts()' },
  ],
  direct: { returns: 'Promise<{ ok, status, headers, data }>', signal: 'AbortSignal', abortCode: 'request_aborted', okFalse: 'false' },
  prepare: { returns: 'Promise<{ url, method, headers, body } | Error>', fails: 'value' },
  body: { values: 'a `Buffer`, `Uint8Array`, `ArrayBuffer`, `Blob`, stream or string', once: 'a stream' },
  cancel: true,
}

const name = (r: Ref): string => r.name

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: '1', NUMBER: '1', BOOLEAN: 'true', ARRAY: '[]', OBJECT: '{}', NULL: 'null',
} as Record<string, string>)[e.type] ?? jsQuote(e.text)

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return jsQuote(e.text)
    case 'env': return 'process.env.' + e.name
    case 'record': return name(e.of) + '.data()'
    case 'field': return jsProp(name(e.of) + '.data()', e.field) + '!'
    case 'fields': return e.fields.map((f) => jsProp(name(e.of) + '.data()', f)).join(', ')
    case 'map': return '{ ' + e.entries.map(pair).join(', ') + ' }'
  }
}

const pair = (en: Entry): string => `${jsKey(en.key)}: ${expr(en.value)}`

// One member per line, closed with a trailing comma and its type where it
// has one; a map two levels down stays on its member's line.
const members = (entries: Entry[], pad: string, depth = 0): string[] =>
  entries.flatMap((en) => 'map' === en.value.k && 0 === depth
    ? [`${pad}${jsKey(en.key)}: {`, ...members(en.value.entries, pad + '  ', depth + 1), `${pad}},`]
    : [`${pad}${pair(en)},` + (null == en.type ? '' : ' // ' + canonToType(en.type, 'ts'))])

const argOf = (arg: Entry[] | null, wide: boolean, note?: string): string =>
  null == arg ? '' : (0 === arg.length && null == note ? '{}' :
    wide ? '{\n' + [...members(arg, '  '), ...(null == note ? [] : ['  // ' + note])].join('\n') + '\n}'
      : '{ ' + arg.map(pair).join(', ') + ' }')


const Syntax: SyntaxType = {
  fence: 'ts',
  facts,

  imports: (desc) => [`import { ${desc.layout.client} } from '${desc.layout.module}'`],

  client: (s, desc) => [
    0 === s.options.length
      ? `const client = new ${desc.layout.ctor}()`
      : `const client = new ${desc.layout.ctor}({\n${members(s.options, '  ').join('\n')}\n})`,
  ],

  call: (s) => {
    const call = `await client.${s.entity.sym.accessor}().${(facts.method as any)[s.op]}(${argOf(s.arg, s.wide, s.note)})`
    return (null == s.bind ? call : `const ${name(s.bind)} = ${call}`).split('\n')
  },

  each: (s, inner) => [
    `for (const ${name(s.item)} of ${name(s.of)}) {`,
    ...indentLines(inner(s.body), '  '),
    '}',
  ],

  print: (s) => [`console.log(${expr(s.what)})`],

  attempt: (s, inner) => [
    'try {',
    ...indentLines(inner(s.body), '  '),
    '} catch (err) {',
    `  console.error('${s.what} failed:', err)`,
    '}',
  ],

  comment: (text) => '// ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => canonToType(t, 'ts'),
    key: (container, path) => [container, ...path].join('.'),
    instance: (e) => [`const ${e.sym.var} = client.${e.sym.accessor}()`],
    read: (value, key) => jsProp(value, key),
  },
}


export {
  Syntax
}
