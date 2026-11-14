import { indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RuntimeFacts, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'call',
  async: false,
  result: 'raise',
  collection: '`list`',
  record: 'data_get()',
  recordType: 'dict',
  prints: 'record',
}

const str = (s: string): string => JSON.stringify(s)

const name = (r: Ref): string =>
  'many' === r.role ? r.entity.sym.vars : ('created' === r.role ? 'created' : r.entity.sym.var)

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
    case 'fields': return e.fields.map((f) => `${name(e.of)}.data_get().get(${str(f)})`).join(', ')
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
  facts,

  client: (s, desc) => [
    ...(s.options.some((en) => 'env' === en.value.k) ? ['import os'] : []),
    `from ${desc.layout.module} import ${desc.layout.client}`,
    '',
    0 === s.options.length
      ? `client = ${desc.layout.ctor}()`
      : `client = ${desc.layout.ctor}({\n${members(s.options, '    ').join('\n')}\n})`,
  ],

  call: (s) => {
    const call = `client.${s.entity.sym.accessor}().${(facts.method as any)[s.op]}(${null == s.arg ? '' : expr({ k: 'map', entries: s.arg })})`
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
