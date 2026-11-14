// A language-neutral representation of an example program, the builders the
// shared documentation components call, and the interface a target's syntax
// provider implements to print it. Nothing here reads the model: examples are
// built from an SdkDescription and the provider's declared runtime facts.

import type { DescArg, DescEntity, DescOp, DescOption, DescSymbols, Scalar, SdkDescription } from './sdkdesc'
import { createComment } from './runtimeprose'


// ---- the representation

type Ent = { name: string, Name: string, sym: DescSymbols }

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
  | { k: 'fields', of: Ref, fields: string[] } // chosen fields of that record, for display
  | { k: 'map', entries: Entry[] }

type Entry = { key: string, value: Expr }

type Stmt =
  | { k: 'client', options: Entry[] } // construct the client; [] for none
  // `wide`: the argument is laid out one member per line where the language
  // lays maps out that way (a write's data; a load match of several members).
  | { k: 'call', entity: Ent, op: string, arg: Entry[] | null, bind: Ref | null, wide: boolean }
  | { k: 'each', item: Ref, of: Ref, body: Stmt[] }
  | { k: 'print', what: Expr }
  | { k: 'attempt', what: string, body: Stmt[] } // report a failure of `what`
  | { k: 'comment', text: string }
  | { k: 'gap' }

// A null arg on a call: the call takes no match. A create always takes data.


// ---- runtime facts

// How a runtime hands back a result and reports a failure. Each value has its
// sentences written once, in the shared components.
type ResultStyle =
  | 'throw' // the value is returned; a failure throws
  | 'raise' // the value is returned; a failure raises
  | 'pair' // (value, error)
  | 'errslot' // the value is returned, or a null value with an error slot set
  | 'union' // a result union whose success arm holds the value

type OpName = 'list' | 'load' | 'create' | 'update' | 'patch' | 'remove'

// What a target's runtime is, independently of any model: declared by the
// provider, checked against the runtime templates (test/runtimefacts.test.ts).
type RuntimeFacts = {
  method: Record<OpName, string> // the method each operation is in the runtime: load -> Load
  named: 'call' | 'bare' // prose names an operation as `load()` or as `load`
  async: boolean // operations resolve (a promise) rather than return
  result: ResultStyle
  collection: string // what a list's value is: 'array', '`[]any`', 'slice' (markdown)
  record: string // the code that reads an entity's record: '.data()'
  recordType?: string // the type that record is, where the runtime names one: 'dict'
  errVar?: string // pair, errslot: the variable a caller checks: 'err'
  errSlot?: string // errslot: what is set on failure: '*err'
  nullValue?: string // errslot: what a failed call returns: 'NULL'
  ok?: string // union: the success arm: '.ok'
  err?: string // union: the failure arm: '.err'
  prints: 'record' | 'fields' // how an example shows an entity: its whole record, or chosen fields
}


// A fixed member of the client or of an entity, as the runtime declares it.
// `sig` is the signature as the language writes it; {sdk}, {client}, {ctor},
// {module}, {accessor}, {var}, {Class} and {Name} are filled from the
// description. Each kind has its sentence written once, in the shared page.
type MemberKind =
  | 'options' | 'utility' | 'direct' | 'prepare' | 'tester'
  | 'data' | 'match' | 'dataGet' | 'dataSet' | 'matchGet' | 'matchSet'
  | 'make' | 'name' | 'client' | 'entopts'
  | 'streamIterator' | 'streamGenerator' | 'streamChannel' | 'streamList'

type Member = { kind: MemberKind, sig: string }

