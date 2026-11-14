import { canonToType, indentLines, uses } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Scope, Syntax as SyntaxType } from '@voxgig/sdkgen'


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

// The fixed API the reference page documents: Entity.fragment.go,
// Main.fragment.go, MainEntity_go and Main_go (Test).
const refFacts: RefFacts = {
  classes: true,
  noun: 'Methods',
  none: 'nil',
  keys: 'member',
  maps: 'maps',
  valueType: { STRING: 'string', OBJECT: 'map[string]any', ANY: 'any' },
  ctor: ['func {ctor}(options map[string]any) *{client}'],
  test: [
    { sig: 'Test() *{client}', call: 'client := sdk.Test()', args: false },
    { sig: 'TestSDK(testopts, sdkopts map[string]any) *{client}', call: 'client := sdk.TestSDK(testopts, sdkopts)', args: true },
  ],
  accessor: { sig: '{accessor}(data map[string]any) {sdk}EntityBase', arg: 'data' },
  op: {
    list: 'List(reqmatch, ctrl map[string]any) (any, error)',
    load: 'Load(reqmatch, ctrl map[string]any) (any, error)',
    create: 'Create(reqdata, ctrl map[string]any) (any, error)',
    update: 'Update(reqdata, ctrl map[string]any) (any, error)',
    patch: 'Patch(reqdata, ctrl map[string]any) (any, error)',
    remove: 'Remove(reqmatch, ctrl map[string]any) (any, error)',
  },
  client: [
    { kind: 'options', sig: 'OptionsMap() map[string]any' },
    { kind: 'utility', sig: 'GetUtility() *Utility' },
    { kind: 'direct', sig: 'Direct(fetchargs map[string]any) (map[string]any, error)' },
    { kind: 'prepare', sig: 'Prepare(fetchargs map[string]any) (map[string]any, error)' },
  ],
  entity: [
    { kind: 'data', sig: 'Data(args ...any) any' },
    { kind: 'match', sig: 'Match(args ...any) any' },
    { kind: 'make', sig: 'Make() Entity' },
    { kind: 'streamChannel', sig: 'Stream(action string, args map[string]any, callopts map[string]any) <-chan StreamItem' },
    { kind: 'name', sig: 'GetName() string' },
  ],
  direct: { returns: '(map[string]any, error)' },
  prepare: { returns: '(map[string]any, error)', fails: 'style' },
  body: { values: 'a `[]byte`, a `string` or an `io.Reader`', once: 'an `io.Reader`' },
  cancel: false,
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

// A map two levels down stays on its member's line.
const members = (entries: Entry[], pad: string, depth = 0): string[] =>
  entries.flatMap((en) => 'map' === en.value.k && 0 === depth
    ? [`${pad}${str(en.key)}: map[string]any{`, ...members(en.value.entries, pad + '    ', depth + 1), `${pad}},`]
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

  ref: {
    facts: refFacts,
    type: (t) => canonToType(t, 'go'),
    key: (container, path) => container + path.map((k) => `[${str(k)}]`).join(''),
    instance: (e) => [`${e.sym.var} := client.${e.sym.accessor}(nil)`],
  },

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
