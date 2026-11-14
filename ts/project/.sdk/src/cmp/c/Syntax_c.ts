import { indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, Scope, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


// As utility_c's C_RESERVED, copied: that module also holds helpers that read the model.
const RESERVED = new Set<string>([
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
  'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'inline',
  'int', 'long', 'register', 'restrict', 'return', 'short', 'signed', 'sizeof',
  'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void',
  'volatile', 'while', 'bool', 'true', 'false',
])

const str = (s: string): string => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'

const varName = (n: string): string => {
  let snake = String(n).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
  if (/^[0-9]/.test(snake)) snake = '_' + snake
  return RESERVED.has(snake) ? snake + '_' : snake
}

// The entity handle an operation is called on.
const handle = (r: { name: string }): string => varName(r.name)

const name = (r: Ref): string => {
  switch (r.role) {
    case 'many': return handle(r.entity) + 's'
    case 'item': return handle(r.entity) + 's[i]'
    case 'one': return 'loaded'
    case 'created': return 'created'
  }
}

// A field read off a created record is hoisted into a variable of its own.
const fieldVar = (r: Ref, field: string): string => name(r) + '_' + varName(field)

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: 'v_num(1)', NUMBER: 'v_num(1)', BOOLEAN: 'v_bool(true)', ARRAY: 'v_list()', OBJECT: 'v_map()', NULL: 'v_null()',
} as Record<string, string>)[e.type] ?? `v_str(${str(e.text)})`

const cmap = (entries: Entry[]): string =>
  0 === entries.length ? 'NULL'
    : `cmap(${entries.length}, ${entries.map((en) => `${str(en.key)}, ${expr(en.value)}`).join(', ')})`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return `v_str(${str(e.text)})`
    case 'env': return `v_str(getenv(${str(e.name)}))`
    case 'record': return `voxgig_to_json(${name(e.of)}->vt->data(${name(e.of)}, NULL))`
    case 'field': return fieldVar(e.of, e.field)
    case 'map': return cmap(e.entries)
  }
}

const reads = (stmts: Stmt[], ref: Ref): string[] => {
  const found: string[] = []
  const visit = (e: Expr): void => {
    if ('field' === e.k && e.of.role === ref.role && !found.includes(e.field)) found.push(e.field)
    if ('map' === e.k) e.entries.forEach((en) => visit(en.value))
  }
  stmts.forEach((s) => { if ('call' === s.k) (s.arg || []).forEach((en) => visit(en.value)) })
  return found
}

const calls = (stmts: Stmt[]): Extract<Stmt, { k: 'call' }>[] => stmts.flatMap((s: Stmt) =>
  'call' === s.k ? [s] : ('attempt' === s.k || 'each' === s.k ? calls(s.body) : []))


const Syntax: SyntaxType = {
  fence: 'c',

  words: {
    op: (op) => '`' + op + '()`',
    many: 'a `NULL`-terminated array',
    fails: 'sets `*err` on failure',
    data: '`vt->data`',
  },

  client: (s, desc) => [
    // getenv is declared in stdlib.h, which core/api.h does not include.
    ...(s.options.some((en) => 'env' === en.value.k) ? ['#include <stdlib.h>'] : []),
    '#include "core/api.h"',
    '',
    0 === s.options.length
      ? `${desc.Name}SDK* client = ${desc.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_sdk_new(NULL);`
      : `${desc.Name}SDK* client = ${desc.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_sdk_new(cmap(${s.options.length},\n` +
      s.options.map((en) => `    ${str(en.key)}, ${expr(en.value)}`).join(',\n') + '));',
    'PNError* err = NULL;',
  ],

  // Each entity is reached through a handle, declared once per program.
  before: (stmts, desc, sc) => calls(stmts).flatMap((s) => {
    const h = handle(s.entity)
    if (sc.declared.has(h)) return []
    sc.declared.add(h)
    return [`Entity* ${h} = ${desc.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${h}(client, NULL);`]
  }),

  call: (s, _desc, sc) => {
    const h = handle(s.entity)
    const call = `${h}->vt->${s.op}(${h}, ${cmap(s.arg || [])}, NULL, &err);`
    if (null == s.bind) return [call]
    const type = 'many' === s.bind.role ? 'Entity**' : 'Entity*'
    const out = [`${type} ${name(s.bind)} = ${call}`]
    for (const field of reads(sc.stmts, s.bind)) {
      out.push(`voxgig_value* ${fieldVar(s.bind, field)} = ${name(s.bind)}`,
        `    ? getp(${name(s.bind)}->vt->data(${name(s.bind)}, NULL), ${str(field)}) : v_undef();`)
    }
    return out
  },

  each: (s, inner) => [
    `for (size_t i = 0; ${name(s.of)}[i]; i++) {`,
    ...indentLines(inner(s.body), '    '),
    '}',
  ],

  print: (s) => [`printf("%s\\n", ${expr(s.what)});`],

  // The call sets *err; what follows it runs only when it did not.
  attempt: (s, inner) => {
    const [first, ...rest] = s.body
    return [
      ...inner([first]),
      'if (err) {',
      `    fprintf(stderr, "${s.what} failed: %s\\n", err->msg);`,
      '} else {',
      ...indentLines(inner(rest), '    '),
      '}',
    ]
  },

  comment: (text) => '// ' + text,

  expr: (e) => expr(e),
}


export {
  Syntax
}