// What the reference page states about a runtime, independently of any model.
type RefFacts = {
  classes: boolean // an entity is a class named by its className; false: by its Name
  noun: 'Methods' | 'Functions' // what the client's and an entity's members are called
  none: string // the literal for no value: 'undefined', 'nil', 'None', 'NULL'
  keys: 'member' | 'bare' // option tables name `options.x`, or bare map keys
  maps: string // the language's maps, plural: 'objects', 'maps', 'dicts'
  container: string // the type of the options and fetchargs containers: 'object', 'voxgig_value*'
  valueType: Record<'STRING' | 'OBJECT' | 'ANY', string> // option and fetcharg value types
  ctor: string[] // the constructor, as the page shows it
  test: { sig: string, call: string, args: boolean }[] // test constructors
  accessor: { sig: string, arg: 'data' | 'entopts' } // the client's entity accessor
  op: Record<OpName, string> // each operation's signature
  client: Member[] // the client's fixed members, in page order
  entity: Member[] // an entity's fixed members, in page order
  direct: { returns: string, signal?: string } // `signal`: the type of fetchargs ctrl.signal
  prepare: { returns: string, fails: 'style' | 'value' } // 'value': the error is returned, not thrown
  body: { values: string, once?: string, binary?: boolean } // what `$body` accepts
  cancel: boolean // operations take an abort signal in ctrl.signal
}


// ---- the builders

