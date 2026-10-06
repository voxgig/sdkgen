import { test, describe } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'


// How each JVM port lets a request read the secret registry without the lock
// a registration holds, and still see the list it last published. A missed
// publication does not show on x86, so this checks the construct; the
// concurrency lanes run the suites.

const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


type Registry = {
  target: string
  file: string
  lisp?: boolean
  monitor: RegExp
  // An edit that loses the guarantee, which the check must report.
  unguard: [string, string]
} & ({
  // A map whose every read is volatile, each later write of its slot
  // publishing an immutable list under the monitor.
  builder: RegExp
  holder: RegExp
  holds: string
  write: RegExp
  published: RegExp
} | {
  // Every read and write of the slot under the monitor.
  touch: RegExp
})


const REGISTRIES: Registry[] = [
  {
    target: 'java',
    file: 'java/utility/Clean.java',
    builder: /static Map<String, Object> makeCleanConfig\(/,
    holder: /\bcfg = new ConcurrentHashMap<>\(\);/,
    holds: 'a ConcurrentHashMap',
    write: /\bcfg\.put\(\s*"values"\s*,/,
    published: /^cfg\.put\(\s*"values"\s*,\s*List\.copyOf\(/,
    monitor: /\bsynchronized\s*\(\s*cfg\s*\)\s*$/,
    unguard: ['cfg = new ConcurrentHashMap<>();', 'cfg = new LinkedHashMap<>();'],
  },
  {
    target: 'clojure',
    file: 'clojure/src/sdk/core.clj',
    lisp: true,
    builder: /\(defn make-clean-config\b/,
    holder: /\(doto \(java\.util\.concurrent\.ConcurrentHashMap\.\)/,
    holds: 'a ConcurrentHashMap',
    write: /\(\.put\s+(?:\^[\w.]+\s+)?cfg\s+"values"/,
    published: /^\(\.put\s+(?:\^[\w.]+\s+)?cfg\s+"values"\s+\(vec\s/,
    monitor: /^\(locking\s+cfg\b/,
    unguard: ['(doto (java.util.concurrent.ConcurrentHashMap.)', '(doto (java.util.LinkedHashMap.)'],
  },
  {
    target: 'kotlin',
    file: 'kotlin/utility/CoreUtil.kt',
    touch: /\bcfg\.values\b/,
    monitor: /\bsynchronized\s*\(\s*cfg\s*\)\s*$/,
    unguard: ['synchronized(cfg) { cfg.values.toList() }', 'cfg.values.toList()'],
  },
  {
    target: 'scala',
    file: 'scala/utility/Misc.scala',
    touch: /\bcfg\.values\b/,
    monitor: /\bcfg\.synchronized\s*$/,
    unguard: ['cfg.synchronized { new ArrayList[String](cfg.values) }', 'new ArrayList[String](cfg.values)'],
  },
]


// The end of the quoted literal at i; a quote left open on its line is taken
// alone.
function quoted(text: string, i: number, quote: string, multiline: boolean): number {
  for (let k = i + 1; k < text.length; k++) {
    if ('\\' === text[k]) k++
    else if (quote === text[k]) return k + 1
    else if ('\n' === text[k] && !multiline) return i + 1
  }
  return text.length
}


// Where the string, character literal or comment starting at i ends, else i.
function literal(text: string, i: number, lisp: boolean): number {
  const upto = (from: number, token: string) => {
    const k = text.indexOf(token, from)
    return k < 0 ? text.length : k + token.length
  }
  if (lisp) {
    return ';' === text[i] ? upto(i, '\n') : '\\' === text[i] ? i + 2
      : '"' === text[i] ? quoted(text, i, '"', true) : i
  }
  return text.startsWith('//', i) ? upto(i, '\n')
    : text.startsWith('/*', i) ? upto(i + 2, '*/')
      : text.startsWith('"""', i) ? upto(i + 3, '"""')
        : '"' === text[i] || "'" === text[i] ? quoted(text, i, text[i], false) : i
}


// The text with strings, character literals and comments blanked, so a
// delimiter inside one is not counted.
function blank(text: string, lisp: boolean): string {
  const out = text.split('')
  for (let i = 0; i < text.length;) {
    const end = literal(text, i, lisp)
    for (let k = i; k < end; k++) {
      if ('\n' !== out[k]) out[k] = ' '
    }
    i = end > i ? end : i + 1
  }
  return out.join('')
}


// The openers enclosing at, innermost first.
function enclosing(masked: string, at: number, open: string, close: string): number[] {
  const out: number[] = []
  let depth = 0
  for (let i = at - 1; 0 <= i; i--) {
    if (close === masked[i]) depth++
    else if (open === masked[i] && 0 === depth) out.push(i)
    else if (open === masked[i]) depth--
  }
  return out
}


// The end of the block or form opening at or after start.
function extent(masked: string, start: number, open: string, close: string): number {
  let depth = 0
  for (let i = masked.indexOf(open, start); 0 <= i && i < masked.length; i++) {
    if (open === masked[i]) depth++
    else if (close === masked[i] && 0 === --depth) return i + 1
  }
  return masked.length
}


function problems(row: Registry, text: string): string[] {
  const lisp = true === row.lisp
  const masked = blank(text, lisp)
  const [open, close] = lisp ? ['(', ')'] : ['{', '}']
  const found: string[] = []
  const at = (re: RegExp) => [...text.matchAll(new RegExp(re.source, 'g'))]
    .map((m) => m.index as number).filter((i) => ' ' !== masked[i])
  const where = (i: number) => row.file + ':' + text.slice(0, i).split('\n').length
  const held = (i: number) => enclosing(masked, i, open, close)
    .some((o) => row.monitor.test(lisp ? masked.slice(o) : masked.slice(0, o)))

  if ('touch' in row) {
    const touches = at(row.touch)
    if (0 === touches.length) found.push(row.file + ': the registry is never read')
    for (const i of touches.filter((i) => !held(i))) found.push(where(i) + ': read outside the monitor')
    return found
  }

  const start = at(row.builder)[0]
  if (null == start) return [row.file + ': nothing builds the registry']
  const end = extent(masked, start, open, close)
  if (!row.holder.test(text.slice(start, end))) {
    found.push(where(start) + ': the registry is not built as ' + row.holds)
  }
  const writes = at(row.write).filter((i) => i < start || end <= i)
  if (0 === writes.length) found.push(row.file + ': the registry is never written')
  for (const i of writes) {
    if (!held(i)) found.push(where(i) + ': written outside the monitor')
    if (!row.published.test(text.slice(i))) found.push(where(i) + ': publishes a mutable list')
  }
  return found
}


describe('the secret registry on the JVM ports', () => {

  for (const row of REGISTRIES) {
    const text = Fs.readFileSync(Path.join(TM, row.file), 'utf8')

    test(row.target + ': a request reads the list the last registration published', () => {
      deepStrictEqual(problems(row, text), [])
    })

    test(row.target + ': a registry read without that guarantee is reported', () => {
      const [from, to] = row.unguard
      ok(text.includes(from), row.file + ' does not hold ' + from)
      const lost = 'touch' in row ? 'read outside the monitor' : 'is not built as'
      const found = problems(row, text.replace(from, to))
      ok(found.some((line) => line.includes(lost)),
        row.target + ': ' + to + ' in place of ' + from + ' was not reported: ' + found.join('; '))
    })
  }
})
