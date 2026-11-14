// A language-neutral representation of an example program, the builders the
// shared documentation components call, and the interface a target's syntax
// provider implements to print it. Nothing here reads the model: examples are
// built from an SdkDescription.

import type { DescArg, DescOption, Scalar, SdkDescription } from './sdkdesc'


// ---- the representation

type Ent = { name: string, Name: string }

// A value an example names. `role` says what it holds, so a printer can
// choose its identifier: the entities a list returned, one of them, the one a
// load returned, the one a create returned.
type Ref = { role: 'many' | 'item' | 'one' | 'created', entity: Ent }

type Expr =
  | { k: 'lit', type: Scalar, text: string } // a typed literal; `text` when it is a string
  | { k: 'str', text: string } // a plain string
  | { k: 'env', name: string } // an environment variable, read
  | { k: 'record', of: Ref } // the record a returned entity holds
  | { k: 'field', of: Ref, field: string } // one field of that record
  | { k: 'map', entries: Entry[] }

type Entry = { key: string, value: Expr }

type Stmt =
  | { k: 'client', options: Entry[] } // construct the client; [] for none
  | { k: 'call', entity: Ent, op: string, arg: Entry[] | null, bind: Ref | null }
  | { k: 'each', item: Ref, of: Ref, body: Stmt[] }
  | { k: 'print', what: Expr }
  | { k: 'attempt', what: string, body: Stmt[] } // report a failure of `what`
  | { k: 'comment', text: string }
  | { k: 'gap' }

// A null arg on a call: the call takes no match. A create always takes data.


// ---- the builders

function entOf(desc: SdkDescription, name: string): Ent {
  const e = desc.entities.find((x) => x.name === name)
  return { name, Name: e ? e.Name : name }
}

function argEntries(args: DescArg[], of: Ref | null): Entry[] {
  return args.map((a: any) => ({
    key: a.name,
    value: null != a.fromCreated && null != of
      ? { k: 'field', of, field: a.fromCreated }
      : { k: 'lit', type: a.type, text: a.placeholder },
  }) as Entry)
}

function optionEntries(options: DescOption[]): Entry[] {
  return options.map((o: DescOption): Entry => 'server' === o.name
    ? { key: 'server', value: { k: 'map', entries: o.vars.map((v) => ({ key: v.name, value: { k: 'str', text: v.placeholder } as Expr })) } }
    : { key: o.name, value: { k: 'env', name: o.env } })
}

function clientBlock(desc: SdkDescription): Stmt[] {
  return [{ k: 'client', options: optionEntries(desc.options) }]
}

function listBlock(desc: SdkDescription): Stmt[] | null {
  const q = desc.quick
  if (null == q || null == q.list) return null
  const entity = entOf(desc, q.entity)
  const many: Ref = { role: 'many', entity }
  const item: Ref = { role: 'item', entity }
  return [{
    k: 'attempt', what: 'list', body: [
      { k: 'call', entity, op: 'list', arg: 0 < q.list.length ? argEntries(q.list, null) : null, bind: many },
      { k: 'each', item, of: many, body: [{ k: 'print', what: { k: 'record', of: item } }] },
    ],
  }]
}

function loadBlock(desc: SdkDescription): Stmt[] | null {
  const q = desc.quick
  if (null == q || null == q.load) return null
  const entity = entOf(desc, q.load.entity)
  const one: Ref = { role: 'one', entity }
  return [{
    k: 'attempt', what: 'load', body: [
      { k: 'call', entity, op: 'load', arg: 0 < q.load.args.length ? argEntries(q.load.args, null) : null, bind: one },
      { k: 'print', what: { k: 'record', of: one } },
    ],
  }]
}

const WRITE_OPS = ['create', 'update', 'patch', 'remove']

function writeOps(desc: SdkDescription): string[] {
  const q: any = desc.quick
  return null == q ? [] : WRITE_OPS.filter((o) => null != q[o])
}

function writeBlock(desc: SdkDescription): Stmt[] | null {
  const q: any = desc.quick
  const ops = writeOps(desc)
  if (0 === ops.length) return null
  const entity = entOf(desc, q.entity)
  const created: Ref = { role: 'created', entity }
  const out: Stmt[] = []
  for (const op of ops) {
    if (0 < out.length) out.push({ k: 'gap' })
    const chained = (q[op] as DescArg[]).some((a: any) => null != a.fromCreated)
    out.push({ k: 'comment', text: WRITE_COMMENT[op](chained) })
    out.push({
      k: 'call', entity, op,
      arg: 'create' === op || 0 < q[op].length ? argEntries(q[op], created) : null,
      bind: 'create' === op ? created : null,
    })
  }
  return out
}

