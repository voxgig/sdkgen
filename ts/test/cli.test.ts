// `SdkGen().action(args)` — the CLI dispatch boundary.
//
// Two defects lived here, and neither had any coverage: the CLI path was
// exercised by nothing (target.test.ts calls the resolver directly).

import { test, describe, before, after } from 'node:test'
import { ok, match, doesNotMatch, strictEqual } from 'node:assert'

import { spawnSync } from 'node:child_process'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { SdkGen } from '../dist/sdkgen.js'


// A minimal project to run the action from: `resolveActionContext` loads
// `./model/sdk.aon` relative to the CWD before any action runs, so an
// action can only be reached from inside one.
let dir = ''
let cwd = ''

before(() => {
  cwd = process.cwd()
  dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-cli-'))
  Fs.mkdirSync(Path.join(dir, 'model', 'target'), { recursive: true })
  Fs.mkdirSync(Path.join(dir, 'model', 'feature'), { recursive: true })
  // Enough model for an action to get as far as resolving its ref: the name
  // every derived value hangs off, and the three kit collections target_add
  // reads before it looks at the filesystem.
  Fs.writeFileSync(Path.join(dir, 'model', 'sdk.aon'),
    "name: 'demo'\nmain: kit: { target: {}, feature: {}, entity: {} }\n")
  Fs.writeFileSync(
    Path.join(dir, 'model', 'target', 'target-index.aon'), '# Targets\n')
  Fs.writeFileSync(
    Path.join(dir, 'model', 'feature', 'feature-index.aon'), '# Features\n')
  process.chdir(dir)
})

after(() => {
  process.chdir(cwd)
  Fs.rmSync(dir, { recursive: true, force: true })
})


async function actionError(args: string[]): Promise<string> {
  try {
    await SdkGen({ folder: dir, fs: Fs } as any).action(args)
  }
  catch (err: any) {
    return String(err?.message || err)
  }
  return ''
}


describe('cli dispatch', () => {

  test('a ref reaches the action as a RAW STRING', async () => {
    // Regression: every positional used to be mapped through `Jsonic(arg)`,
    // which parses it as relaxed JSON — so a Windows absolute ref arrived as
    // an OBJECT (`Jsonic('C:\\pkg\\go')` is `{ C: '\\pkg\\go' }`) and the
    // first thing resolveTarget does with it (`tref.split`) blew up on a
    // type error, nowhere near the actual mistake.
    //
    // The ref below cannot resolve either way; what is under test is HOW it
    // fails — a path that was looked for, not a value that was parsed.
    const msg = await actionError(['target', 'add', 'C:\\pkg\\go'])

    ok('' !== msg, 'a nonexistent target ref was accepted')
    doesNotMatch(msg, /is not a function|undefined/,
      'the ref was parsed into a non-string before reaching the resolver')
    match(msg, /Target folder not found/,
      'expected a resolution failure naming the folders searched, got: ' + msg)
  })


  test('comma-separated refs still split', async () => {
    // The one behaviour Jsonic incidentally provided (`'ts,py'` -> an array).
    // parseAddNames splits on commas itself, so nothing was lost — but if it
    // ever stops, this fails rather than silently adding a target literally
    // named `ts,py`.
    const msg = await actionError(['target', 'add', '/no/such/place/ts,/no/such/place/py'])

    ok('' !== msg, 'a nonexistent target ref was accepted')
    match(msg, /Target folder not found/, 'unexpected failure: ' + msg)
    doesNotMatch(msg, /ts,/, 'the comma-joined ref was treated as ONE name: ' + msg)
  })


  test('an INHERITED property is not a dispatchable action', async () => {
    // Regression: ACTION_MAP was a plain object literal, so it inherited
    // Object.prototype — `voxgig-sdkgen toString` (or `constructor`,
    // `valueOf`, `hasOwnProperty`) resolved to an inherited function, passed
    // the `null == actionFunc` guard, and was CALLED with the action
    // arguments instead of being reported as unknown.
    for (const name of ['toString', 'constructor', 'valueOf', 'hasOwnProperty']) {
      const msg = await actionError([name])
      match(msg, new RegExp('Unknown action: ' + name),
        'dispatched into Object.prototype for `' + name + '`: ' + msg)
    }
  })


  test('a genuinely unknown action still reports itself', async () => {
    const msg = await actionError(['nosuchaction'])
    match(msg, /Unknown action: nosuchaction/)
  })
})


