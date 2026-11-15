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
  [/^facts\.(collection|recordType|errSlot|nullValue|ok|err|pairForm|noError|unwrap)$/, 'cited'],
  [/^ref\.facts\.(entityBy|noun|entityNoun|heading|keys)$/, 'convention'],
  // What a runtime's source spells: cited, the token in the quote.
  [/^ref\.facts\.none$/, 'cited'],
  [/^ref\.facts\.direct\.(okFalse|abortCode)$/, 'cited'],
  [/^ref\.facts\.maps$/, 'language'],
  [/^ref\.facts\.(setArg|container)$/, 'cited'],
  // Derived where it is the type printer's word, else the options table's.
  [/^ref\.facts\.valueType\.\w+$/, 'derived'],
  [/^ref\.facts\.ctor\[\d+\]$/, 'derived'],
  [/^ref\.facts\.ctorAlts\[\d+\]\.(call|kind)$/, 'derived'],
  [/^ref\.facts\.test\[\d+\]\.(sig|call|args)$/, 'derived'],
  [/^ref\.facts\.test\[\d+\]\.alts\[\d+\]\.(call|kind)$/, 'cited'],
  [/^ref\.facts\.accessor\.(sig|arg|param)$/, 'derived'],
  [/^ref\.facts\.(op|opMatched)\.\w+$/, 'derived'],
  [/^ref\.facts\.(client|entity)\[\d+\]\.(sig|kind|runs)$/, 'derived'],
  [/^ref\.facts\.(client|entity)\[\d+\]\.returns$/, 'cited'],
  // Whether a getter returns a copy or the live value: read off the runtime's code.
  [/^ref\.facts\.(client|entity)\[\d+\]\.copy$/, 'cited'],
  [/^ref\.facts\.(direct|prepare)\.returns$/, 'derived'],
  [/^ref\.facts\.direct\.signal$/, 'cited'],
  [/^ref\.facts\.prepare\.fails$/, 'cited'],
  [/^ref\.facts\.body\.(values|once|binary)$/, 'cited'],
  [/^ref\.facts\.cancel$/, 'cited'],
  // Whether a stream reads callopts.signal between items, apart from cancel.
  [/^ref\.facts\.streamSignal$/, 'cited'],
  [/^notes\./, 'cited'],
]

// A fact cited before the provider declares it: its citation carries the
// value the runtime shows, and a later declaration must equal it.
const AHEAD = /^ref\.facts\.(direct\.okFalse|streamSignal)$/

