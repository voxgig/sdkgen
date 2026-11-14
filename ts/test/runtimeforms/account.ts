// Every leaf a provider declares in facts, ref.facts and notes is derived,
// cited, a property of the language, or a documentation convention. The
// default category of each key is here; a forms file supplies citations.

import * as Fs from 'node:fs'
import * as Path from 'node:path'

import type { Citation, Forms } from './forms'
import { SCAFFOLD } from './forms'


type Category = 'derived' | 'cited' | 'language' | 'convention'

const DEFAULTS: [RegExp, Category][] = [
  [/^facts\.method\.\w+$/, 'derived'],
  [/^facts\.(async|result|record|listOf)$/, 'derived'],
  [/^facts\.(named|prints|errVar)$/, 'convention'],
  [/^facts\.unusedError$/, 'language'],
  [/^facts\.(collection|recordType|errSlot|nullValue|ok|err|pairForm|unwrap)$/, 'cited'],
  [/^ref\.facts\.(entityBy|noun|entityNoun|heading|keys)$/, 'convention'],
  [/^ref\.facts\.(none|maps)$/, 'language'],
  [/^ref\.facts\.lits\.(true|false)$/, 'language'],
  [/^ref\.facts\.(setArg|container)$/, 'cited'],
  // Derived where it is the type printer's word, else the options table's.
  [/^ref\.facts\.valueType\.\w+$/, 'derived'],
  [/^ref\.facts\.ctor\[\d+\]$/, 'derived'],
  [/^ref\.facts\.ctorAlts\[\d+\]\.(call|kind)$/, 'derived'],
  [/^ref\.facts\.test\[\d+\]\.(sig|call|args)$/, 'derived'],
  [/^ref\.facts\.test\[\d+\]\.alts\[\d+\]\.(call|kind)$/, 'cited'],
  [/^ref\.facts\.accessor\.(sig|arg)$/, 'derived'],
  [/^ref\.facts\.(op|opMatched)\.\w+$/, 'derived'],
  [/^ref\.facts\.(client|entity)\[\d+\]\.(sig|kind)$/, 'derived'],
  [/^ref\.facts\.(client|entity)\[\d+\]\.returns$/, 'cited'],
  // Whether a getter returns a copy or the live value: read off the runtime's code.
  [/^ref\.facts\.(client|entity)\[\d+\]\.copy$/, 'cited'],
  [/^ref\.facts\.(direct|prepare)\.returns$/, 'derived'],
  [/^ref\.facts\.direct\.signal$/, 'cited'],
  [/^ref\.facts\.prepare\.fails$/, 'cited'],
  [/^ref\.facts\.body\.(values|once|binary)$/, 'cited'],
  [/^ref\.facts\.cancel$/, 'cited'],
  [/^notes\./, 'cited'],
]

// A null value spelled as more than a keyword (`h.vnull()`) is the
// runtime's, not the language's.
const LANGUAGE_WORD = /^[A-Za-z]+$/

function defaultCategory(path: string, value: any): Category | null {
  if ('' === value) return 'convention'
  if (/\.kind$/.test(path) && /^utility/.test(value)) return 'cited'
  if ('ref.facts.none' === path && !LANGUAGE_WORD.test(String(value))) return 'cited'
  const hit = DEFAULTS.find(([re]) => re.test(path))
  return null == hit ? null : hit[1]
}


function leaves(x: any, pre: string, out: [string, any][]) {
  if (null == x || 'object' !== typeof x) return void out.push([pre, x])
  if (Array.isArray(x)) return void x.forEach((v, i) => leaves(v, pre + '[' + i + ']', out))
  for (const [k, v] of Object.entries(x)) leaves(v, pre ? pre + '.' + k : k, out)
}

function declaredLeaves(S: any): [string, any][] {
  const out: [string, any][] = []
  leaves(S.facts, 'facts', out)
  if (S.ref) leaves(S.ref.facts, 'ref.facts', out)
  for (const [k, v] of Object.entries(S.notes || {})) out.push(['notes.' + k, v])
  return out
}


// The code a value names, which its quote has to hold: backticked parts,
// a value with no spaces, or the identifiers of a value written as code.
// An empty list is prose: only an audit of the citation checks it.
const MARKDOWN = /^facts\.collection$|^ref\.facts\.(body\.\w+|setArg)$/

