// A language-neutral representation of an example program, the builders the
// shared documentation components call, and the interface a target's syntax
// provider implements to print it. Nothing here reads the model: examples are
// built from an SdkDescription and the provider's declared runtime facts.

import type { DescAction, DescArg, DescEntity, DescOp, DescOption, DescSymbols, Scalar, SdkDescription } from './sdkdesc'
import type { SYNTAX_INTERFACE } from './syntaxversion'
import { createComment } from './runtimeprose'


// ---- the representation

type Ent = { name: string, Name: string, sym: DescSymbols }

// A value an example names. `role` says what it holds; `name` is the
// variable the example binds it to, decided once here (NAMES) and adapted to
// the language's identifier rules by its naming hook. An item is read off
// the list named `list` where a language has no loop variable.
type Ref = { role: 'many' | 'item' | 'one' | 'created', entity: Ent, name: string, list?: string }

type Expr =
  | { k: 'lit', type: Scalar, text: string } // a typed literal; `text` when it is a string
  | { k: 'str', text: string } // a plain string
  | { k: 'env', name: string } // an environment variable, read
  | { k: 'record', of: Ref } // the record a returned entity holds
  | { k: 'field', of: Ref, field: string } // one field of that record
  | { k: 'fields', of: Ref, fields: string[] } // chosen fields of that record, for display
  | { k: 'map', entries: Entry[] }

// `type`: the canonical type of the member, for a language whose examples
// comment each member of a write's data with its type.
type Entry = { key: string, value: Expr, type?: Scalar }

type Stmt =
  | { k: 'client', options: Entry[] } // construct the client; [] for none
  // `wide`: the argument is laid out one member per line where the language
  // lays maps out that way (a write's data; a load match of several members).
  // `note`: a comment printed as the last member of a wide argument.
  | { k: 'call', entity: Ent, op: string, arg: Entry[] | null, bind: Ref | null, wide: boolean, note?: string }
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
  | 'die' // the value is returned; a failure dies
  | 'pair' // (value, error)
  | 'errslot' // the value is returned, or a null value with an error slot set
  | 'union' // a result union whose success arm holds the value
  | 'wrapped' // the value is returned inside a dynamic value; a failure throws

type OpName = 'list' | 'load' | 'create' | 'update' | 'patch' | 'remove'

// What a target's runtime is, independently of any model: declared by the
// provider, checked against the runtime templates (test/runtimefacts.test.ts).
type RuntimeFacts = {
  method: Record<OpName, string> // the method each operation is in the runtime: load -> Load
  named: 'call' | 'bare' // prose names an operation as `load()` or as `load`
  async: boolean // operations resolve (a promise) rather than return
  result: ResultStyle
  collection: string // what a list's value is: 'array', '`[]any`', 'slice' (markdown)
  record: string // the code that reads an entity's record: '.data()'; {var} is the variable the example binds
  recordType?: string // the type that record is, where the runtime names one: 'dict'
  errVar?: string // pair, errslot: the variable a caller checks: 'err'
  errSlot?: string // errslot: what is set on failure: '*err'
  nullValue?: string // errslot: what a failed call returns: 'NULL'
  ok?: string // union: the success arm: '.ok'
  err?: string // union: the failure arm: '.err'
  pairForm?: string // pair, required there: how the pair is written: '(value, error)'
  noError?: string // pair, required there: what errVar holds when nothing failed: 'nil'
  unwrap?: string // wrapped: the code that takes the entity out of the value
  unusedError?: boolean // a bound value no statement reads fails the build (go, zig)
  listOf?: string // the type a list resolves to, where the language names one: '{Class}[]'
  // The arguments an operation call must pass, each the none value where it
  // is left out: 0 where every argument may be omitted (`list()`), 2 where the
  // language has no default arguments (`list(nil, nil)`). A sentence then
  // names an operation by a call that compiles.
  arity?: number
  prints: Prints
}

