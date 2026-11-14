// How a runtime writes things, declared once per language in
// test/runtimeforms/<lang>.ts. The guard (runtimefacts.test.ts) reads the
// runtime through these forms and re-derives, from the runtime alone, what a
// syntax provider declares about it. Adding a language adds one file here.

import * as Fs from 'node:fs'
import * as Path from 'node:path'


// One declaration found in the runtime.
type Decl = {
  name: string
  params: string[] // as written, the receiver dropped
  returns: string // the return the declaration states; '' when none
  head: string // the text the declaration pattern matched
  before: string // the source just ahead of the declaration
  rest: string // the source from the declaration on
  file: string
}

type Style = 'throw' | 'raise' | 'die' | 'pair' | 'errslot' | 'union' | 'wrapped'

// A member family: the kinds of RefFacts members that are the same member,
// written in a different shape (data, dataArg, dataGet and dataSet are all
// the entity's data).
type Family =
  | 'options' | 'utility' | 'direct' | 'prepare' | 'tester'
  | 'data' | 'match' | 'make' | 'name' | 'client' | 'entopts' | 'stream'

type Forms = {
  // Where the runtime is, relative to project/.sdk. `client`: the client's
  // members, the constructors and the test constructors (the generator
  // components that write them included); `entity`: an entity's members and
  // accessor; `ops`: the six operations.
  files: { client: string[], entity: string[], ops: string[] }

  // A declaration of `name`. The match must end where its parameter list
  // opens.
  decl: (name: string) => RegExp
  open?: '(' | '[' // the bracket a parameter list opens with; default '('
  split?: 'comma' | 'space' // how parameters are separated; default 'comma'
  receiver?: RegExp // a leading parameter the runtime declares and a signature omits
  // Whether a parameter may be left out by the caller.
  optional: (param: string) => boolean
  // The return a declaration states, from the text after its parameter list
  // (and the text ahead of it, for a separate type specification).
  returns: (after: string, before: string, head: string) => string

  // Every public member the client and an entity define, by name: a global
  // pattern whose first group is the name.
  public: { client: RegExp, entity: RegExp }
  // Public runtime members the page does not document, each with its reason.
  undocumented?: Record<string, string>

  // The runtime name of each member family, where the runtime has it.
  members: Partial<Record<Family | 'dataGet' | 'dataSet' | 'matchGet' | 'matchSet', string>>
  // The kind a stream member is, from its declaration.
  streamKind?: (d: Decl) => string

  // How the result style shows in the load operation's declaration; the
  // first that holds wins, and `exception` is the style when none does.
  style: {
    exception: 'throw' | 'raise' | 'die'
    raises: RegExp // how the runtime raises, so `exception` is checked
  } & Partial<Record<'pair' | 'errslot' | 'union' | 'wrapped', (d: Decl) => boolean>>

  // Whether operations resolve (a promise or task) rather than return, from
  // the load operation's declaration; default: they return.
  async?: (d: Decl) => boolean

  // The function a record accessor calls, and its arity where it says.
  record: (record: string) => { name: string, arity?: number }

  // How a declared signature names its function and its parameters. The
  // defaults read `name(a, b)` after any receiver (`x.`, `x->`).
  sigName?: (sig: string) => string
  sigParams?: (sig: string) => string[]
  sigReturns?: (sig: string) => string

  // How the signature tokens are spelled in the runtime's templates, so a
  // declared return can be compared with the runtime's.
  tokens: Record<string, string>

  // Field types: `column` is the code generator's own type map (canonToType)
  // where the language has one; `any` lists the canonical types whose
  // printed name may be the generic one.
  types: { column: string | null, any?: string[] }

  // Facts the forms deliberately do not compare, each with its reason
  // (counted as unguarded).
  exceptions?: Record<string, string>
}


const SCAFFOLD = Path.resolve(__dirname, '..', '..', 'project', '.sdk')

function read(files: string[]): { file: string, text: string }[] {
  return files.flatMap((f) => {
    const p = Path.join(SCAFFOLD, f)
    if (!Fs.existsSync(p)) throw new Error('runtime file named by the forms is missing: ' + f)
    return [{ file: f, text: Fs.readFileSync(p, 'utf8') }]
  })
}


// The text inside the bracket that opens at `at`, and the index after it.
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


// Parameters split at the top level.
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


// Every declaration of `name` in the files.
function findDecls(forms: Forms, files: { file: string, text: string }[], name: string): Decl[] {
  const out: Decl[] = []
  const re = new RegExp(forms.decl(name).source, 'gm')
  for (const { file, text } of files) {
    for (const m of text.matchAll(re)) {
      const at = (m.index as number) + m[0].length
      const b = bracketed(text, at, forms.open || '(')
      if (null == b) continue
      let params = splitParams(b.inner, forms.split)
      if (forms.receiver && 0 < params.length && forms.receiver.test(params[0])) params = params.slice(1)
      const after = text.slice(b.end, b.end + 200).split('\n')[0]
      const before = text.slice(Math.max(0, (m.index as number) - 400), m.index as number)
      out.push({
        name, params, returns: forms.returns(after, before, m[0]).trim(), head: m[0],
        before, rest: text.slice(at, at + 3000), file,
      })
    }
  }
  return out
}


// The names a global pattern finds.
function publicNames(re: RegExp, files: { file: string, text: string }[]): string[] {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  const found = new Set<string>()
  for (const { text } of files) for (const m of text.matchAll(g)) found.add(m.slice(1).find((x) => null != x) as string)
  return [...found].sort()
}


const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A name pattern for a declared name holding signature tokens: `{var}_stream`.
function namePattern(name: string): string {
  return esc(name).replace(/\\\{\w+\\\}/g, '\\w+')
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


export type { Decl, Family, Forms, Style }
export {
  SCAFFOLD,
  bracketed,
  defaultSigName,
  defaultSigParams,
  defaultSigReturns,
  esc,
  findDecls,
  namePattern,
  publicNames,
  read,
  splitParams,
}
