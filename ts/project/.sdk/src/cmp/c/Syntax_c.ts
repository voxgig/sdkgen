import { indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'call',
  async: false,
  result: 'errslot',
  collection: '`NULL`-terminated array',
  record: 'vt->data',
  errVar: 'err',
  errSlot: '*err',
  nullValue: 'NULL',
  prints: 'record',
}

const str = (s: string): string => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'

// The entity handle an operation is called on.
const handle = (e: Ref['entity']): string => e.sym.var

const name = (r: Ref): string => {
  switch (r.role) {
    case 'many': return r.entity.sym.vars
    case 'item': return r.entity.sym.vars + '[i]'
    case 'one': return 'loaded'
    case 'created': return 'created'
  }
}

// A field read off a created record is hoisted into a variable of its own.
const fieldVar = (r: Ref, field: string): string => name(r) + '_' + ((r.entity.sym.fields || {})[field] ?? field)

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: 'v_num(1)', NUMBER: 'v_num(1)', BOOLEAN: 'v_bool(true)', ARRAY: 'v_list()', OBJECT: 'v_map()', NULL: 'v_null()',
} as Record<string, string>)[e.type] ?? `v_str(${str(e.text)})`

const cmap = (entries: Entry[]): string =>
  0 === entries.length ? 'NULL'
    : `cmap(${entries.length}, ${entries.map((en) => `${str(en.key)}, ${expr(en.value)}`).join(', ')})`

const data = (r: Ref): string => `${name(r)}->vt->data(${name(r)}, NULL)`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return `v_str(${str(e.text)})`
    case 'env': return `v_str(getenv(${str(e.name)}))`
    case 'record': return `voxgig_to_json(${data(e.of)})`
    case 'field': return fieldVar(e.of, e.field)
    case 'fields': return e.fields.map((f) => `voxgig_to_json(getp(${data(e.of)}, ${str(f)}))`).join(', ')
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
  facts,

  client: (s, desc) => [
    // getenv is declared in stdlib.h, which core/api.h does not include.
    ...(s.options.some((en) => 'env' === en.value.k) ? ['#include <stdlib.h>'] : []),
    `#include "${desc.layout.module}"`,
    '',
    0 === s.options.length
      ? `${desc.layout.client}* client = ${desc.layout.ctor}(NULL);`
      : `${desc.layout.client}* client = ${desc.layout.ctor}(cmap(${s.options.length},\n` +
      s.options.map((en) => `    ${str(en.key)}, ${expr(en.value)}`).join(',\n') + '));',
  ],

  // The error slot and each entity's handle are declared once, ahead of the
  // first block that calls an operation.
  before: (stmts, _desc, sc) => {
    const out: string[] = []
    const found = calls(stmts)
    if (0 < found.length && !sc.declared.has('err')) {
      sc.declared.add('err')
      out.push('PNError* err = NULL;')
    }
    for (const s of found) {
      const h = handle(s.entity)
      if (sc.declared.has(h)) continue
      sc.declared.add(h)
      out.push(`Entity* ${h} = ${s.entity.sym.accessor}(client, NULL);`)
    }
    return out
  },

  call: (s, _desc, sc) => {
    const h = handle(s.entity)
    const call = `${h}->vt->${(facts.method as any)[s.op]}(${h}, ${cmap(s.arg || [])}, NULL, &err);`
    if (null == s.bind) return [call]
    const type = 'many' === s.bind.role ? 'Entity**' : 'Entity*'
    const out = [`${type} ${name(s.bind)} = ${call}`]
    for (const field of reads(sc.stmts, s.bind)) {
      out.push(`voxgig_value* ${fieldVar(s.bind, field)} = ${name(s.bind)}`,
        `    ? getp(${data(s.bind)}, ${str(field)}) : v_undef();`)
    }
    return out
  },

  each: (s, inner) => [
    `for (size_t i = 0; ${name(s.of)}[i]; i++) {`,
    ...indentLines(inner(s.body), '    '),
    '}',
  ],

  print: (s) => 'fields' === s.what.k
    ? [`printf("${s.what.fields.map(() => '%s').join(' ')}\\n", ${expr(s.what)});`]
    : [`printf("%s\\n", ${expr(s.what)});`],

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