// How an example shows an entity: 'record', its whole record, everywhere;
// 'listFields', chosen fields of each item the tutorial lists, and the whole
// record everywhere else (rb, php); 'fields', chosen fields everywhere
// (perl). Where each applies is decided once, in `show`.
type Prints = 'record' | 'listFields' | 'fields'

// Where an example stands, for `show`.
type ShowPlace = 'tutorial' | 'top' | 'reference'


// A fixed member of the client or of an entity, as the runtime declares it.
// `sig` is the signature as the language writes it; {sdk}, {client}, {ctor},
// {module}, {accessor}, {var}, {Class} and {Name} are filled from the
// description. Each kind has its sentence written once, in the shared page.
// A shape that two or more of the twenty runtimes share is a kind; a shape one
// runtime alone has is the base kind ('utilityBase', 'stream') plus that
// runtime's note on the member's slot (Syntax.notes).
type MemberKind =
  | 'options' | 'utility' | 'utilityBase' | 'direct' | 'prepare' | 'tester'
  | 'data' | 'match' | 'dataGet' | 'dataSet' | 'matchGet' | 'matchSet'
  | 'dataArg' | 'matchArg' // the argument is always passed: a map sets, a null value gets
  | 'make' | 'name' | 'client' | 'entopts'
  | 'stream' | 'streamIterator' | 'streamGenerator' | 'streamList' | 'streamLazy'
  | 'streamSync' // a synchronous iterator over the items (rb Enumerator, scala Iterator)
  | 'streamFunction' // a function returning the next item per call, `none` at the end (lua, perl)

// When a stream's operation runs, read from the runtime's code, never from
// its type: 'iterate', when the caller starts iterating; 'call', before the
// call returns, every item read; 'background', from the call on, beside the
// caller, each item handed over as the caller takes it.
type StreamRuns = 'iterate' | 'call' | 'background'

// `returns`: the type it returns, where the signature does not say.
// `copy`: a getter (data, match, options, entopts) returns a copy of the
// value it holds, not the value itself; without it the page says no copy.
// `runs`: a stream kind's StreamRuns, required for every stream kind.
// `field`: the member is a field, read without a call (ocaml's `e_name`).
type Member = { kind: MemberKind, sig: string, returns?: string, copy?: boolean, runs?: StreamRuns, field?: boolean }

// What the reference page states about a runtime, independently of any model.
type RefFacts = {
  // What the page names an entity by: its class (className), its Name, or the
  // module its operations live in (DescSymbols.module).
  entityBy: 'class' | 'Name' | 'module'
  noun: string // what the client's and an entity's members are called: 'Methods', 'Functions'
  entityNoun?: string // where an entity's members are called otherwise: 'Fields', 'Members'
  heading?: string // the client's heading, where the client has no type: '{module}'
  none: string // the literal for no value: 'undefined', 'nil', 'None', 'NULL'
  setArg?: string // dataArg, matchArg, required there: how a map is passed to set: 'a map'
  keys: 'member' | 'bare' // option tables name `options.x`, or bare map keys
  maps: string // the language's maps, plural: 'objects', 'maps', 'dicts'
  container: string // the type of the options and fetchargs containers: 'object', 'voxgig_value*'
  valueType: Record<'STRING' | 'OBJECT' | 'ANY', string> // option and fetcharg value types
  ctor: string[] // the constructor, as the page shows it
  ctorAlts?: { call: string, kind: CtorKind }[] // other ways to construct one, each with its sentence
  test: { sig: string, call: string, args: boolean, alts?: { call: string, kind: CtorKind }[] }[] // test constructors
  // Where the test constructor's mock comes from: 'generated', only from an
  // SDK generated with the test feature (without it the base feature stands
  // in, and the client refuses every request); 'always', the runtime ships
  // the test feature whatever the model says.
  testMock: 'generated' | 'always'
  // The client's entity accessor. `param`: the name its signature gives the
  // argument, which the page names where it is not the options' name.
  // `cached`: called with the none value, it returns one instance the client
  // keeps (made by the first such call), not a new one.
  accessor: { sig: string, arg: 'data' | 'entopts', param: string, cached?: boolean }
  op: Record<OpName, string> // each operation's signature
  opMatched?: Partial<Record<OpName, string>> // the signature where the match is required (a nested list)
  client: Member[] // the client's fixed members, in page order
  entity: Member[] // an entity's fixed members, in page order
  // `signal`: the type of fetchargs ctrl.signal, and `abortCode`, required
  // with it, the `code` of the error an abort leaves. `okFalse`: the value the
  // result's `ok` holds on a failure, as the runtime writes it: 'false', 'False', '0'.
  direct: { returns: string, signal?: string, abortCode?: string, okFalse: string }
  // 'style': as the result style says; 'value': the error is returned in place
  // of the definition; 'note': the runtime's note on member:prepare says how
  prepare: { returns: string, fails: 'style' | 'value' | 'note' }
  body: { values: string, once?: string, binary?: boolean } // what `$body` accepts
  cancel: boolean // operations take an abort signal in ctrl.signal
  // The stream reads `callopts.signal` and ends early once it reports an
  // abort, whether or not the operations can be cancelled.
  streamSignal?: boolean
  // How prose names a member: 'call', `direct()` (the default), or 'bare',
  // `direct`, where a call is not written with parentheses.
  memberNamed?: 'call' | 'bare'
  // How a removed entity's mark is read, {var} the entity: '{var}.deleted()'.
  deleted?: string
}


