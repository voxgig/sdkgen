import { exampleVarName, indentLines, jsKey, jsProp, jsQuote } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, Syntax as SyntaxType } from '@voxgig/sdkgen'


const WRITES = ['create', 'update', 'patch', 'remove']

const name = (r: Ref): string => {
  const v = exampleVarName(r.entity.Name.toLowerCase(), 'ts')
  return 'many' === r.role ? v + 's' : ('created' === r.role ? 'created' : v)
}

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
    case 'map': return '{ ' + e.entries.map(pair).join(', ') + ' }'
  }
}

const pair = (en: Entry): string => `${jsKey(en.key)}: ${expr(en.value)}`

// One member per line, closed with a trailing comma, at the given depth: a
// write's data, and a load match of more than one member.
const members = (entries: Entry[], pad: string): string[] =>
  entries.flatMap((en) => 'map' === en.value.k
    ? [`${pad}${jsKey(en.key)}: {`, ...members(en.value.entries, pad + '  '), `${pad}},`]
    : [`${pad}${pair(en)},`])

const argOf = (op: string, arg: Entry[] | null): string =>
  null == arg ? '' : (0 === arg.length ? '{}' :
    (WRITES.includes(op) || ('load' === op && 1 < arg.length)) ? '{\n' + members(arg, '  ').join('\n') + '\n}'
      : '{ ' + arg.map(pair).join(', ') + ' }')


const Syntax: SyntaxType = {
  fence: 'ts',

  words: {
    op: (op) => '`' + op + '()`',
    many: 'an array',
    fails: 'throws on failure',
    data: '`.data()`',
  },

  client: (s, desc) => [
    `import { ${desc.Name}SDK } from '${desc.package}'`,
    '',
    0 === s.options.length
      ? `const client = new ${desc.Name}SDK()`
      : `const client = new ${desc.Name}SDK({\n${members(s.options, '  ').join('\n')}\n})`,
  ],

  call: (s) => {
    const call = `await client.${s.entity.Name}().${s.op}(${argOf(s.op, s.arg)})`
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
