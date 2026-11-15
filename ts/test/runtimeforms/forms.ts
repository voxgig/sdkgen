// How a runtime writes things, declared once per language in
// test/runtimeforms/<lang>.ts and read by runtimefacts.test.ts and
// runtimereader.test.ts. Adding a language adds one file here.

import * as Fs from 'node:fs'
import * as Path from 'node:path'

import type { CallNotation } from './calls'


type Decl = {
  name: string
  params: string[] // as written, the receiver dropped
  returns: string // '' when the declaration states none
  head: string
  before: string
  rest: string
  file: string
  bare?: boolean // declared with no parameter list: a property or field
  on: On
  field: boolean
  fails: string
  from: 'code' | 'comment'
}

type On = 'instance' | 'type' | 'module'

type Src = { file: string, text: string }

type Style = 'throw' | 'raise' | 'die' | 'pair' | 'errslot' | 'union' | 'wrapped'

type OpName = 'list' | 'load' | 'create' | 'update' | 'patch' | 'remove'

type Family =
  | 'options' | 'utility' | 'direct' | 'prepare' | 'tester'
  | 'data' | 'match' | 'make' | 'name' | 'client' | 'entopts' | 'stream'

// `unquoted`: a token no quote holds, and why; `value`: what was audited where
// no quote can hold it; `absent`: a search over the language's whole runtime
// that must not match outside the regions `except` quotes, each with its
// reason (`fact`: the cited fact a region shows instead, such as a stream's
// signal beside an operation's cancel).
type Exclusion = { file: string, quote: string | string[], why: string, fact?: string }

type Citation = {
  file: string, quote: string | string[], value?: any
  also?: { file: string, quote: string | string[] }[]
  unquoted?: Record<string, string>
} | {
  absent: { pattern: RegExp, except?: Exclusion[] }, value: any
}

// A stream read by position: a `run` or `draw` quote ahead of `construct`
// (what the caller iterates) happens before the stream returns.
type StreamItems = {
  file: string
  construct: string
  starts: 'at call' | 'on iteration'
  run: string
  draw: string
  runs: string // as the positions give
  items: string
}

type Forms = {
  files: { client: string[], entity: string[], ops: string[] }

  decl: (name: string) => RegExp
  open?: '(' | '['
  bare?: boolean
  split?: 'comma' | 'space'
  receiver?: RegExp
  // Parameters not in a bracketed list after the name (perl's `my (...) = @_`,
  // ocaml's arrows), read from the source after the match.
  declReader?: (after: string) => { params: string[], returns?: string, field?: boolean } | null
  optional: (param: string) => boolean
  // `rest`: the source after the parameter list, for a return on a later line.
  returns: (after: string, before: string, head: string, rest: string) => string
  param?: (param: string) => { name: string, type: string }

  // The source defining an operation, and its method there. Default: the ops
  // file named Entity<Op>Op, and the one public entity member it declares.
  opSource?: (op: OpName) => string[]
  // An operation the runtime does not have, with the reason.
  absentOps?: Partial<Record<OpName, string>>
  opName?: RegExp
  opMethod?: (op: OpName, src: Src[], all: (files: string[]) => Src[]) => string | null

  public: { client: RegExp, entity: RegExp }
  undocumented?: Record<string, string>

  members: Partial<Record<Family | 'dataGet' | 'dataSet' | 'matchGet' | 'matchSet', string>>
  streamKind?: (d: Decl) => string
  // The declaration an entity accessor's argument is passed on to.
  entityCtor?: string
  // The client constructor's declaration, where it is not spelled as {ctor}.
  ctorDecl?: string
  testDecl?: string // default: members.tester

  on?: (d: Decl) => On // default: a constructor's name or a `static` head is on the type
  field?: (d: Decl) => boolean // default: bare
  fails?: (d: Decl) => string // how a failure shows in a declaration
  failure?: { shows: string, call: string } // what each operation shows; what a call needs
  parenless?: boolean // a call may be written without a parameter list (rb)
  // How a printed call is written: separators by what a member is declared
  // on, how arguments follow the name, a printed constructor's declaration.
  calls?: CallNotation
  // Whether a declared signature writes its member as called, in the
  // runtime's own notation (ocaml's arrows); default: a parameter list after
  // the name. Given, it keeps the field-or-call check on for a parenless form.
  called?: (sig: string, name: string) => boolean
  returnsFrom?: (d: Decl) => 'code' | 'comment'
  stream?: StreamItems
  expect?: Record<string, Partial<{ on: On, field: boolean, fails: string }>>
  shows?: Record<string, Citation> // facts no declaration shows

  style: {
    exception: 'throw' | 'raise' | 'die'
    raises: RegExp
  } & Partial<Record<'pair' | 'errslot' | 'union' | 'wrapped', (d: Decl) => boolean>>

  async?: (d: Decl) => boolean

  record: (record: string) => { name: string, arity?: number }
  // A member or type facts.record names that no declaration the guard reads
  // shows, cited instead.
  recordParts?: Record<string, Citation>

  // The porter's: how the provider spells its signatures.
  sigName?: (sig: string) => string
  sigParams?: (sig: string) => string[]
  sigReturns?: (sig: string) => string

  tokens: Record<string, string>
  // How the page names a runtime parameter or type that it names otherwise.
  renames?: Record<string, string | string[]>
  typeNames?: Record<string, string>
  namesWhy?: string

  // `column`: the code generator's own type map, which must be the one its
  // EntityTypes component passes canonToType; null with the reason when it has
  // none, and then `words`: each canonical type's word as the page prints it,
  // pinned for the reviewer, who audits it.
  types: { column: string | null, reason?: string, any?: string[], words?: Record<string, string> }

  // A comparison these forms cannot make, by check, with the reason.
  uncompared?: Partial<Record<'returns' | 'paramTypes' | 'paramNames', string>>

  // The porter's: a declared fact shown in a runtime file.
  cite?: Record<string, Citation>
  // The porter's: a check or fact not compared, with its reason; a reason
  // beginning `WRONG:` records a declared fact the runtime contradicts.
  exceptions?: Record<string, string>
}