function entOf(desc: SdkDescription, name: string): Ent {
  const e = desc.entities.find((x) => x.name === name)
  return e ? { name, Name: e.Name, sym: e.sym } : { name, Name: name, sym: { accessor: name, var: name, vars: name + 's' } }
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

const WRITE_OPS = ['create', 'update', 'patch', 'remove']

function call(entity: Ent, op: string, arg: Entry[] | null, bind: Ref | null): Stmt {
  const wide = WRITE_OPS.includes(op) || ('load' === op && null != arg && 1 < arg.length)
  return { k: 'call', entity, op, arg, bind, wide }
}

// How an example shows an entity: the whole record, or the chosen fields where
// the runtime's examples print those.
function show(desc: SdkDescription, facts: RuntimeFacts, of: Ref): Expr {
  const fields = desc.quick ? desc.quick.show : []
  return 'fields' === facts.prints && 0 < fields.length ? { k: 'fields', of, fields } : { k: 'record', of }
}

function clientBlock(desc: SdkDescription): Stmt[] {
  return [{ k: 'client', options: optionEntries(desc.options) }]
}

function listBlock(desc: SdkDescription, facts: RuntimeFacts): Stmt[] | null {
  const q = desc.quick
  if (null == q || null == q.list) return null
  const entity = entOf(desc, q.entity)
  const many: Ref = { role: 'many', entity }
  const item: Ref = { role: 'item', entity }
  return [{
    k: 'attempt', what: 'list', body: [
      call(entity, 'list', 0 < q.list.length ? argEntries(q.list, null) : null, many),
      { k: 'each', item, of: many, body: [{ k: 'print', what: show(desc, facts, item) }] },
    ],
  }]
}

function loadBlock(desc: SdkDescription, facts: RuntimeFacts): Stmt[] | null {
  const q = desc.quick
  if (null == q || null == q.load) return null
  const entity = entOf(desc, q.load.entity)
  const one: Ref = { role: 'one', entity }
  return [{
    k: 'attempt', what: 'load', body: [
      call(entity, 'load', 0 < q.load.args.length ? argEntries(q.load.args, null) : null, one),
      { k: 'print', what: show(desc, facts, one) },
    ],
  }]
}

function writeOps(desc: SdkDescription): string[] {
  const q: any = desc.quick
  return null == q ? [] : WRITE_OPS.filter((o) => null != q[o])
}

// Write results are not shown, by every language alike; the created entity is
// bound only where a later call reads its id.
function writeBlock(desc: SdkDescription, facts: RuntimeFacts): Stmt[] | null {
  const q: any = desc.quick
  const ops = writeOps(desc)
  if (0 === ops.length) return null
  const entity = entOf(desc, q.entity)
  const created: Ref = { role: 'created', entity }
  const out: Stmt[] = []
  for (const op of ops) {
    if (0 < out.length) out.push({ k: 'gap' })
    const chained = (q[op] as DescArg[]).some((a: any) => null != a.fromCreated)
    out.push({ k: 'comment', text: 'create' === op ? createComment(facts) : WRITE_COMMENT[op](chained) })
    out.push(call(entity, op,
      'create' === op || 0 < q[op].length ? argEntries(q[op], created) : null,
      'create' === op && q.chainsId ? created : null))
  }
  return out
}

const WRITE_COMMENT: Record<string, (chained: boolean) => string> = {
  update: (chained) => 'Update' + (chained ? ' — the id comes off the created entity\'s record' : ''),
  patch: (chained) => 'Patch — sends only the fields given' +
    (chained ? '; the id comes off the created entity\'s record' : ''),
  remove: () => 'Remove',
}


// The reference's example for one operation: a list or load consumed as the
// tutorial consumes it, a write called alone. None for an operation reached
// only through `$action`.
function refOpBlock(desc: SdkDescription, facts: RuntimeFacts, ent: DescEntity, op: DescOp): Stmt[] | null {
  if (op.action) return null
  const entity = entOf(desc, ent.name)
  const arg = 0 < op.args.length ? argEntries(op.args, null) : null
  if ('list' === op.name) {
    const many: Ref = { role: 'many', entity }
    const item: Ref = { role: 'item', entity }
    return [{
      k: 'attempt', what: 'list', body: [
        call(entity, 'list', arg, many),
        { k: 'each', item, of: many, body: [{ k: 'print', what: { k: 'record', of: item } }] },
      ],
    }]
  }
  if ('load' === op.name) {
    const one: Ref = { role: 'one', entity }
    return [{
      k: 'attempt', what: 'load', body: [
        call(entity, 'load', arg, one),
        { k: 'print', what: { k: 'record', of: one } },
      ],
    }]
  }
  return [call(entity, op.name, 'remove' === op.name ? arg : (arg || []), null)]
}

// The client constructed with the named features switched on.
function featureBlock(names: string[]): Stmt[] {
  return [{
    k: 'client', options: [{
      key: 'feature', value: {
        k: 'map', entries: names.map((n) => ({
          key: n, value: { k: 'map', entries: [{ key: 'active', value: { k: 'lit', type: 'BOOLEAN', text: '' } }] } as Expr,
        })),
      },
    }],
  }]
}


// What a block uses, for a printer that declares imports.
type Uses = { env: boolean, field: boolean, print: boolean, entities: string[] }

function uses(stmts: Stmt[]): Uses {
  const found: Uses = { env: false, field: false, print: false, entities: [] }
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
    if ('print' === s.k) { found.print = true; expr(s.what) }
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

// Where a call stands: inside an attempt (whose handling covers it) or not,
// and whether it is the last statement of its block.
type CallContext = { inAttempt: boolean, last: boolean }

// One step of a section presented as one program: its title and its lines.
type ProgramStep = { title: string, lines: string[] }

type Syntax = {
  fence: string // the code fence language
  facts: RuntimeFacts
  // Each printer returns lines; `inner` prints nested statements at one more level.
  client: (s: Extract<Stmt, { k: 'client' }>, desc: SdkDescription, sc: Scope) => string[]
  call: (s: Extract<Stmt, { k: 'call' }>, desc: SdkDescription, sc: Scope, cx: CallContext) => string[]
  each: (s: Extract<Stmt, { k: 'each' }>, inner: (body: Stmt[]) => string[], sc: Scope) => string[]
  print: (s: Extract<Stmt, { k: 'print' }>, sc: Scope) => string[]
  attempt: (s: Extract<Stmt, { k: 'attempt' }>, inner: (body: Stmt[]) => string[], sc: Scope) => string[]
  comment: (text: string) => string
  expr: (e: Expr, sc: Scope) => string
  // Optional: lines a block needs ahead of its statements (a hoisted handle).
  before?: (stmts: Stmt[], desc: SdkDescription, sc: Scope) => string[]
  // Optional: the steps of a section assembled into one complete program, for
  // a language whose examples are whole programs that its README test runs.
  program?: (steps: ProgramStep[], desc: SdkDescription, sc: Scope) => string[]
  // Optional: what the reference page needs beyond statements.
  ref?: RefSyntax
}

type RefSyntax = {
  facts: RefFacts
  type: (t: any) => string // a field's type, from its canonical sentinel
  key: (container: 'options' | 'fetchargs', path: string[]) => string // how a table names an option
  instance: (ent: Ent, desc: SdkDescription) => string[] // obtaining one entity from the client
}


function printStmts(p: Syntax, stmts: Stmt[], desc: SdkDescription, sc: Scope, inAttempt = false): string[] {
  const out: string[] = []
  stmts.forEach((s, i) => {
    const inner = (body: Stmt[]) => printStmts(p, body, desc, sc, inAttempt || 'attempt' === s.k)
    switch (s.k) {
      case 'client': out.push(...p.client(s, desc, sc)); break
      case 'call': out.push(...p.call(s, desc, sc, { inAttempt, last: i === stmts.length - 1 })); break
      case 'each': out.push(...p.each(s, inner, sc)); break
      case 'print': out.push(...p.print(s, sc)); break
      case 'attempt': out.push(...p.attempt(s, inner, sc)); break
      case 'comment': out.push(p.comment(s.text)); break
      case 'gap': out.push(''); break
    }
  })
  // A printer may return a multi-line string as one line; indenting needs lines.
  return out.flatMap((l) => l.split('\n'))
}


// A whole code block: the fence, the provider's lines, the closing fence.
function printBlock(p: Syntax, stmts: Stmt[], desc: SdkDescription, sc: Scope): string {
  sc.local = new Set()
  sc.stmts = stmts
  const lines = [...(p.before ? p.before(stmts, desc, sc) : []), ...printStmts(p, stmts, desc, sc)]
  return fenced(p, lines)
}


// Steps printed under one local scope, each with what it hoists ahead of it.
function printSteps(p: Syntax, steps: { title: string, stmts: Stmt[] }[], desc: SdkDescription, sc: Scope): ProgramStep[] {
  sc.local = new Set()
  sc.stmts = steps.flatMap((s) => s.stmts)
  return steps.map((s) => {
    // A step's leading comment names it, so it stays ahead of what is hoisted.
    const lead = 'comment' === s.stmts[0]?.k ? 1 : 0
    return {
      title: s.title,
      lines: [
        ...printStmts(p, s.stmts.slice(0, lead), desc, sc),
        ...(p.before ? p.before(s.stmts, desc, sc) : []),
        ...printStmts(p, s.stmts.slice(lead), desc, sc),
      ],
    }
  })
}


// Steps printed into one program, by the provider's program printer.
function printProgram(p: Syntax, steps: { title: string, stmts: Stmt[] }[], desc: SdkDescription, sc: Scope): string {
  return fenced(p, (p.program as NonNullable<Syntax['program']>)(printSteps(p, steps, desc, sc), desc, sc))
}


// Steps printed into one block, a blank line between them.
function printJoined(p: Syntax, steps: { title: string, stmts: Stmt[] }[], desc: SdkDescription, sc: Scope): string {
  return fenced(p, printSteps(p, steps, desc, sc).flatMap((s, i) => 0 === i ? s.lines : ['', ...s.lines]))
}


function fenced(p: Syntax, lines: string[]): string {
  return '```' + p.fence + '\n' + lines.join('\n') + '\n```\n'
}


function newScope(): Scope {
  return { declared: new Set(), local: new Set(), stmts: [], section: [] }
}


function indent(lines: string[], by: string): string[] {
  return lines.map((l) => '' === l ? l : by + l)
}


export type {
  CallContext,
  Member,
  MemberKind,
  RefFacts,
  RefSyntax,
  Ent,
  Entry,
  Expr,
  OpName,
  ProgramStep,
  Ref,
  ResultStyle,
  RuntimeFacts,
  Scope,
  Stmt,
  Syntax,
  Uses,
}

export {
  clientBlock,
  entOf,
  featureBlock,
  refOpBlock,
  indent,
  listBlock,
  newScope,
  loadBlock,
  printBlock,
  printJoined,
  printProgram,
  printStmts,
  printSteps,
  uses,
  writeBlock,
  writeOps,
}
