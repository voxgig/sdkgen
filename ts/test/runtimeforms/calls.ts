// A printed call read in its language's own notation: what it is made on,
// through which separator, and how many arguments it passes. The guard reads
// the constructor, test-constructor and operation calls a provider prints,
// and the receivers its signatures write, with it.

import type { Forms, On } from './forms'
import { bracketed, splitParams } from './forms'


// `on`: the separators a member is called through, by what the runtime
// declares it on (lua `:` for an instance, `.` for the table itself).
// `args`: a parenthesised list, juxtaposed atoms (ocaml), or a Lisp form.
// `parenless`: a call may leave its parentheses out (rb, perl).
// `ctor`: a printed constructor name and the runtime declaration it runs
// (rb's `new` runs `initialize`).
// `factory`: template functions that construct their type argument from the
// arguments they pass on (cpp `std::make_shared<X>(...)`): a call of X's
// constructor on the type. The guard requires each in the runtime.
type CallNotation = {
  on: Partial<Record<On, string[]>>
  args?: 'paren' | 'space' | 'lisp'
  parenless?: boolean
  ctor?: Record<string, string>
  factory?: string[]
}

// `kind`: a variable the code holds (instance), a call's result, a qualifier
// (a type or module name), `new`, or nothing before the name.
type Call = { name: string, at: number, sep: string, recv: string, kind: On | 'qualified' | 'result' | 'free', args: string[] }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The names a block binds, which a call made on them makes on an instance.
function boundIn(text: string, extra: string[]): Set<string> {
  const out = new Set(extra)
  for (const m of text.matchAll(/(?:^|\n|\(def\s+|\blet\s+|\blocal\s+|\bmy\s+|\bconst\s+|\bvar\s+|\bval\s+)\s*\$?([A-Za-z_]\w*)\s*(?::=|=(?![=>~])|\))/g)) out.add(m[1])
  for (const m of text.matchAll(/\b[A-Za-z_][\w<>*:]*\s+\**([A-Za-z_]\w*)\s*=(?!=)/g)) out.add(m[1])
  return out
}