// An alternate constructor: 'defaults' takes no options; 'explicit' takes
// them spelled out.
type CtorKind = 'defaults' | 'explicit'


// ---- the builders

function entOf(desc: SdkDescription, name: string): Ent {
  const e = desc.entities.find((x) => x.name === name)
  if (null == e) throw new Error(`example: no entity ${name} in the description of ${desc.target}`)
  return { name, Name: e.Name, sym: e.sym }
}


// Whether a failure stops the program where it happens: it throws, raises
// or dies. Otherwise the failure comes back to the caller, and an example
// may not use a result, or make its next call, past one it has not checked.
function interrupts(style: ResultStyle): boolean {
  return 'throw' === style || 'raise' === style || 'die' === style || 'wrapped' === style
}

// Whether a call can be printed with no check of its own. In 'pair' and
// 'union' the error comes back with the value, so binding the value takes the
// result apart (a checked `err`, an unwrap, a switch); in 'errslot' the value
// is bound whether or not the slot was set, so the example has to check it.
function checksItself(style: ResultStyle): boolean {
  return 'errslot' !== style
}

// What an example calls each value. The tutorial and the root quick start name
// them after the entity, as the old pages did; the reference uses the same
// names for every entity, as the old pages did. No language decides it: the
// naming hook only adapts a name to the language's identifier rules
// (DescLayout.vars, DescSymbols.plural).
type VarNaming = 'entity' | 'generic'

const GENERIC: Record<Ref['role'], string> = { many: 'results', item: 'item', one: 'result', created: 'result' }

function refOf(desc: SdkDescription, role: Ref['role'], entity: Ent, naming: VarNaming): Ref {
  const vars = desc.layout.vars || {}
  const pick = (r: Ref['role']): string => 'generic' === naming
    ? (vars[GENERIC[r]] ?? GENERIC[r])
    : ('many' === r ? entity.sym.plural : ('created' === r ? (vars.created ?? 'created') : entity.sym.var))
  const ref: Ref = { role, entity, name: pick(role) }
  if ('item' === role) ref.list = pick('many')
  return ref
}