const SCAFFOLD = Path.resolve(__dirname, '..', '..', 'project', '.sdk')

// The canonToType column a language's EntityTypes component uses, read from
// its source and the helpers file it calls (elixir's elixirType); null where
// it has none, and every column named when it names more than one.
function generatorColumn(lang: string): { column: string | null, file: string } {
  const file = `src/cmp/${lang}/EntityTypes_${lang}.ts`
  const p = Path.join(SCAFFOLD, file)
  if (!Fs.existsSync(p)) return { column: null, file }
  const found = new Set<string>()
  for (const f of [p, Path.join(SCAFFOLD, `src/cmp/${lang}/utility_${lang}.ts`)]) {
    if (!Fs.existsSync(f)) continue
    const src = Fs.readFileSync(f, 'utf8')
    const lang0 = (/^const LANG = '(\w+)'/m.exec(src) || [])[1]
    for (const m of src.matchAll(/canonToType\([^)]*,\s*(?:'(\w+)'|(LANG))\s*\)/g)) {
      const col = m[1] || lang0
      if (null != col) found.add(col)
    }
  }
  return { column: 1 === found.size ? [...found][0] : (0 === found.size ? null : [...found].sort().join('|')), file }
}
const OPS: OpName[] = ['list', 'load', 'create', 'update', 'patch', 'remove']
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

// `path#from#to` reads the part of a file from `from` to the next `to`.
function read(files: string[]): Src[] {
  return files.flatMap((f) => {
    const [file, from, to] = f.split('#')
    const p = Path.join(SCAFFOLD, file)
    if (!Fs.existsSync(p)) throw new Error('runtime file named by the forms is missing: ' + file)
    let text = Fs.readFileSync(p, 'utf8')
    if (null != from) {
      const at = text.indexOf(from)
      const end = text.indexOf(to, at + from.length)
      if (at < 0 || end < 0) throw new Error('runtime file part named by the forms is missing: ' + f)
      text = text.slice(at, end + to.length)
    }
    return [{ file: f, text }]
  })
}


