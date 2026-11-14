import { canonKey, canonToType, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


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

// The fixed API the reference page documents: core/sdk.h (the Entity
// vtable), Main.fragment.c, MainEntity_c and EntityBase_c (`<evar>_stream`).
const refFacts: RefFacts = {
  entityBy: 'Name',
  noun: 'Functions',
  none: 'NULL',
  keys: 'bare',
  maps: 'maps',
  container: 'voxgig_value*',
  valueType: { STRING: 'string', OBJECT: 'map', ANY: 'any' },
  ctor: ['#include "{module}"', '', '{client}* client = {ctor}(options);'],
  test: [{ sig: '{client}* test_sdk(voxgig_value* testopts, voxgig_value* sdkopts)', call: '{client}* client = test_sdk(NULL, NULL);', args: true }],
  accessor: { sig: 'Entity* {accessor}({client}* client, voxgig_value* entopts)', arg: 'entopts' },
  op: {
    list: 'Entity** vt->list(Entity* e, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err)',
    load: 'Entity* vt->load(Entity* e, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err)',
    create: 'Entity* vt->create(Entity* e, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err)',
    update: 'Entity* vt->update(Entity* e, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err)',
    patch: 'Entity* vt->patch(Entity* e, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err)',
    remove: 'Entity* vt->remove(Entity* e, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err)',
  },
  client: [
    { kind: 'direct', sig: 'voxgig_value* sdk_direct({client}* client, voxgig_value* fetchargs, PNError** err)' },
    { kind: 'prepare', sig: 'voxgig_value* sdk_prepare({client}* client, voxgig_value* fetchargs, PNError** err)' },
  ],
  entity: [
    { kind: 'dataArg', sig: 'voxgig_value* vt->data(Entity* e, voxgig_value* args)' },
    { kind: 'matchArg', sig: 'voxgig_value* vt->matchv(Entity* e, voxgig_value* args)' },
    { kind: 'make', sig: 'Entity* vt->make(Entity* e)' },
    { kind: 'streamList', sig: 'voxgig_value* {var}_stream(Entity* e, const char* action, voxgig_value* args, voxgig_value* callopts, PNError** err)' },
    { kind: 'name', sig: 'const char* vt->get_name(Entity* e)' },
  ],
  direct: { returns: 'voxgig_value*' },
  prepare: { returns: 'voxgig_value*', fails: 'style' },
  body: { values: 'a string value holding the bytes, such as `voxgig_new_string_n`' },
  cancel: false,
}

const str = (s: string): string => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'

// The entity handle an operation is called on.
const handle = (e: Ref['entity']): string => e.sym.var

// C has no loop variable: an item is its list indexed. The entity's handle
// already holds the entity's own name, so a loaded entity bound to the same
// name is renamed rather than shadowing it.
const name = (r: Ref): string => {
  if ('item' === r.role) return r.list + '[i]'
  if ('one' === r.role && r.name === handle(r.entity)) return 'loaded'
  return r.name
}

// A field read off a created record is hoisted into a variable of its own.
const fieldVar = (r: Ref, field: string): string => name(r) + '_' + ((r.entity.sym.fields || {})[field] ?? field)

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: 'v_num(1)', NUMBER: 'v_num(1)', BOOLEAN: 'v_bool(true)', ARRAY: 'v_list()', OBJECT: 'v_map()', NULL: 'v_null()',
} as Record<string, string>)[e.type] ?? `v_str(${str(e.text)})`

const cmap = (entries: Entry[]): string =>
  0 === entries.length ? 'NULL'
    : `cmap(${entries.length}, ${entries.map((en) => `${str(en.key)}, ${expr(en.value)}`).join(', ')})`

// A write's data laid out a member per line, each with its type, closed by its
// note; the call's remaining arguments follow on a line of their own.
const wideMap = (entries: Entry[], note?: string): string => {
  const lines = entries.map((en, i) => `    ${str(en.key)}, ${expr(en.value)}` +
    (i === entries.length - 1 ? ')' : ',') +
    (null == en.type ? '' : '  // ' + canonToType(en.type, 'c')))
  if (null != note) lines.push(`    // ${note}`)
  return `cmap(${entries.length},\n${lines.join('\n')}\n`
}

