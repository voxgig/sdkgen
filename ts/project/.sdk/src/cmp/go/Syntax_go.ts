import { indentLines, uses } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RuntimeFacts, Scope, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'List', load: 'Load', create: 'Create', update: 'Update', patch: 'Patch', remove: 'Remove' },
  named: 'call',
  async: false,
  result: 'pair',
  collection: '`[]any`',
  record: 'Data()',
  errVar: 'err',
  prints: 'record',
}

const str = (s: string): string => JSON.stringify(s).replace(/﻿/g, '\\ufeff')

const name = (r: Ref): string =>
  'item' === r.role ? 'item' : ('created' === r.role ? 'created' :
    ('many' === r.role ? r.entity.sym.vars : r.entity.sym.var))

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: '1', NUMBER: '1', BOOLEAN: 'true', ARRAY: '[]any{}', OBJECT: 'map[string]any{}', NULL: 'nil',
} as Record<string, string>)[e.type] ?? str(e.text)

const data = (r: Ref): string => `${name(r)}.(sdk.Entity).Data()`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return str(e.text)
    case 'env': return `os.Getenv(${str(e.name)})`
    case 'record': return data(e.of)
    case 'field': return `${data(e.of)}.(map[string]any)[${str(e.field)}]`
    case 'fields': return e.fields.map((f) => `${data(e.of)}.(map[string]any)[${str(f)}]`).join(', ')
    case 'map': return 'map[string]any{' + e.entries.map(pair).join(', ') + '}'
  }
}

const pair = (en: Entry): string => `${str(en.key)}: ${expr(en.value)}`

const members = (entries: Entry[], pad: string): string[] =>
  entries.flatMap((en) => 'map' === en.value.k
    ? [`${pad}${str(en.key)}: map[string]any{`, ...members(en.value.entries, pad + '    '), `${pad}},`]
    : [`${pad}${pair(en)},`])

// Operations return (value, error): the error is checked where it is made.
const check = ['if err != nil {', '    panic(err)', '}']

// `:=` declares err the first time in a function, `=` reuses it.
const bindErr = (bound: string | null, sc: Scope): string => {
  if (null != bound) {
    sc.local.add('err')
    return `${bound}, err :=`
  }
  const op = sc.local.has('err') ? '=' : ':='
  sc.local.add('err')
  return `_, err ${op}`
}


const Syntax: SyntaxType = {
  fence: 'go',
  facts,

  client: (s, desc) => [
    0 === s.options.length
      ? `client := sdk.${desc.layout.ctor}(nil)`
      : `client := sdk.${desc.layout.ctor}(map[string]any{\n${members(s.options, '    ').join('\n')}\n})`,
  ],

  call: (s, _desc, sc) => {
    const arg = null == s.arg ? 'nil' : expr({ k: 'map', entries: s.arg })
    return [
      `${bindErr(null == s.bind ? null : name(s.bind), sc)} client.${s.entity.sym.accessor}(nil).${(facts.method as any)[s.op]}(${arg}, nil)`,
      ...check,
    ]
  },

  each: (s, inner) => [
    `for _, ${name(s.item)} := range ${name(s.of)}.([]any) {`,
    ...indentLines(inner(s.body), '    '),
    '}',
  ],

  print: (s) => [`fmt.Println(${expr(s.what)})`],

  // The check each call carries is the handling; go has no block to open.
  attempt: (s, inner) => inner(s.body),

  comment: (text) => '// ' + text,

  expr: (e) => expr(e),

  // A complete program: what the steps use is imported, and each step is a
  // commented paragraph of main. A client nothing calls is still used.
  program: (steps, desc, sc) => {
    const used = uses(sc.section)
    const body = steps.flatMap((s, i) => [
      ...(0 < i ? [''] : []),
      ...('' === s.title ? [] : ['// ' + s.title]),
      ...s.lines,
    ])
    if (0 === used.entities.length) body.push('_ = client')
    return [
      'package main',
      '',
      'import (',
      ...(used.print ? ['    "fmt"'] : []),
      ...(used.env ? ['    "os"'] : []),
      `    sdk ${str(desc.layout.module)}`,
      ')',
      '',
      'func main() {',
      ...indentLines(body, '    '),
      '}',
    ]
  },
}


export {
  Syntax
}