function bracketed(src: string, at: number, open: string): { inner: string, end: number } | null {
  const close = '(' === open ? ')' : ']'
  if (src[at] !== open) return null
  let depth = 0
  for (let i = at; i < src.length; i++) {
    const c = src[i]
    if (c === '(' || c === '[' || c === '{' || c === '<' && '(' === open && /\w/.test(src[i - 1] || '')) depth++
    else if (c === ')' || c === ']' || c === '}' || c === '>' && 0 < depth && '(' === open && src[i - 1] !== '-' && src[i - 1] !== '=') depth--
    if (0 === depth) {
      if (c !== close) return null
      return { inner: src.slice(at + 1, i), end: i + 1 }
    }
  }
  return null
}


function splitParams(inner: string, how: 'comma' | 'space' = 'comma'): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
    if ('([{<'.includes(c) && !(c === '<' && inner[i - 1] === ' ')) depth++
    else if (')]}>'.includes(c) && !(c === '>' && (inner[i - 1] === '-' || inner[i - 1] === '='))) depth--
    const sep = 'comma' === how ? c === ',' : /\s/.test(c)
    if (0 === depth && sep) {
      out.push(cur)
      cur = ''
    }
    else cur += c
  }
  out.push(cur)
  return out.map((p) => p.trim()).filter((p) => '' !== p)
}


const CTOR_NAMES = /^(constructor|__init__|__construct|initialize|init|new|EntyClass|ProjectNameSDK)$/

function dims(forms: Forms, d: Omit<Decl, 'on' | 'field' | 'fails' | 'from'> & Partial<Decl>): Decl {
  const x = d as Decl
  x.field = null != forms.field ? forms.field(x) : !!x.bare
  x.on = null != forms.on ? forms.on(x) : (CTOR_NAMES.test(x.name) || /\bstatic\b/.test(x.head) ? 'type' : 'instance')
  x.fails = null != forms.fails ? forms.fails(x) : ''
  x.from = null != forms.returnsFrom ? forms.returnsFrom(x) : 'code'
  return x
}

function findDecls(forms: Forms, files: Src[], name: string): Decl[] {
  const out: Decl[] = []
  const re = new RegExp(forms.decl(name).source, 'gm')
  for (const { file, text } of files) {
    for (const m of text.matchAll(re)) {
      const at = (m.index as number) + m[0].length
      const before = text.slice(Math.max(0, (m.index as number) - 400), m.index as number)
      const rest = text.slice(at, at + 3000)
      if (forms.declReader) {
        const r = forms.declReader(rest)
        if (null == r) continue
        out.push(dims(forms, { name, params: r.params, returns: (r.returns || '').trim(), head: m[0], before, rest, file, bare: r.field }))
        continue
      }
      const b = bracketed(text, at, forms.open || '(')
      if (null == b && !(forms.bare && text[at] !== (forms.open || '('))) continue
      const end = null == b ? at : b.end
      let params = null == b ? [] : splitParams(b.inner, forms.split)
      if (forms.receiver && 0 < params.length && forms.receiver.test(params[0])) params = params.slice(1)
      const after = text.slice(end, end + 200).split('\n')[0]
      out.push(dims(forms, {
        name, params, returns: forms.returns(after, before, m[0], text.slice(end, end + 400)).trim(), head: m[0], before, rest, file,
        bare: null == b,
      }))
    }
  }
  return out
}


function publicNames(re: RegExp, files: Src[]): string[] {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  const found = new Set<string>()
  for (const { text } of files) for (const m of text.matchAll(g)) found.add(m.slice(1).find((x) => null != x) as string)
  return [...found].sort()
}


const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function namePattern(name: string): string {
  return esc(name).replace(/(?<!\\\$)\\\{\w+\\\}/g, '\\w+')
}