// The receiver chain ending where `end` is: identifiers joined by separators,
// each possibly called; its head decides what the call is made on.
function chainBefore(text: string, end: number): { recv: string, head: string, called: boolean } {
  let i = end
  let called = false
  while (0 < i) {
    while (0 < i && /\s/.test(text[i - 1]) && '\n' !== text[i - 1]) i--
    if (')' === text[i - 1] || ']' === text[i - 1]) {
      const close = text[i - 1]
      const open = ')' === close ? '(' : '['
      let depth = 0
      let j = i - 1
      for (; 0 <= j; j--) {
        if (text[j] === close) depth++
        else if (text[j] === open && 0 === --depth) break
      }
      if (j < 0) break
      i = j
      called = true
      continue
    }
    const id = /[$A-Za-z_][\w$]*$/.exec(text.slice(0, i))
    if (null == id) break
    i -= id[0].length
    const sep = /(::|->|\.|:)$/.exec(text.slice(0, i))
    if (null == sep) break
    i -= sep[0].length
  }
  const recv = text.slice(i, end).trim()
  const head = (/^\(?\s*\$?([A-Za-z_][\w$]*)/.exec(recv) || [])[1] || ''
  return { recv, head, called }
}

// Every call of `name` in `text`.
function readCalls(n: CallNotation, text: string, name: string, bound: string[] = []): Call[] {
  const out: Call[] = []
  const how = n.args || 'paren'
  const word = 'lisp' === how ? '[\\w?!*-]' : '[\\w$]'
  const re = new RegExp(`(?<!${word})${esc(name)}(?!${word})`, 'g')
  const binds = boundIn(text, ['client', 'self', 'this', 'planet', ...bound])
  for (const m of text.matchAll(re)) {
    const at = m.index as number
    const after = at + name.length
    if ('lisp' === how) {
      const q = /\(\s*(?:([\w.-]+)\/)?$/.exec(text.slice(0, at))
      if (null == q) continue
      const open = at - q[0].length + q[0].indexOf('(')
      const b = bracketed(text, open, '(')
      if (null == b) continue
      const args = lispForms(text.slice(after, b.end - 1))
      out.push({ name, at, sep: null == q[1] ? '' : '/', recv: q[1] || '', kind: null == q[1] ? 'free' : 'qualified', args })
      continue
    }
    let args: string[] | null = null
    let i = after
    while (' ' === text[i] || '\t' === text[i]) i++
    const fac = (n.factory || []).find((f) => new RegExp(`(?<![\\w:])${esc(f)}\\s*<\\s*$`).test(text.slice(0, at)))
    if (null != fac && '>' === text[i]) {
      let j = i + 1
      while (' ' === text[j] || '\t' === text[j]) j++
      const b = '(' === text[j] ? bracketed(text, j, '(') : null
      if (null != b) out.push({ name, at, sep: '', recv: '', kind: 'type', args: splitParams(b.inner) })
      continue
    }
    // A name bound by `=` is a binding, not a call (ocaml's `let planet = ...`).
    if ('space' === how && /^\s*=(?![=>])/.test(text.slice(after))) continue
    if ('space' === how) args = spaceArgs(text, after)
    else if ('(' === text[i]) {
      const b = bracketed(text, i, '(')
      if (null != b) args = splitParams(b.inner)
    }
    if (null == args && n.parenless && !/^\s*[=:,]/.test(text.slice(after))) args = []
    if (null == args) continue
    const pre = text.slice(0, at)
    const sep = /(::|->|\.|:|\/)\s*$/.exec(pre)
    if (/\bnew\s+$/.test(pre)) {
      out.push({ name, at, sep: '', recv: '', kind: 'type', args })
      continue
    }
    if (null == sep) {
      out.push({ name, at, sep: '', recv: '', kind: 'free', args })
      continue
    }
    const ch = chainBefore(text, at - sep[0].length)
    if ('' === ch.recv) {
      out.push({ name, at, sep: '', recv: '', kind: 'free', args })
      continue
    }
    const kind = binds.has(ch.head) ? 'instance' : (ch.called ? 'result' : 'qualified')
    out.push({ name, at, sep: sep[1], recv: ch.recv, kind, args })
  }
  return out
}

// OCaml's juxtaposed arguments: atoms up to the end of the expression.
function spaceArgs(text: string, from: number): string[] {
  const args: string[] = []
  let i = from
  for (;;) {
    while (' ' === text[i] || '\t' === text[i]) i++
    const c = text[i]
    if (null == c || '\n' === c || ';' === c || ')' === c || ']' === c || '|' === c || '=' === c || ',' === c) break
    if ('(' === c || '[' === c) {
      const b = bracketed(text, i, c as '(' | '[')
      if (null == b) break
      if ('(' !== c || '' !== b.inner.trim()) args.push(text.slice(i, b.end))
      i = b.end
      continue
    }
    if ('"' === c) {
      const e = text.indexOf('"', i + 1)
      if (e < 0) break
      args.push(text.slice(i, e + 1))
      i = e + 1
      continue
    }
    const tok = /^[\w.'$~?]+/.exec(text.slice(i))
    if (null == tok || /^(in|then|else|with|do|done|and|->)$/.test(tok[0])) break
    args.push(tok[0])
    i += tok[0].length
  }
  return args
}

// The top-level forms of a Lisp argument list.
function lispForms(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  let str = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (str) {
      cur += c
      if ('"' === c && '\\' !== s[i - 1]) str = false
      continue
    }
    if ('"' === c) str = true
    if ('([{'.includes(c)) depth++
    if (')]}'.includes(c)) depth--
    if (0 === depth && /\s/.test(c)) {
      if ('' !== cur.trim()) out.push(cur.trim())
      cur = ''
    }
    else cur += c
  }
  if ('' !== cur.trim()) out.push(cur.trim())
  return out
}

// Whether a call made this way may be on what the runtime declares.
function receiverFits(on: On, kind: Call['kind']): boolean {
  if ('instance' === on) return 'instance' === kind || 'result' === kind
  if ('type' === on) return 'qualified' === kind || 'type' === kind
  return 'qualified' === kind || 'free' === kind
}

// Whether a printed argument count fits a declaration's parameters.
function arityFits(forms: Forms, params: string[], n: number): boolean {
  const rest = params.some((p) => /^\.\.\.|\.\.\.\w*$|^&?rest\b|^\*\w/.test(p))
  const required = params.filter((p) => !forms.optional(p)).length
  return required <= n && (rest || n <= params.length)
}


export type { Call, CallNotation }
export { arityFits, readCalls, receiverFits }