const laidOut = (s: Extract<Stmt, { k: 'call' }>): boolean =>
  s.wide && null != s.arg && 0 < s.arg.length && (null != s.note || s.arg.some((en) => null != en.type))

// Bound outside error handling: what is printed of it is guarded.
const UNCHECKED = 'unchecked:'

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

// An option whose value is a map of maps is laid out one member per line.
const option = (e: Expr): string => 'map' === e.k && e.entries.some((en) => 'map' === en.value.k)
  ? `cmap(${e.entries.length},\n` + e.entries.map((en) => `        ${str(en.key)}, ${expr(en.value)}`).join(',\n') + ')'
  : expr(e)

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

  // getenv is declared in stdlib.h, which core/api.h does not include.
  imports: (desc, used) => [
    ...(used.env ? ['#include <stdlib.h>'] : []),
    `#include "${desc.layout.module}"`,
  ],

  client: (s, desc) => [
    0 === s.options.length
      ? `${desc.layout.client}* client = ${desc.layout.ctor}(NULL);`
      : `${desc.layout.client}* client = ${desc.layout.ctor}(cmap(${s.options.length},\n` +
      s.options.map((en) => `    ${str(en.key)}, ${option(en.value)}`).join(',\n') +
      // A member laid out one per line puts the closing of the call on its own line.
      (s.options.some((en) => option(en.value).includes('\n')) ? '\n));' : '));'),
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

  call: (s, _desc, sc, cx) => {
    const h = handle(s.entity)
    const method = (facts.method as any)[s.op]
    const call = laidOut(s)
      ? `${h}->vt->${method}(${h}, ${wideMap(s.arg as Entry[], s.note)}, NULL, &err);`
      : `${h}->vt->${method}(${h}, ${cmap(s.arg || [])}, NULL, &err);`
    if (null == s.bind) return [call]
    if (!cx.inAttempt) sc.local.add(UNCHECKED + name(s.bind))
    const type = 'many' === s.bind.role ? 'Entity**' : 'Entity*'
    const out = [`${type} ${name(s.bind)} = ${call}`]
    for (const field of reads(sc.stmts, s.bind)) {
      out.push(`voxgig_value* ${fieldVar(s.bind, field)} = ${name(s.bind)}`,
        `    ? getp(${data(s.bind)}, ${str(field)}) : v_undef();`)
    }
    return out
  },

  each: (s, inner, sc) => [
    `for (size_t i = 0; ${sc.local.has(UNCHECKED + name(s.of)) ? name(s.of) + ' && ' : ''}${name(s.of)}[i]; i++) {`,
    ...indentLines(inner(s.body), '    '),
    '}',
  ],

  print: (s, sc) => {
    const line = 'fields' === s.what.k
      ? `printf("${s.what.fields.map(() => '%s').join(' ')}\\n", ${expr(s.what)});`
      : `printf("%s\\n", ${expr(s.what)});`
    const of = 'record' === s.what.k || 'fields' === s.what.k ? name(s.what.of) : ''
    return '' !== of && sc.local.has(UNCHECKED + of) ? [`if (${of}) {`, '    ' + line, '}'] : [line]
  },

  // The call sets *err; what follows it runs only when it did not.
  attempt: (s, inner) => {
    const [first, ...rest] = s.body
    return [
      ...inner([first]),
      'if (err) {',
      `    fprintf(stderr, "${s.what} failed: %s\\n", err->msg);`,
      // A set error slot fails every later call, so it is cleared once reported.
      '    err = NULL;',
      '} else {',
      ...indentLines(inner(rest), '    '),
      '}',
    ]
  },

  comment: (text) => '// ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => {
      const k = canonKey(t)
      return canonToType(t, 'c') + ('ARRAY' === k ? ' (list)' : ('OBJECT' === k ? ' (map)' : ''))
    },
    key: (_container, path) => path.join('.'),
    instance: (e) => [`Entity* ${e.sym.var} = ${e.sym.accessor}(client, NULL);`],
    read: (value, key) => `getp(${value}, ${str(key)})`,
  },
}


export {
  Syntax
}