function defaultCategory(path: string, value: any): Category | null {
  if ('' === value) return 'convention'
  if (/\.kind$/.test(path) && /^utility/.test(value)) return 'cited'
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

// An unwrap is an expression whose operators carry its meaning (`as?` against
// `as!`): its quote must hold it verbatim.
const VERBATIM = /^facts\.unwrap$/

function codeTokens(path: string, value: any, spell: (s: string) => string): string[] {
  if ('string' !== typeof value || /\.kind$|\.fails$/.test(path)) return []
  if (VERBATIM.test(path)) return [spell(value).trim()]
  // A note is prose; the code it names is backticked, less the slots it fills.
  if (/^notes\./.test(path)) {
    return [...spell(value).matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((x) => !/^\{\w+(\.\w+)*\}$/.test(x))
  }
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
  cited: { path: string, file: string, quote: string, prose: boolean, absence: boolean, value: any, unquoted: string[] }[]
  excepted: { path: string, reason: string }[]
  // Facts cited before the provider declares them.
  ahead: { path: string, value: any }[]
  findings: string[]
}

function account(lang: string, S: any, forms: Forms, verified: Set<string>): Account {
  const out: Account = { lang, category: {}, cited: [], excepted: [], ahead: [], findings: [] }
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
      const bad = checkCitation(lang, path, value, c, spell, (x) => null != cite[x])
      if (null != bad) out.findings.push(bad)
      else {
        out.category[path] = 'cited'
        if ('absent' in c) {
          out.cited.push({
            path, file: `the whole ${lang} runtime (${runtimeFiles(lang).length} files)`, value, prose: false, absence: true,
            quote: 'absent: ' + c.absent.pattern + (c.absent.except || []).map((x) => `; left out: ${x.file} ${JSON.stringify(x.quote)} (${x.why})`).join(''),
            unquoted: [],
          })
        }
        else {
          const parts = [c, ...(c.also || [])]
          const quote = parts.map((x) => ([] as string[]).concat(x.quote).join(' ... ')).join(' | ')
          out.cited.push({
            path, file: parts.map((x) => x.file).join(' | '), quote, value,
            prose: prosy(value, codeTokens(path, value, spell), spell), absence: false,
            unquoted: Object.entries(c.unquoted || {}).map(([k, v]) => k + ': ' + v),
          })
        }
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

  for (const p of Object.keys(cite)) {
    if (paths.has(p)) continue
    if (!AHEAD.test(p)) {
      out.findings.push(`cite ${p}: the provider declares no such fact`)
      continue
    }
    const c = cite[p]
    if (!('value' in c)) out.findings.push(`cite ${p}: a fact not yet declared is cited with the value the runtime shows (value: ...)`)
    else {
      const bad = checkCitation(lang, p, c.value, c, spell)
      if (null != bad) out.findings.push(bad)
      else out.ahead.push({ path: p, value: c.value })
    }
  }
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


// What is not the runtime: the documentation components and providers, the
// naming hook, the example helpers and test generators of src/cmp, and a
// target's test trees (perl's t/, swift's Tests/). The test feature's own
// source (src/feature/test/, TestFeature.*) is runtime.
const NOT_RUNTIME = /^src\/cmp\/[\w-]+\/(Readme|Syntax|Naming|Test|utility_)[^/]*$|(?<!\/feature)\/(tests?|t|Tests)\/|_test\.|\.test\./

// The files of a runtime: its components and its templates.
function runtimeFiles(lang: string): string[] {
  const out: string[] = []
  const walk = (rel: string) => {
    const p = Path.join(SCAFFOLD, rel)
    if (!Fs.existsSync(p)) return
    if (Fs.statSync(p).isDirectory()) for (const f of Fs.readdirSync(p).sort()) walk(rel + '/' + f)
    else if (!NOT_RUNTIME.test(rel)) out.push(rel)
  }
  walk('src/cmp/' + lang)
  walk('tm/' + lang)
  return out
}

const ownFile = (lang: string, file: string) =>
  (file.startsWith('src/cmp/' + lang + '/') || file.startsWith('tm/' + lang + '/')) && !NOT_RUNTIME.test(file)

function runtimeText(lang: string, file: string): string | null {
  if (!ownFile(lang, file)) return null
  const p = Path.join(SCAFFOLD, file)
  return Fs.existsSync(p) && Fs.statSync(p).isFile() ? Fs.readFileSync(p, 'utf8') : null
}

// How many lines either side of a quote an unquoted token may not appear in.
const NEAR = 3

// A hyphen joins an identifier in a Lisp, so `to-map` does not hold `map`.
const wordIn = (tok: string, text: string) =>
  new RegExp('(^|[^\\w-])' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\w-])').test(text)

function checkCitation(lang: string, path: string, value: any, c: Citation, spell: (s: string) => string,
  cited?: (fact: string) => boolean): string | null {
  if ('absent' in c) return checkAbsence(lang, path, value, c, cited)
  const quotes: string[] = []
  const texts: [string, string][] = []
  for (const part of [c, ...(c.also || [])]) {
    if (!ownFile(lang, part.file)) {
      return `cite ${path}: ${part.file} is not one of the ${lang} runtime's files`
    }
    const p = Path.join(SCAFFOLD, part.file)
    if (!Fs.existsSync(p)) return `cite ${path}: ${part.file} does not exist`
    const text = Fs.readFileSync(p, 'utf8')
    for (const q of ([] as string[]).concat(part.quote)) {
      if ('' === q.trim()) return `cite ${path}: an empty quote`
      if (!text.includes(q)) return `cite ${path}: ${part.file} no longer contains ${JSON.stringify(q)}`
      quotes.push(q)
      // What surrounds a quote: the lines a reader of it sees.
      const lines = text.split('\n')
      const at = text.slice(0, text.indexOf(q)).split('\n').length - 1
      const n = q.split('\n').length
      texts.push([part.file + ':' + (at + 1), lines.slice(Math.max(0, at - NEAR), at + n + NEAR).join('\n')])
    }
  }
  const joined = quotes.join('\n')
  const has = (tok: string) => wordIn(tok, joined)
  const toks = codeTokens(path, value, spell)
  for (const tok of toks) {
    if (!has(tok) && null == c.unquoted?.[tok]) {
      return `cite ${path}: the quote does not contain ${JSON.stringify(tok)}, which the fact states`
    }
  }
  // A pin is compared whenever it is given: a token standing somewhere in the
  // quote does not make a different declaration the audited one.
  if ('value' in c && JSON.stringify(c.value) !== JSON.stringify(value)) {
    return `cite ${path}: the fact is ${JSON.stringify(value)}; the citation pins ${JSON.stringify(c.value)}`
  }
  if (prosy(value, toks, spell) && !('value' in c)) {
    return `cite ${path}: no quote can hold ${JSON.stringify(value)}; pin the audited value (value: ...)`
  }
  for (const tok of Object.keys(c.unquoted || {})) {
    if (!toks.includes(tok) || has(tok)) return `cite ${path}: unquoted ${tok} is not a token the quote lacks`
    // Not excused where it stands near what the citation quotes.
    const where = texts.find(([, text]) => wordIn(tok, text))
    if (null != where) return `cite ${path}: unquoted ${tok} occurs within ${NEAR} lines of the quote at ${where[0]}; quote it there`
  }
  return null
}


// An absence: a search over every file of the language's runtime that must
// find nothing outside the quoted regions it excludes, each with its reason.
// A region that no longer holds a match is stale, and fails too.
function checkAbsence(lang: string, path: string, value: any, c: Extract<Citation, { absent: any }>,
  cited?: (fact: string) => boolean): string | null {
  if (!('value' in c)) return `cite ${path}: an absence pins the value it shows (value: ...)`
  if (JSON.stringify(c.value) !== JSON.stringify(value)) return `cite ${path}: the fact is ${JSON.stringify(value)}; the absence shows ${JSON.stringify(c.value)}`
  if (null != (c.absent as any).files) return `cite ${path}: an absence searches the whole runtime; quote the regions it leaves out in except, with a reason, instead of naming files`
  const regions: { file: string, start: number, end: number, quote: string, used: number }[] = []
  for (const x of c.absent.except || []) {
    if (null == x.why || '' === x.why.trim()) return `cite ${path}: the region left out of ${x.file} gives no reason`
    if (null != x.fact && null != cited && !cited(x.fact)) return `cite ${path}: the region left out of ${x.file} shows ${x.fact}, which the forms do not cite`
    const text = runtimeText(lang, x.file)
    if (null == text) return `cite ${path}: ${x.file} is not one of the ${lang} runtime's files`
    for (const q of ([] as string[]).concat(x.quote)) {
      const n = text.split(q).length - 1
      if (1 !== n) return `cite ${path}: the region left out of ${x.file} must occur once; it occurs ${n} times (${JSON.stringify(q)})`
      const start = text.indexOf(q)
      regions.push({ file: x.file, start, end: start + q.length, quote: q, used: 0 })
    }
  }
  const re = new RegExp(c.absent.pattern.source, c.absent.pattern.flags.replace('g', '') + 'g')
  const files = runtimeFiles(lang)
  for (const f of files) {
    const text = Fs.readFileSync(Path.join(SCAFFOLD, f), 'utf8')
    for (const m of text.matchAll(re)) {
      const at = m.index as number
      const r = regions.find((x) => x.file === f && x.start <= at && at + m[0].length <= x.end)
      if (null != r) {
        r.used++
        continue
      }
      const line = text.slice(0, at).split('\n').length
      return `cite ${path}: the absence of ${c.absent.pattern} no longer holds: ${f}:${line} has ${JSON.stringify(m[0])}`
    }
  }
  const stale = regions.find((r) => 0 === r.used)
  if (null != stale) return `cite ${path}: the region left out of ${stale.file} holds no match (${JSON.stringify(stale.quote)}); drop it`
  if (0 === files.length) return `cite ${path}: the absence searched no file`
  return null
}


function tally(a: Account): Record<string, number> {
  const n: Record<string, number> = { derived: 0, cited: 0, language: 0, convention: 0, excepted: 0 }
  for (const c of Object.values(a.category)) n[c]++
  return n
}


export type { Account, Category }
// The runtime files a token occurs in.
function occurrences(lang: string, tok: string): string[] {
  return runtimeFiles(lang).filter((f) => wordIn(tok, Fs.readFileSync(Path.join(SCAFFOLD, f), 'utf8')))
}

export { AHEAD, DEFAULTS, NOT_RUNTIME, account, checkAbsence, checkCitation, occurrences, codeTokens, declaredLeaves, defaultCategory, runtimeFiles, runtimeText, tally }
