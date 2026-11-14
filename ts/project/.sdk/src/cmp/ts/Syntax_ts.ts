import { indentLines, jsKey, jsProp, jsQuote } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RuntimeFacts, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'call',
  async: true,
  result: 'throw',
  collection: 'array',
  record: '.data()',
  prints: 'record',
}

const name = (r: Ref): string =>
  'many' === r.role ? r.entity.sym.vars : ('created' === r.role ? 'created' : r.entity.sym.var)

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

// One member per line, closed with a trailing comma, at the given depth.
const members = (entries: Entry[], pad: string): string[] =>
  entries.flatMap((en) => 'map' === en.value.k
    ? [`${pad}${jsKey(en.key)}: {`, ...members(en.value.entries, pad + '  '), `${pad}},`]
    : [`${pad}${pair(en)},`])

const argOf = (arg: Entry[] | null, wide: boolean): string =>
  null == arg ? '' : (0 === arg.length ? '{}' :
    wide ? '{\n' + members(arg, '  ').join('\n') + '\n}' : '{ ' + arg.map(pair).join(', ') + ' }')


const Syntax: SyntaxType = {
  fence: 'ts',
  facts,

  client: (s, desc) => [
    `import { ${desc.layout.client} } from '${desc.layout.module}'`,
    '',
    0 === s.options.length
      ? `const client = new ${desc.layout.ctor}()`
      : `const client = new ${desc.layout.ctor}({\n${members(s.options, '  ').join('\n')}\n})`,
  ],

  call: (s) => {
    const call = `await client.${s.entity.sym.accessor}().${(facts.method as any)[s.op]}(${argOf(s.arg, s.wide)})`
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
}


export {
  Syntax
}