const WRITE_COMMENT: Record<string, (chained: boolean) => string> = {
  create: () => 'Create — returns the created entity',
  update: (chained) => 'Update' + (chained ? ' — the id comes off the created entity\'s record' : ''),
  patch: (chained) => 'Patch — sends only the fields given' +
    (chained ? '; the id comes off the created entity\'s record' : ''),
  remove: () => 'Remove',
}


// What a block uses, for a printer that declares imports.
type Uses = { env: boolean, field: boolean, entities: string[] }

function uses(stmts: Stmt[]): Uses {
  const found: Uses = { env: false, field: false, entities: [] }
  const expr = (e: Expr): void => {
    if ('env' === e.k) found.env = true
    if ('field' === e.k) found.field = true
    if ('map' === e.k) e.entries.forEach((en) => expr(en.value))
  }
  const walk = (s: Stmt): void => {
    if ('client' === s.k) s.options.forEach((en) => expr(en.value))
    if ('call' === s.k) {
      if (!found.entities.includes(s.entity.name)) found.entities.push(s.entity.name)
      ; (s.arg || []).forEach((en) => expr(en.value))
    }
    if ('print' === s.k) expr(s.what)
    if ('each' === s.k || 'attempt' === s.k) s.body.forEach(walk)
  }
  stmts.forEach(walk)
  return found
}


// ---- the provider interface

// What one section's printing has declared so far; a printer that hoists a
// declaration (a handle, an error slot) records it here.
// `section` is every statement the section prints, known before its first
// block, for a printer that declares ahead what later blocks use.
type Scope = { declared: Set<string>, local: Set<string>, stmts: Stmt[], section: Stmt[] }

// The words the shared prose uses for this runtime's parts. Data, not text:
// the sentences that hold them are written once.
type RuntimeWords = {
  op: (name: string) => string // how the prose names an operation: `list()`
  many: string // what a list returns: 'an array'
  fails: string // how an operation reports failure: 'throws on failure'
  data: string // what reads an entity's record: '`.data()`'
}

type Syntax = {
  fence: string // the code fence language
  words: RuntimeWords
  // Each printer returns lines; `inner` prints nested statements at one more level.
  client: (s: Extract<Stmt, { k: 'client' }>, desc: SdkDescription, sc: Scope) => string[]
  call: (s: Extract<Stmt, { k: 'call' }>, desc: SdkDescription, sc: Scope) => string[]
  each: (s: Extract<Stmt, { k: 'each' }>, inner: (body: Stmt[]) => string[], sc: Scope) => string[]
  print: (s: Extract<Stmt, { k: 'print' }>, sc: Scope) => string[]
  attempt: (s: Extract<Stmt, { k: 'attempt' }>, inner: (body: Stmt[]) => string[], sc: Scope) => string[]
  comment: (text: string) => string
  expr: (e: Expr, sc: Scope) => string
  // Optional: lines a block needs ahead of its statements (a hoisted handle).
  before?: (stmts: Stmt[], desc: SdkDescription, sc: Scope) => string[]
}


function printStmts(p: Syntax, stmts: Stmt[], desc: SdkDescription, sc: Scope): string[] {
  const inner = (body: Stmt[]) => printStmts(p, body, desc, sc)
  const out: string[] = []
  for (const s of stmts) {
    switch (s.k) {
      case 'client': out.push(...p.client(s, desc, sc)); break
      case 'call': out.push(...p.call(s, desc, sc)); break
      case 'each': out.push(...p.each(s, inner, sc)); break
      case 'print': out.push(...p.print(s, sc)); break
      case 'attempt': out.push(...p.attempt(s, inner, sc)); break
      case 'comment': out.push(p.comment(s.text)); break
      case 'gap': out.push(''); break
    }
  }
  return out
}


// A whole code block: the fence, the provider's lines, the closing fence.
function printBlock(p: Syntax, stmts: Stmt[], desc: SdkDescription, sc: Scope): string {
  sc.local = new Set()
  sc.stmts = stmts
  const lines = [...(p.before ? p.before(stmts, desc, sc) : []), ...printStmts(p, stmts, desc, sc)]
  return '```' + p.fence + '\n' + lines.join('\n') + '\n```\n'
}


function newScope(): Scope {
  return { declared: new Set(), local: new Set(), stmts: [], section: [] }
}


function indent(lines: string[], by: string): string[] {
  return lines.map((l) => '' === l ? l : by + l)
}


export type {
  Ent,
  Entry,
  Expr,
  Ref,
  RuntimeWords,
  Scope,
  Stmt,
  Syntax,
  Uses,
}

export {
  clientBlock,
  indent,
  listBlock,
  newScope,
  loadBlock,
  printBlock,
  printStmts,
  uses,
  writeBlock,
  writeOps,
}
