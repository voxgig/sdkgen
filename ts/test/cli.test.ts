// `SdkGen().action(args)` — the CLI dispatch boundary.
//
// Two defects lived here, and neither had any coverage: the CLI path was
// exercised by nothing (target.test.ts calls the resolver directly).

import { test, describe, before, after } from 'node:test'
import { ok, match, doesNotMatch } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { SdkGen } from '../dist/sdkgen.js'


// A minimal project to run the action from: `resolveActionContext` loads
// `./model/sdk.aontu` relative to the CWD before any action runs, so an
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
  Fs.writeFileSync(Path.join(dir, 'model', 'sdk.aontu'),
    "name: 'demo'\nmain: kit: { target: {}, feature: {}, entity: {} }\n")
  Fs.writeFileSync(
    Path.join(dir, 'model', 'target', 'target-index.aontu'), '# Targets\n')
  Fs.writeFileSync(
    Path.join(dir, 'model', 'feature', 'feature-index.aontu'), '# Features\n')
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
