import { exampleVarName, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, Syntax as SyntaxType } from '@voxgig/sdkgen'


const str = (s: string): string => JSON.stringify(s)

const name = (r: Ref): string => {
  const v = exampleVarName(r.entity.Name.toLowerCase(), 'py')
  return 'many' === r.role ? v + 's' : ('created' === r.role ? 'created' : v)
}

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
    case 'map': return '{' + e.entries.map(pair).join(', ') + '}'
  }
}

const pair = (en: Entry): string => `${str(en.key)}: ${expr(en.value)}`

const members = (entries: Entry[], pad: string): string[] =>
  entries.flatMap((en) => 'map' === en.value.k
    ? [`${pad}${str(en.key)}: {`, ...members(en.value.entries, pad + '    '), `${pad}},`]
    : [`${pad}${pair(en)},`])


const Syntax: SyntaxType = {
  fence: 'python',

  words: {
    op: (op) => '`' + op + '()`',
    many: 'a `list`',
    fails: 'raises on failure',
    data: '`data_get()`',
  },

  client: (s, desc) => [
    ...(s.options.some((en) => 'env' === en.value.k) ? ['import os'] : []),
    `from ${desc.Name.toLowerCase()}_sdk import ${desc.Name}SDK`,
    '',
    0 === s.options.length
      ? `client = ${desc.Name}SDK()`
      : `client = ${desc.Name}SDK({\n${members(s.options, '    ').join('\n')}\n})`,
  ],

  call: (s) => {
    const call = `client.${s.entity.Name}().${s.op}(${null == s.arg ? '' : expr({ k: 'map', entries: s.arg })})`
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
}


export {
  Syntax
}