function codeTokens(path: string, value: any, spell: (s: string) => string): string[] {
  if ('string' !== typeof value || /^notes\./.test(path) || /\.kind$|\.fails$/.test(path)) return []
  const code = spell(value)
  const v = code.replace(/(?<!\$)\{\w+\}/g, ' ').trim()
  if ('' === v) return []
  const ticked = [...v.matchAll(/`([^`]+)`/g)].map((m) => m[1])
  if (0 < ticked.length || MARKDOWN.test(path)) return ticked
  if (!/\s/.test(code)) return [v]
  if (/[<>{}()[\]*:|"';=]/.test(code)) return v.split(/[^\w]+/).filter((w) => '' !== w)
  return []
}


type Account = {
  lang: string
  category: Record<string, Category | 'excepted'>
  cited: { path: string, file: string, quote: string, prose: boolean, value: any, unquoted: string[] }[]
  excepted: { path: string, reason: string }[]
  findings: string[]
}

function account(lang: string, S: any, forms: Forms, verified: Set<string>): Account {
  const out: Account = { lang, category: {}, cited: [], excepted: [], findings: [] }
  const cite = forms.cite || {}
  const exc = forms.exceptions || {}
  const spell = (s: string) => s.replace(/\{(\w+)\}/g, (_m, k: string) => forms.tokens[k] ?? '{' + k + '}')
  const all = declaredLeaves(S)
  const paths = new Set(all.map(([p]) => p))

  for (const [path, value] of all) {
    if (null != exc[path]) {
      out.category[path] = 'excepted'
      out.excepted.push({ path, reason: exc[path] })
      continue
    }
    const def = defaultCategory(path, value)
    if (null == def) {
      out.findings.push(`${path}: no default category in the shared account; add the key's category to DEFAULTS`)
      continue
    }
    if (verified.has(path)) {
      out.category[path] = 'derived'
      if (null != cite[path]) out.findings.push(`cite ${path}: the guard re-derives this fact; drop the citation`)
      continue
    }
    const c = cite[path]
    if (null != c) {
      const bad = checkCitation(lang, path, value, c, spell)
      if (null != bad) out.findings.push(bad)
      else {
        out.category[path] = 'cited'
        const parts = [c, ...(c.also || [])]
        const quote = parts.map((x) => ([] as string[]).concat(x.quote).join(' ... ')).join(' | ')
        out.cited.push({
          path, file: parts.map((x) => x.file).join(' | '), quote, value,
          prose: prosy(value, codeTokens(path, value, spell), spell),
          unquoted: Object.entries(c.unquoted || {}).map(([k, v]) => k + ': ' + v),
        })
      }
      continue
    }
    if ('derived' === def) {
      if (/^ref\.facts\.valueType\./.test(path)) out.category[path] = 'convention'
      else out.findings.push(`${path}: the guard could not re-derive it from the runtime and the forms do not cite it`)
    }
    else if ('cited' === def) out.findings.push(`${path}: cite the runtime file and a quote that shows ${JSON.stringify(value)}`)
    else out.category[path] = def
  }

  for (const p of Object.keys(cite)) if (!paths.has(p)) out.findings.push(`cite ${p}: the provider declares no such fact`)
  for (const p of Object.keys(exc)) {
    if (/^(facts|ref\.facts|notes)\./.test(p) && !paths.has(p)) out.findings.push(`exception ${p}: the provider declares no such fact`)
  }
  return out
}


// Whether a value says more than its code tokens: words a quote cannot pin.
function prosy(value: any, toks: string[], spell: (s: string) => string): boolean {
  if ('string' !== typeof value) return true
  let rest = spell(value).replace(/(?<!\$)\{\w+\}/g, ' ')
  for (const t of toks) rest = rest.split(t).join(' ')
  return /[A-Za-z]{2,}/.test(rest.replace(/`/g, ' '))
}


function checkCitation(lang: string, path: string, value: any, c: Citation, spell: (s: string) => string): string | null {
  const quotes: string[] = []
  for (const part of [c, ...(c.also || [])]) {
    if (!part.file.startsWith('src/cmp/' + lang + '/') && !part.file.startsWith('tm/' + lang + '/')) {
      return `cite ${path}: ${part.file} is not one of the ${lang} runtime's files`
    }
    const p = Path.join(SCAFFOLD, part.file)
    if (!Fs.existsSync(p)) return `cite ${path}: ${part.file} does not exist`
    const text = Fs.readFileSync(p, 'utf8')
    for (const q of ([] as string[]).concat(part.quote)) {
      if ('' === q.trim()) return `cite ${path}: an empty quote`
      if (!text.includes(q)) return `cite ${path}: ${part.file} no longer contains ${JSON.stringify(q)}`
      quotes.push(q)
    }
  }
  const joined = quotes.join('\n')
  const has = (tok: string) => new RegExp('(^|[^\\w])' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\w])').test(joined)
  const toks = codeTokens(path, value, spell)
  for (const tok of toks) {
    if (!has(tok) && null == c.unquoted?.[tok]) {
      return `cite ${path}: the quote does not contain ${JSON.stringify(tok)}, which the fact states`
    }
  }
  if (prosy(value, toks, spell)) {
    if (!('value' in c)) return `cite ${path}: no quote can hold ${JSON.stringify(value)}; pin the audited value (value: ...)`
    if (JSON.stringify(c.value) !== JSON.stringify(value)) {
      return `cite ${path}: the fact is ${JSON.stringify(value)}; the citation audited ${JSON.stringify(c.value)}`
    }
  }
  for (const tok of Object.keys(c.unquoted || {})) {
    if (!toks.includes(tok) || has(tok)) return `cite ${path}: unquoted ${tok} is not a token the quote lacks`
  }
  return null
}


function tally(a: Account): Record<string, number> {
  const n: Record<string, number> = { derived: 0, cited: 0, language: 0, convention: 0, excepted: 0 }
  for (const c of Object.values(a.category)) n[c]++
  return n
}


export type { Account, Category }
export { DEFAULTS, account, codeTokens, declaredLeaves, defaultCategory, tally }
