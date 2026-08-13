// Emitted comments must use the comment marker of the language they land in.
//
// This guards two defects that shipped in v3.0.0 and were only caught by a
// generated SDK's own doc tests, one layer downstream — by which point the
// bad output was already on its way into every repo in the fleet:
//
//   * A two-line comment in the "entity ops return the ENTITY" example had
//     `#` on the first line and `//` on the second, in the py, rb AND perl
//     README components. A `//` line is a SyntaxError in all three, so every
//     generated SDK's README-snippet test failed.
//   * rb/core/error.rb declared no `status` accessor while make_error.rb
//     assigned `sdk_err.status`. In Python and Lua that silently creates the
//     field; in Ruby it is a NoMethodError, so error handling raised while
//     reporting an error.
//
// Both are the same shape of mistake: language-neutral text pasted into a
// language-specific emitter. These checks read the scaffold sources, so they
// run without generating anything.

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

// Lines that are EMITTED — inside a template literal — rather than
// TypeScript source comments. Indentation cannot tell them apart (plenty of
// sdkgen's own comments sit at column 0), so this scans the file tracking
// string, comment and template state, and reports `//` lines only where the
// scanner is inside a template literal. `${…}` re-enters normal code, so an
// interpolated expression's own comments are not flagged.
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