// THE BINARY ITSELF, spawned.
//
// Everything above enters at `SdkGen().action(...)`, which is one layer
// inside `bin/voxgig-sdkgen` — and the layer it skips is where the CLI's own
// option validation lives. That validation rejected EVERY invocation that did
// not pass both `--only` and `--alias`: the optional flags were spelled
// `One(String, undefined)` in a closed shape, which makes a property
// required, so `voxgig-sdkgen target add ts` failed before dispatch. Nothing
// caught it because nothing ran the file.
//
// `package check` is the invocation used here because it is the one verb that
// needs no project model, so a failure is the binary's and nothing else's.
describe('the binary', () => {

  const BIN = Path.resolve(__dirname, '..', 'bin', 'voxgig-sdkgen')
  const PACKAGE_ROOT = Path.resolve(__dirname, '..')

  function run(args: string[], cwd: string) {
    return spawnSync(process.execPath, [BIN, ...args], {
      cwd, encoding: 'utf8',
    })
  }

  test('runs with no flags at all', () => {
    const res = run(['package', 'check', 'project'], PACKAGE_ROOT)

    doesNotMatch(String(res.stderr), /Validation failed/,
      'the CLI rejected its own options: ' + res.stderr)
    strictEqual(res.status, 0,
      'exit ' + res.status + '\n' + res.stdout + '\n' + res.stderr)
  })


  test('exits non-zero on an error finding, and says why', () => {
    // The CI gate: a checking verb has to fail the process, and print the
    // verb's own summary rather than doctor's drift wording.
    const pkg = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-bin-'))
    try {
      Fs.mkdirSync(Path.join(pkg, '.sdk', 'model', 'feature'), { recursive: true })
      Fs.writeFileSync(
        Path.join(pkg, '.sdk', 'model', 'feature', 'broken.aon'),
        '// a consumer cannot parse this\nmain: kit: feature: broken: {}\n')

      const res = run(['package', 'check', pkg], PACKAGE_ROOT)

      strictEqual(res.status, 1, 'expected a non-zero exit: ' + res.stdout)
      match(String(res.stdout), /error\(s\)/,
        'no summary printed: ' + res.stdout)
      doesNotMatch(String(res.stdout), /drifted from the scaffold/,
        "printed doctor's summary for a check: " + res.stdout)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  // A BROKEN PROJECT MODEL IS THE USER'S FILE, NOT AN SDKGEN CRASH.
  //
  // `resolveModel` hands aontu an `errs` array and used to report only from
  // that. aontu never fills it — every failure throws instead — so the
  // reporting branch was unreachable and the raw AontuError travelled all the
  // way out. `handleError` prints the whole error object for anything that is
  // not an SdkGenError, so the user saw aontu's (good) diagnostic followed by
  // a stack trace through sdkgen's `dist/` and a dump of the error's own
  // fields, which reads as a bug in the tool rather than a typo in their file.
  //
  // Spawned rather than called in-process, because the defect was entirely in
  // what reached the TERMINAL: the throw was always correct, its presentation
  // was not.
  describe('a broken project model', () => {

    // The three ways aontu fails, which are three different code paths inside
    // it and were all equally raw before.
    const BROKEN: [string, string, RegExp][] = [
      ['a syntax error', 'main: kit: {\n  broken\n', /unexpected character/],
      ['an unresolved path', 'main: x: $.nope.missing\n', /Cannot resolve value/],
      ['a unify conflict', 'main: a: string\nmain: a: 1\n', /Cannot unify/],
    ]

    for (const [label, model, detail] of BROKEN) {

      test(label + ' is reported, not dumped', () => {
        const proj = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-badmodel-'))
        try {
          Fs.mkdirSync(Path.join(proj, 'model'), { recursive: true })
          Fs.writeFileSync(Path.join(proj, 'model', 'sdk.aon'), model)

          const res = run(['doctor'], proj)
          const out = String(res.stdout) + String(res.stderr)

          strictEqual(res.status, 1, 'expected a non-zero exit: ' + out)

          // Named as a model problem, and WHOSE model.
          match(out, /Model Error: \.\/model\/sdk\.aon/, out)

          // aontu's own diagnostic is the useful half and is passed through
          // untouched — wrapping it must not swallow it.
          match(out, detail, out)

          // The regression itself: no stack, no error-object dump.
          doesNotMatch(out, /at resolveModel/, 'printed a stack trace: ' + out)
          doesNotMatch(out, /AontuError/, 'leaked the raw error: ' + out)
        }
        finally {
          Fs.rmSync(proj, { recursive: true, force: true })
        }
      })
    }

  })

})