const defaultSigName = (sig: string): string => {
  const m = /([\w{}$-]+)\s*\(/.exec(sig.replace(/^[^(]*?(->|\.)(?=[\w{}]+\s*\()/, ''))
  return null == m ? '' : m[1]
}

const defaultSigParams = (sig: string): string[] => {
  const at = sig.indexOf('(', sig.indexOf(defaultSigName(sig)))
  const b = bracketed(sig, at, '(')
  return null == b ? [] : splitParams(b.inner)
}

const defaultSigReturns = (sig: string): string => {
  const at = sig.indexOf('(', sig.indexOf(defaultSigName(sig)))
  const b = bracketed(sig, at, '(')
  return null == b ? '' : sig.slice(b.end).replace(/^\s*(->|::|:)?\s*/, '').trim()
}


function opSource(forms: Forms, op: OpName): string[] {
  if (forms.opSource) return forms.opSource(op)
  const re = new RegExp('(^|/)Entity' + cap(op) + 'Op\\.')
  return forms.files.ops.filter((f) => re.test(f))
}

function opMethod(forms: Forms, op: OpName): { method: string | null, why: string } {
  const files = opSource(forms, op)
  if (0 === files.length) return { method: null, why: 'the forms name no source for ' + op }
  const src = read(files)
  if (forms.opMethod) {
    const m = forms.opMethod(op, src, read)
    return { method: m, why: null == m ? 'the forms\' opMethod finds none in ' + files.join(' ') : '' }
  }
  const names = publicNames(forms.opName || forms.public.entity, src)
  if (1 !== names.length) return { method: null, why: `${files.join(' ')} declares ${names.length} public members (${names.join(' ')})` }
  return { method: names[0], why: '' }
}


type Shape = { member: string, shape: string }
type View = {
  methods: Record<OpName, { method: string | null, why: string, decl: Decl | null }>
  load: Decl | null
  style: Style | 'none'
  async: boolean
  record: { name: string, params: number } | null
  client: string[]
  entity: string[]
  shapes: Shape[]
}

function view(forms: Forms): View {
  const client = read(forms.files.client)
  const entity = read(forms.files.entity)
  const all = [...client, ...entity, ...read(forms.files.ops)]
  const methods = {} as View['methods']
  for (const op of OPS) {
    const m = opMethod(forms, op)
    const decl = null == m.method ? null
      : findDecls(forms, read(opSource(forms, op)), esc(m.method))[0] || findDecls(forms, read(forms.files.ops), esc(m.method))[0] || null
    methods[op] = { ...m, decl }
  }
  const load = methods.load.decl
  const style: Style | 'none' = null == load ? 'none'
    : ((['pair', 'errslot', 'union', 'wrapped'] as const).find((s) => forms.style[s] && (forms.style[s] as any)(load)) ||
      (forms.style.raises.test(all.map((x) => x.text).join('\n')) ? forms.style.exception : 'none'))
  const recName = forms.members.dataGet || forms.members.data
  const recDecl = null == recName ? null : findDecls(forms, entity, esc(recName))[0] || null
  const shapes: Shape[] = []
  for (const fam of ['data', 'match'] as const) {
    const getn = forms.members[(fam + 'Get') as 'dataGet']
    const setn = forms.members[(fam + 'Set') as 'dataSet']
    const one1 = forms.members[fam]
    if (null != getn && 0 < findDecls(forms, entity, esc(getn)).length) {
      shapes.push({ member: fam, shape: `${fam}Get + ${fam}Set (${getn}, ${setn})` })
    }
    else if (null != one1) {
      const d = findDecls(forms, entity, esc(one1))[0]
      if (null != d) {
        const last = d.params[d.params.length - 1]
        shapes.push({ member: fam, shape: (0 < d.params.length && !forms.optional(last) ? fam + 'Arg' : fam) + ` (${one1})` })
      }
    }
  }
  if (null != forms.members.stream && null != forms.streamKind) {
    const d = findDecls(forms, entity, esc(forms.members.stream))[0]
    if (null != d) shapes.push({ member: 'stream', shape: forms.streamKind(d) + ` (${forms.members.stream})` })
  }
  return {
    methods, load, style,
    async: null != load && null != forms.async && forms.async(load),
    record: null == recDecl ? null : { name: recDecl.name, params: recDecl.params.length },
    client: publicNames(forms.public.client, client),
    entity: publicNames(forms.public.entity, entity),
    shapes,
  }
}


export type { Citation, Decl, Exclusion, Family, Forms, On, OpName, Shape, Src, StreamItems, Style, View }
export {
  CTOR_NAMES,
  OPS,
  SCAFFOLD,
  bracketed,
  defaultSigName,
  defaultSigParams,
  defaultSigReturns,
  esc,
  findDecls,
  generatorColumn,
  namePattern,
  opMethod,
  opSource,
  publicNames,
  read,
  splitParams,
  view,
}
