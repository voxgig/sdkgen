
import { test, describe } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'

const Fs = require('node:fs')
const Path = require('node:path')

const SCAFFOLD = Path.join(__dirname, '..', 'project', '.sdk')

// Languages whose line comment is NOT `//`, and what it is. A `//` line
// inside an emitted code block for one of these does not compile.
const HASH_LANGS: Record<string, string> = {
  py: '#',
  rb: '#',
  perl: '#',
  lua: '--',
}

function sourceFiles(dir: string): string[] {
  if (!Fs.existsSync(dir)) return []
  return Fs.readdirSync(dir)
    .filter((f: string) => f.endsWith('.ts'))
    .map((f: string) => Path.join(dir, f))
}

function emittedCommentLines(src: string): string[] {
  const out: string[] = []
  // Stack of contexts: 'code' | 'template'. `${` pushes code, `}` pops.
  const stack: string[] = ['code']
  let i = 0
  let lineStart = true

  const top = () => stack[stack.length - 1]

  while (i < src.length) {
    const c = src[i]
    const c2 = src.substring(i, i + 2)

    if ('code' === top()) {
      if ('//' === c2) { while (i < src.length && '\n' !== src[i]) i++; continue }
      if ('/*' === c2) { i = src.indexOf('*/', i + 2); i = -1 === i ? src.length : i + 2; continue }

      if ('/' === c) {
        let j = i - 1
        while (0 <= j && /\s/.test(src[j])) j--
        const prev = 0 > j ? '' : src[j]
        if ('' === prev || '(,=:[!&|?{};+-*%~^'.includes(prev)) {
          i++
          let inClass = false
          while (i < src.length) {
            const rc = src[i]
            if ('\\' === rc) { i += 2; continue }
            if ('[' === rc) { inClass = true }
            else if (']' === rc) { inClass = false }
            else if ('/' === rc && !inClass) { i++; break }
            else if ('\n' === rc) { break }
            i++
          }
          continue
        }
      }

      if ("'" === c || '"' === c) {
        const q = c
        i++
        while (i < src.length && src[i] !== q) { i += '\\' === src[i] ? 2 : 1 }
        i++
        continue
      }
      if ('`' === c) { stack.push('template'); i++; lineStart = false; continue }
      if ('}' === c && 1 < stack.length) { stack.pop(); i++; continue }
      i++
      continue
    }

    // Inside a template literal.
    if ('\\' === c) { i += 2; continue }
    if ('`' === c) { stack.pop(); i++; continue }
    if ('${' === c2) { stack.push('code'); i += 2; continue }
    if ('\n' === c) { lineStart = true; i++; continue }
    if (lineStart) {
      // First non-space character of an emitted line.
      if (' ' === c || '\t' === c) { i++; continue }
      lineStart = false
      if ('//' === c2) {
        const end = src.indexOf('\n', i)
        out.push(src.substring(i, -1 === end ? src.length : end).trim())
      }
      continue
    }
    i++
  }
  return out
}

describe('emitted comment markers', () => {
  for (const [lang, marker] of Object.entries(HASH_LANGS)) {
    test(`${lang} components emit no // comment lines`, () => {
      const offenders: string[] = []
      for (const file of sourceFiles(Path.join(SCAFFOLD, 'src', 'cmp', lang))) {
        for (const line of emittedCommentLines(Fs.readFileSync(file, 'utf8'))) {
          offenders.push(`${Path.basename(file)}: ${line.trim()}`)
        }
      }
      deepStrictEqual(
        offenders, [],
        `${lang} uses "${marker}" for comments, so these emitted lines are a ` +
        `syntax error in the generated SDK:\n  ` + offenders.join('\n  '))
    })
  }
})

describe('ruby error attributes', () => {
  // Every attribute the Ruby utilities assign on the SDK error object must be
  // declared by the error class. Ruby has no implicit attribute creation.
  test('error.rb declares an accessor for every assigned attribute', () => {
    const errPath = Path.join(SCAFFOLD, 'tm', 'rb', 'core', 'error.rb')
    const errSrc = Fs.readFileSync(errPath, 'utf8')

    const declared = new Set<string>()
    for (const m of errSrc.matchAll(/attr_(?:accessor|writer)\s+(.+)/g)) {
      for (const sym of String(m[1]).matchAll(/:([a-z_][a-z0-9_]*)/g)) {
        declared.add(sym[1])
      }
    }
    // A hand-written `def name=(v)` counts as declared too.
    for (const m of errSrc.matchAll(/def\s+([a-z_][a-z0-9_]*)=/g)) {
      declared.add(m[1])
    }
    ok(0 < declared.size, 'no attributes found in ' + errPath)

    const utilDir = Path.join(SCAFFOLD, 'tm', 'rb', 'utility')
    const assigned = new Map<string, string>()
    for (const f of Fs.existsSync(utilDir) ? Fs.readdirSync(utilDir) : []) {
      if (!f.endsWith('.rb')) continue
      const src = Fs.readFileSync(Path.join(utilDir, f), 'utf8')
      // `sdk_err.status = …` / `err.code = …` — assignment onto an error var.
      for (const m of src.matchAll(
        /\b(?:sdk_err|err|error)\.([a-z_][a-z0-9_]*)\s*=(?!=)/g)) {
        assigned.set(m[1], f)
      }
    }

    const missing = [...assigned]
      .filter(([attr]) => !declared.has(attr))
      .map(([attr, file]) => `${attr} (assigned in ${file})`)

    deepStrictEqual(
      missing, [],
      'assigning an undeclared attribute is a NoMethodError in Ruby; add ' +
      'these to attr_accessor in tm/rb/core/error.rb:\n  ' + missing.join('\n  '))
  })
})
