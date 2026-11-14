import { camelify, exampleVarName, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, Scope, Syntax as SyntaxType } from '@voxgig/sdkgen'


const str = (s: string): string => JSON.stringify(s).replace(/﻿/g, '\\ufeff')

const varName = (n: string): string => {
  const pascal = camelify(n)
  return exampleVarName(pascal.charAt(0).toLowerCase() + pascal.slice(1), 'go')
}

const name = (r: Ref): string =>
  'item' === r.role ? 'item' : ('created' === r.role ? 'created' :
    varName(r.entity.name) + ('many' === r.role ? 's' : ''))

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
    case 'map': return 'map[string]any{' + e.entries.map(pair).join(', ') + '}'
  }
}

const pair = (en: Entry): string => `${str(en.key)}: ${expr(en.value)}`

const members = (entries: Entry[], pad: string): string[] =>
  entries.flatMap((en) => 'map' === en.value.k
    ? [`${pad}${str(en.key)}: map[string]any{`, ...members(en.value.entries, pad + '    '), `${pad}},`]
    : [`${pad}${pair(en)},`])

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

// Operations return (value, error): the error is checked where it is made.
const check = ['if err != nil {', '    panic(err)', '}']

// `:=` declares err the first time in a block, `=` reuses it.
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

  words: {
    op: (op) => '`' + cap(op) + '()`',
    many: 'a `[]any`',
    fails: 'reports failure in a non-nil `err`',
    data: '`Data()`',
  },

  client: (s, desc) => [
    ...(s.options.some((en) => 'env' === en.value.k) ? ['import "os"'] : []),
    `import sdk ${str(desc.package)}`,
    '',
    0 === s.options.length
      ? 'client := sdk.New()'
      : `client := sdk.New${desc.Name}SDK(map[string]any{\n${members(s.options, '    ').join('\n')}\n})`,
  ],

  call: (s, _desc, sc) => {
    const arg = null == s.arg ? 'nil' : expr({ k: 'map', entries: s.arg })
    return [
      `${bindErr(null == s.bind ? null : name(s.bind), sc)} client.${s.entity.Name}(nil).${cap(s.op)}(${arg}, nil)`,
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
}


export {
  Syntax
}