function argEntries(args: DescArg[], of: Ref | null, typed = false): Entry[] {
  return args.map((a: any) => {
    const en: Entry = {
      key: a.name,
      value: null != a.fromCreated && null != of
        ? { k: 'field', of, field: a.fromCreated }
        : { k: 'lit', type: a.type, text: a.placeholder },
    }
    if (typed && null != a.type) en.type = a.type
    return en
  })
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

// How an example shows an entity: the whole record, or the chosen fields of
// the entity shown, where and as the runtime's examples print those.
function show(desc: SdkDescription, facts: RuntimeFacts, of: Ref, where: ShowPlace): Expr {
  const e = desc.entities.find((x) => x.name === of.entity.name)
  const fields = e ? e.show : []
  const chosen = 'fields' === facts.prints ||
    ('listFields' === facts.prints && 'tutorial' === where && 'item' === of.role)
  return chosen && 0 < fields.length ? { k: 'fields', of, fields } : { k: 'record', of }
}

function clientBlock(desc: SdkDescription): Stmt[] {
  return [{ k: 'client', options: optionEntries(desc.options) }]
}

function listBlock(desc: SdkDescription, facts: RuntimeFacts, where: ShowPlace = 'tutorial'): Stmt[] | null {
  const q = desc.quick
  if (null == q || null == q.list) return null
  const entity = entOf(desc, q.entity)
  const many = refOf(desc, 'many', entity, 'entity')
  const item = refOf(desc, 'item', entity, 'entity')
  return [{
    k: 'attempt', what: 'list', body: [
      call(entity, 'list', 0 < q.list.length ? argEntries(q.list, null) : null, many),
      { k: 'each', item, of: many, body: [{ k: 'print', what: show(desc, facts, item, where) }] },
    ],
  }]
}

function loadBlock(desc: SdkDescription, facts: RuntimeFacts, where: ShowPlace = 'tutorial'): Stmt[] | null {
  const q = desc.quick
  if (null == q || null == q.load) return null
  const entity = entOf(desc, q.load.entity)
  const one = refOf(desc, 'one', entity, 'entity')
  return [{
    k: 'attempt', what: 'load', body: [
      call(entity, 'load', 0 < q.load.args.length ? argEntries(q.load.args, null) : null, one),
      { k: 'print', what: show(desc, facts, one, where) },
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
  const created = refOf(desc, 'created', entity, 'entity')
  const out: Stmt[] = []
  for (const op of ops) {
    if (0 < out.length) out.push({ k: 'gap' })
    const chained = (q[op] as DescArg[]).some((a: any) => null != a.fromCreated)
    out.push({ k: 'comment', text: 'create' === op ? createComment(facts, created.name) : WRITE_COMMENT[op](chained) })
    const stmt = call(entity, op,
      'create' === op || 0 < q[op].length ? argEntries(q[op], created) : null,
      'create' === op && q.chainsId ? created : null)
    // Each write is followed by another, or by the end of the step: where the
    // call does not check itself, its check is printed after it.
    out.push(checksItself(facts.result) ? stmt : { k: 'attempt', what: op, body: [stmt] })
  }
  return out
}

const WRITE_COMMENT: Record<string, (chained: boolean) => string> = {
  update: (chained) => 'Update' + (chained ? ' — the id comes off the created entity\'s record' : ''),
  patch: (chained) => 'Patch — sends only the fields given' +
    (chained ? '; the id comes off the created entity\'s record' : ''),
  remove: () => 'Remove',
}


// The reference's example for one operation, in the shape most of the
// twenty old pages had: the call bound to `result` (`results` for a list),
// outside error handling, which the language writes its own way; a list's
// items printed; a write's data members commented with their types, and an
// update's or patch's data closed by a comment on what else to send. A bound
// value is printed where an unused binding fails the build. None for an
// operation reached only through `$action`.
function refOpBlock(desc: SdkDescription, facts: RuntimeFacts, ent: DescEntity, op: DescOp): Stmt[] | null {
  if (op.action) return null
  const entity = entOf(desc, ent.name)
  const write = WRITE_OPS.includes(op.name) && 'remove' !== op.name
  const arg = 0 < op.args.length ? argEntries(op.args, null, 'create' === op.name) : null
  if ('list' === op.name) {
    const many = refOf(desc, 'many', entity, 'generic')
    const item = refOf(desc, 'item', entity, 'generic')
    return [
      call(entity, 'list', arg, many),
      { k: 'each', item, of: many, body: [{ k: 'print', what: show(desc, facts, item, 'reference') }] },
    ]
  }
  const one = refOf(desc, 'load' === op.name ? 'one' : 'created', entity, 'generic')
  const stmt = call(entity, op.name, write ? (arg || []) : arg, one)
  // A reference example's match stays on one line, as the old pages had it.
  if ('call' === stmt.k && ('remove' === op.name || 'load' === op.name)) stmt.wide = false
  if ('call' === stmt.k && ('update' === op.name || 'patch' === op.name)) {
    stmt.note = 'update' === op.name ? 'Fields to update' : 'Only the fields to change'
  }
  // The record is read back where an unused binding fails the build, and,
  // for a single entity, where a failure does not interrupt: the provider's
  // printer then prints the read past the check it needs.
  const read = facts.unusedError || (!interrupts(facts.result) && ('load' === op.name || 'remove' === op.name))
  return [stmt, ...(read ? [{ k: 'print', what: show(desc, facts, one, 'reference') } as Stmt] : [])]
}


// A custom action called: the operation it is routed through, with `$action`
// and the route's path parameters in its argument. Its response is the
// action's own, so it is not bound.
function actionBlock(desc: SdkDescription, ent: DescEntity, action: DescAction): Stmt[] {
  const stmt = call(entOf(desc, ent.name), action.op,
    [{ key: '$action', value: { k: 'str', text: action.action } }, ...argEntries(action.params, null)], null)
  if ('call' === stmt.k) {
    stmt.wide = true
    stmt.note = '...the action\'s own arguments'
  }
  return [stmt]
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
// `standalone`: the block stands alone (a reference example), rather than
// following the section's client block and the page's imports.
// `place`: the section the block is printed for, which the imports printer
// is told (a library path depends on where the reader runs).
type Scope = { declared: Set<string>, local: Set<string>, stmts: Stmt[], section: Stmt[], standalone: boolean, place?: ShowPlace }

// Where a call stands: inside an attempt (whose handling covers it) or not,
// and whether it is the last statement of its block.
type CallContext = { inAttempt: boolean, last: boolean }

// One step of a section presented as one program: its title and its lines.
type ProgramStep = { title: string, lines: string[] }

type Syntax = {
  // The interface version this provider is written for: SYNTAX_INTERFACE.
  interface: typeof SYNTAX_INTERFACE
  fence: string // the code fence language
  facts: RuntimeFacts
  // Each printer returns lines; `inner` prints nested statements at one more level.
  client: (s: Extract<Stmt, { k: 'client' }>, desc: SdkDescription, sc: Scope) => string[]
  call: (s: Extract<Stmt, { k: 'call' }>, desc: SdkDescription, sc: Scope, cx: CallContext) => string[]
  each: (s: Extract<Stmt, { k: 'each' }>, inner: (body: Stmt[]) => string[], sc: Scope, desc: SdkDescription, cx: CallContext) => string[]
  print: (s: Extract<Stmt, { k: 'print' }>, sc: Scope, desc: SdkDescription) => string[]
  attempt: (s: Extract<Stmt, { k: 'attempt' }>, inner: (body: Stmt[]) => string[], sc: Scope, desc: SdkDescription) => string[]
  comment: (text: string) => string
  expr: (e: Expr, sc: Scope, desc: SdkDescription) => string
  // Optional: the page's import lines. A block never decides its own: the
  // shared page prints these ahead of the client block of the tutorial and
  // of the root quick start, and nowhere else. `used` is what the whole
  // section uses, for an import that only an option needs (an env reader).
  // `place`: where the block is read from (the tutorial from the SDK's own
  // directory, the root quick start from the repository root).
  imports?: (desc: SdkDescription, used: Uses, place?: ShowPlace) => string[]
  // Optional: runtime notes, static prose true of this runtime alone, each
  // printed exactly where the shared page prints its slot (NoteSlot).
  notes?: Partial<Record<NoteSlot, string>>
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
  // How a table names an option; [] is the container itself.
  key: (container: 'options' | 'fetchargs', path: string[]) => string
  instance: (ent: Ent, desc: SdkDescription) => string[] // obtaining one entity from the client
  // Reading one key of a result map: result["ok"]. `truth`: the read is the
  // condition of a branch, written as the language tests that key.
  read: (value: string, key: string, truth?: boolean) => string
}

// The places of the shared page a runtime note can attach to. A note is
// printed after the slot's shared text, exactly when the page prints it.
type NoteSlot =
  | `member:${MemberKind}` // a fixed member of the client or an entity
  | 'ctor' | 'test' | 'instance' | 'entity' | 'operations' | 'members' | 'features'
  | 'tutorial' | 'tutorial:list' | 'tutorial:load' | 'tutorial:write' | 'top'


function printStmts(p: Syntax, stmts: Stmt[], desc: SdkDescription, sc: Scope, inAttempt = false): string[] {
  const out: string[] = []
  stmts.forEach((s, i) => {
    const inner = (body: Stmt[]) => printStmts(p, body, desc, sc, inAttempt || 'attempt' === s.k)
    switch (s.k) {
      case 'client':
        if (p.imports && !sc.standalone && !sc.declared.has(IMPORTED)) {
          sc.declared.add(IMPORTED)
          const lines = p.imports(desc, uses(sc.section.length ? sc.section : stmts), sc.place)
          if (0 < lines.length) out.push(...lines, '')
        }
        out.push(...p.client(s, desc, sc)); break
      case 'call': out.push(...p.call(s, desc, sc, { inAttempt, last: i === stmts.length - 1 })); break
      case 'each': out.push(...p.each(s, inner, sc, desc, { inAttempt, last: i === stmts.length - 1 })); break
      case 'print': out.push(...p.print(s, sc, desc)); break
      case 'attempt': out.push(...p.attempt(s, inner, sc, desc)); break
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


// Recorded in Scope.declared once the page's imports are printed.
const IMPORTED = '\u0000imports'

function newScope(standalone = false, place?: ShowPlace): Scope {
  return { declared: new Set(), local: new Set(), stmts: [], section: [], standalone, place }
}

// A runtime note for a slot, as a paragraph, or nothing. A note names the
// SDK's own modules as the signatures do: {module}, {client}, {ctor} and
// {names.<role>} are filled from the description's layout, which the naming
// hook decided; the note itself stays static text.
function note(p: Syntax, slot: NoteSlot, desc?: SdkDescription): string {
  const text = p.notes && Object.prototype.hasOwnProperty.call(p.notes, slot) ? p.notes[slot] : undefined
  if (null == text || '' === text) return ''
  const layout: any = desc ? desc.layout : {}
  const filled = text.replace(/\{(module|client|ctor|names\.\w+)\}/g, (m, k: string) => {
    const v = k.startsWith('names.') ? (layout.names || {})[k.slice(6)] : layout[k]
    return 'string' === typeof v ? v : m
  })
  return filled + '\n\n'
}


function indent(lines: string[], by: string): string[] {
  return lines.map((l) => '' === l ? l : by + l)
}


export type {
  CallContext,
  CtorKind,
  NoteSlot,
  Member,
  MemberKind,
  RefFacts,
  RefSyntax,
  Ent,
  Entry,
  Expr,
  OpName,
  Prints,
  ProgramStep,
  ShowPlace,
  StreamRuns,
  Ref,
  ResultStyle,
  RuntimeFacts,
  Scope,
  Stmt,
  Syntax,
  Uses,
}

export {
  actionBlock,
  checksItself,
  interrupts,
  clientBlock,
  entOf,
  featureBlock,
  refOpBlock,
  indent,
  listBlock,
  newScope,
  note,
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
