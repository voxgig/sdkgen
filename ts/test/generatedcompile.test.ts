// Compile a generated SDK — INCLUDING its test tree — with a real compiler.
//
// WHY THIS EXISTS
//
// `generate.test.ts` generates to memfs and asserts on the TEXT. That catches
// a component that crashes or emits something visibly wrong, and it caught
// nothing when entity operations started returning entity instances: the
// generated flow tests still read `.id` off an op result, which is now an
// entity and has no such property. Every assertion in the suite passed. The
// break surfaced in a consumer's repo.
//
// Text assertions cannot see a type error. This runs `tsc` over the generated
// `src/` AND `test/`, which does — `planet_ref01_data.id` on a `PlanetEntity`
// is TS2339, and there is no way to write that check by hand that would not
// itself need maintaining.
//
// The generated tests are the most defect-prone output sdkgen produces
// (they thread model-derived variable names through five operations), and
// until now nothing compiled them at all.

import { test, describe, before, after } from 'node:test'
import { ok, strictEqual } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import { execFileSync } from 'node:child_process'

import { memfs } from 'memfs'

import { SdkGen } from '../dist/sdkgen.js'


const PKG = Path.resolve(__dirname, '..')
const STAGE = Path.resolve(PKG, 'dist-test-scaffold')
const SCAFFOLD = Path.resolve(PKG, 'project', '.sdk')
const TSC = Path.join(PKG, 'node_modules', '.bin', 'tsc')


// The generator suite's own fixture and Root, reused so this compiles exactly
// what `generate.test.ts` asserts on.
import { makeModel, makeRoot, layeredFs, makeLog } from './generateharness'


// Write a memfs volume out to a real directory.
function materialise(files: Record<string, string>, root: string) {
  for (const [rel, content] of Object.entries(files)) {
    const path = Path.join(root, rel)
    Fs.mkdirSync(Path.dirname(path), { recursive: true })
    Fs.writeFileSync(path, content)
  }
}


// The generated package resolves `@voxgig/struct` and friends, plus its own
// `'..'` self-import (via package.json main/types). Symlinking sdkgen's own
// node_modules gives it all of that without a network install.
function linkDeps(sdkroot: string) {
  const nm = Path.join(sdkroot, 'node_modules')

  // Symlink sdkgen's whole node_modules: the generated package resolves
  // `@voxgig/struct` and friends, and the `log` feature's pino/pino-pretty,
  // which sdkgen carries as devDependencies purely so this check can
  // type-check the feature source a generated SDK ships.
  const from = Path.join(PKG, 'node_modules')
  if (Fs.existsSync(from) && !Fs.existsSync(nm)) {
    Fs.symlinkSync(from, nm, 'dir')
    return
  }

  for (const dep of ['@voxgig', '@types', 'dotenv', 'pino', 'pino-pretty']) {
    const from = Path.join(PKG, 'node_modules', dep)
    if (!Fs.existsSync(from)) continue
    const to = Path.join(nm, dep)
    if (Fs.existsSync(to)) continue
    Fs.symlinkSync(from, to, 'dir')
  }
}


function run(cmd: string, args: string[], cwd: string): { ok: boolean, out: string } {
  try {
    const out = execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe' })
    return { ok: true, out: String(out || '') }
  }
  catch (err: any) {
    const out = String(err.stdout || '') + String(err.stderr || '')
    return { ok: false, out: '' === out.trim() ? String(err.message || err) : out }
  }
}


function tsc(cwd: string, project: string) {
  return run(TSC, ['--build', project], cwd)
}


// A toolchain this machine does not have is skipped, not failed: the check
// is worth whatever compilers are present, and CI can install more.
function toolchain(name: string): string | null {
  const probe = run('/usr/bin/which', [name], process.cwd())
  return probe.ok ? probe.out.trim().split('\n')[0] : null
}


// Generate one target into a fresh directory and hand back its root.
async function generateTo(target: string, root: string): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})

  const sdkgen = SdkGen({
    fs: layeredFs(fs),
    folder: STAGE,
    root: '',
    pino: makeLog(),
  })

  const cwd = process.cwd()
  process.chdir(SCAFFOLD)
  const res = await sdkgen.generate({ model: makeModel([target]), root: makeRoot() })
  process.chdir(cwd)
  strictEqual(res.ok, true, target + ': generation did not report ok')

  const out: Record<string, string> = {}
  for (const [path, content] of Object.entries(vol.toJSON() as Record<string, string>)) {
    const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
    if (rel.startsWith('.jostraca/') || rel.includes('/.jostraca/')) continue
    if (!rel.startsWith(target + '/')) continue
    out[rel.slice(target.length + 1)] = content
  }

  ok(0 < Object.keys(out).length, 'nothing generated for ' + target)
  materialise(out, root)
  return out
}


describe('generated SDK compiles', () => {

  let tmp = ''
  let cwd = ''

  before(() => {
    cwd = process.cwd()
    tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-compile-'))
  })

  after(() => {
    if ('' !== cwd) process.chdir(cwd)
    if ('' !== tmp) Fs.rmSync(tmp, { recursive: true, force: true })
  })


  // The headline: src AND test. `--build src` first, because the test tree
  // imports the package root, which resolves through the emitted dist/.
  test('typescript: src and the generated test suite both type-check', async () => {
    ok(Fs.existsSync(TSC), 'no local tsc — run `npm install`')

    const sdkroot = Path.join(tmp, 'ts')
    await generateTo('ts', sdkroot)
    linkDeps(sdkroot)

    const src = tsc(sdkroot, 'src')
    ok(src.ok, 'generated src does not compile:\n' + src.out)

    const suite = tsc(sdkroot, 'test')
    ok(suite.ok,
      'the GENERATED TEST SUITE does not compile:\n' + suite.out +
      '\nThis is the check that text assertions cannot make. A flow test ' +
      'reading `.id` off an op result is a type error the moment operations ' +
      'resolve to entities.')
  })


  // Go type-checks its test files too (`go vet` compiles them), so the same
  // class of defect is caught for the second reference target — including a
  // fake entity in a shipped test template that stops satisfying the entity
  // interface.
  test('go: the module and its generated tests vet clean', async () => {
    const go = toolchain('go')
    if (null == go) {
      return
    }

    const sdkroot = Path.join(tmp, 'go')
    await generateTo('go', sdkroot)

    const vet = run(go, ['vet', './...'], sdkroot)
    ok(vet.ok, 'generated go does not vet clean:\n' + vet.out)
  })
})
