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
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import { execFileSync } from 'node:child_process'

import { memfs } from 'memfs'

import { SdkGen } from '../dist/sdkgen.js'


const PKG = Path.resolve(__dirname, '..')
const STAGE = Path.resolve(PKG, 'dist-test-scaffold')
const SCAFFOLD = Path.resolve(PKG, 'project', '.sdk')
// typescript's own entry SCRIPT, run through this node. `node_modules/.bin/tsc`
// is a shell script on POSIX and needs its `.cmd` shim on Windows, neither of
// which execFileSync can spawn directly — on Windows it fails with ENOENT.
// (`typescript/bin/tsc` is not in the package's `exports`, so resolve the
// library entry and step up to the package root.)
const TSC = Path.resolve(Path.dirname(require.resolve('typescript')), '..', 'bin', 'tsc')


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


function run(
  cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv,
): { ok: boolean, out: string } {
  try {
    const out = execFileSync(cmd, args,
      { cwd, encoding: 'utf8', stdio: 'pipe', ...(env ? { env } : {}) })
    return { ok: true, out: String(out || '') }
  }
  catch (err: any) {
    const out = String(err.stdout || '') + String(err.stderr || '')
    return { ok: false, out: '' === out.trim() ? String(err.message || err) : out }
  }
}


// The environment for a NESTED `node --test`.
//
// Node's test runner exports NODE_TEST_CONTEXT=child-v8 to everything it
// spawns, and a nested runner that sees it switches to the v8-serialiser
// reporter — which writes a binary stream, not TAP. The nested run then looks
// like a silent success: exit code 0, no counts to read, and a suite that
// skipped every case is indistinguishable from one that passed. Strip it, and
// ask for TAP explicitly rather than relying on the default.
function nestedTestEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  return env
}


function tsc(cwd: string, project: string) {
  return run(process.execPath, [TSC, '--build', project], cwd)
}


// A toolchain this machine does not have is skipped, not failed: the check
// is worth whatever compilers are present, and CI can install more. Windows
// has `where` rather than `which`, and a lookup that cannot run at all counts
// as absent, so the suite skips instead of failing on the probe.
function toolchain(name: string): string | null {
  const probe = 'win32' === process.platform
    ? run('where', [name], process.cwd())
    : run('/usr/bin/which', [name], process.cwd())
  if (!probe.ok) return null
  const first = probe.out.trim().split(/\r?\n/)[0]
  return '' === first ? null : first
}


// Generate one target into a fresh directory and hand back its root.
async function generateTo(
  target: string, root: string, extra?: string,
): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})

  const sdkgen = SdkGen({
    fs: layeredFs(fs),
    folder: STAGE,
    root: '',
    pino: makeLog(),
  })

  const cwd = process.cwd()
  process.chdir(SCAFFOLD)
  const res = await sdkgen.generate({
    model: makeModel([target], undefined, extra), root: makeRoot() })
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
    ok(Fs.existsSync(TSC), 'no local typescript — run `npm install`')

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


  // THE SAME TYPE-CHECK, ON THE DATA PATH (design rung L1).
  //
  // The TypeScript config is a class with object-literal fields, so its data
  // form is a different shape from Go's: the model becomes one string
  // constant and is parsed onto the instance at module load. That changes
  // what `config` is typed as, which only a compiler can check — the literal
  // form gives `config.entity` a precisely inferred type, the parsed form
  // gives it `any`, and anything downstream that depended on the narrow type
  // fails here rather than in a consumer's repo.
  //
  // The generated TEST suite is compiled too, for the same reason as above.
  test('typescript: src and tests type-check with the config as DATA', async () => {
    ok(Fs.existsSync(TSC), 'no local typescript — run `npm install`')

    const sdkroot = Path.join(tmp, 'ts-data')
    const out = await generateTo('ts', sdkroot, "main: kit: config: repr: 'data'")
    linkDeps(sdkroot)

    // Prove the data path was taken, so this cannot silently become a
    // duplicate of the literal test if the setting stops being honoured.
    const cfg = Object.entries(out).find(([n]) => /src\/Config\.ts$/.test(n))
    ok(cfg, 'no src/Config.ts generated')
    const cfgsrc = String(cfg![1])
    ok(/const CONFIG_DATA = "/.test(cfgsrc),
      'repr:data did not emit the data representation')
    ok(!/^\s*entity = \{/m.test(cfgsrc),
      'data path still emitted the entity field as a literal')

    // The embedded constant must be valid JSON carrying the real model: a
    // mangled string literal would still type-check and fail at import.
    const m = cfgsrc.match(/const CONFIG_DATA = ("(?:[^"\\]|\\.)*")/)
    ok(m, 'could not extract the embedded config constant')
    const parsed = JSON.parse(JSON.parse(m![1]))
    ok(0 < Object.keys(parsed.entity || {}).length, 'no entities in the data')
    strictEqual(parsed.main.name, 'Demo')

    const src = tsc(sdkroot, 'src')
    ok(src.ok, 'generated src does not compile on the DATA path:\n' + src.out)

    const suite = tsc(sdkroot, 'test')
    ok(suite.ok,
      'the GENERATED TEST SUITE does not compile on the DATA path:\n' +
      suite.out)
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


  // THE SAME BUILD, ON THE DATA PATH (design rung L1).
  //
  // Above a size threshold the config is emitted as a parsed JSON constant
  // rather than a composite literal. No fixture is anywhere near that
  // threshold, so without pinning `main.kit.config.repr` the branch every
  // large SDK depends on is compiled by nothing — the config could be
  // syntactically broken, or the embedded JSON mangled, and every suite would
  // stay green.
  //
  // This compiles it. `go vet` parses and type-checks the module AND its
  // generated tests, so a badly escaped string constant fails here.
  test('go: the module vets clean with the config emitted as DATA', async () => {
    const go = toolchain('go')
    if (null == go) {
      return
    }

    const sdkroot = Path.join(tmp, 'go-data')
    const out = await generateTo('go', sdkroot, "main: kit: config: repr: 'data'")

    // Prove the data path was actually taken, so this cannot quietly become a
    // duplicate of the literal test if the setting stops being honoured.
    const cfg = Object.entries(out).find(([n]) => /core\/config\.go$/.test(n))
    ok(cfg, 'no core/config.go generated')
    ok(/const configJSON = "/.test(String(cfg![1])),
      'repr:data did not emit the data representation')

    const vet = run(go, ['vet', './...'], sdkroot)
    ok(vet.ok, 'generated go on the DATA path does not vet clean:\n' + vet.out)
  })


  // The two representations must agree on VALUE TYPES, not just on content.
  //
  // json.Unmarshal decodes every JSON number as float64, while a composite
  // literal puts an integer token into map[string]any as an int. MakeConfig is
  // public API and consumers type-assert against it, so crossing a size
  // threshold silently changing int to float64 is a breaking change disguised
  // as an optimisation.
  //
  // This is the check the earlier equivalence test could not make: the demo
  // fixture contains no numbers at all, so both paths trivially agreed.
  test('go: data and literal paths agree on number types', async () => {
    const go = toolchain('go')
    if (null == go) {
      return
    }

    // A model carrying an integer AND a fractional value, so both branches of
    // the normaliser are exercised.
    const extra = "main: kit: config: headers: 'x-int': 7\n" +
      "main: kit: config: headers: 'x-frac': 1.5\n"

    const roots: Record<string, string> = {}
    for (const repr of ['data', 'literal']) {
      const root = Path.join(tmp, 'go-types-' + repr)
      await generateTo('go', root, extra + `main: kit: config: repr: '${repr}'`)
      roots[repr] = root

      Fs.writeFileSync(Path.join(root, 'core', 'types_probe_test.go'), `package core

import (
	"fmt"
	"os"
	"sort"
	"testing"
)

func TestTypesProbe(t *testing.T) {
	var out []string
	var walk func(any, string)
	walk = func(n any, p string) {
		switch v := n.(type) {
		case map[string]any:
			for k, c := range v {
				walk(c, p+"."+k)
			}
		case []any:
			for i, c := range v {
				walk(c, fmt.Sprintf("%s[%d]", p, i))
			}
		default:
			out = append(out, fmt.Sprintf("%s=%T", p, n))
		}
	}
	walk(MakeConfig(), "")
	sort.Strings(out)
	os.WriteFile("types.txt", []byte(fmt.Sprint(out)), 0644)
}
`)
      const t = run(go, ['test', './core/', '-run', 'TestTypesProbe'], root)
      ok(t.ok, repr + ': type probe did not run:\n' + t.out)
    }

    const dataTypes = Fs.readFileSync(Path.join(roots.data, 'core', 'types.txt'), 'utf8')
    const litTypes = Fs.readFileSync(Path.join(roots.literal, 'core', 'types.txt'), 'utf8')

    // The probe must actually have seen the integer, else this passes vacuously.
    ok(/x-int=int\b/.test(litTypes),
      'literal path did not carry an int - the fixture proves nothing: ' + litTypes)
    strictEqual(dataTypes, litTypes,
      'data and literal paths disagree on value types')
  })


  // C# is the third compiler this machine can run offline: `dotnet build`
  // type-checks the whole project, entity classes included.
  test('csharp: the project builds', async () => {
    const dotnet = toolchain('dotnet')
    if (null == dotnet) {
      return
    }

    const sdkroot = Path.join(tmp, 'csharp')
    await generateTo('csharp', sdkroot)

    const build = run(dotnet, ['build', '--nologo', '-v', 'quiet'], sdkroot)
    ok(build.ok, 'generated csharp does not build:\n' + build.out)
  })


  // PHP HAS NO BUILD STEP, WHICH IS WHY IT NEEDED THIS.
  //
  // `php -l` parses a file without running it — the cheapest possible check,
  // and until now nothing ran it, so a php target that did not PARSE could
  // ship. That is not hypothetical: an entity named `Namespace` emitted
  // `class Namespace`, a syntax error, and the php lane stayed green for as
  // long as the target has existed (issue #64).
  //
  // It stayed hidden because `types/` is on composer's classmap and nothing
  // references it, so PHP never loaded the file. A lane that only RUNS code
  // cannot see a file nothing requires; linting every file can.
  //
  // The fixture is extended with a reserved-word entity for this check
  // specifically, rather than added to the shared model — every target
  // generates from that model, and this is a php question.
  test('php: every generated file parses, reserved-word entities included',
    async () => {
      const php = toolchain('php')
      if (null == php) {
        return
      }

      const sdkroot = Path.join(tmp, 'php')

      // `namespace` is a PHP keyword AND, because class names are
      // case-insensitive, so are `Namespace` and `NAMESPACE`. A guard that
      // compares case-sensitively passes its own unit tests and still emits
      // an undeclarable class here.
      const files = await generateTo('php', sdkroot, RESERVED_ENTITY)

      const phpfiles = Object.keys(files).filter((p) => p.endsWith('.php'))
      ok(5 < phpfiles.length,
        'only ' + phpfiles.length + ' php files generated — the lint would ' +
        'pass vacuously')

      const bad: string[] = []
      for (const rel of phpfiles) {
        const lint = run(php, ['-l', Path.join(sdkroot, rel)], sdkroot)
        if (!lint.ok) {
          bad.push(rel + ':\n' + lint.out)
        }
      }

      deepStrictEqual(bad, [],
        'generated php does not parse:\n' + bad.join('\n'))

      // ...and the rename actually happened, so this cannot pass by the
      // entity having been dropped from the output altogether.
      const types = Object.entries(files)
        .find(([p]) => /^types\/.*Types\.php$/.test(p))
      ok(null != types, 'no types file generated')
      ok(/^class NamespaceType$/m.test(String(types![1])),
        'the reserved-word entity was not renamed:\n' +
        (String(types![1]).match(/^class \w*Namespace\w*$/gm) || []).join('\n'))
    })
})


// The FEATURE CORPUS, end to end: generate an SDK that has the feature,
// build it, and RUN the corpus runner it ships.
//
// WHY THIS EXISTS
//
// The runner skips a feature the SDK was not generated with, which is correct
// — a client without `cost` has nothing to run. But it makes the whole
// section skippable, and a skipped section is silent. `feature add` is what
// puts a feature in a project, so nothing in either repo failed if no project
// ever added `cost`: the corpus guards ("a section with zero cases is a
// FAILURE") only fire for a section some test actually reaches. That is the
// same false-green the corpus exists to prevent, one level up.
//
// So this generates a client WITH the feature, compiles it, runs the shipped
// runner against a corpus placed where a project keeps it, and asserts that
// cases ran. A skip here is a failure.
//
// WHAT IT DOES AND DOES NOT PROVE. The fixture below is written here, not
// read from create-sdkgen — sdkgen cannot depend on the package that depends
// on it. So this proves the MECHANISM end to end: the runner is generated,
// it compiles, the feature is in the client, an operation is discovered and
// driven, and cases execute rather than skip. It does not pin the shared
// cases; create-sdkgen's own suite guards those, and a consumer project runs
// them against every target.
describe('the feature corpus runs from a generated SDK', () => {

  let tmp = ''
  let cwd = ''

  before(() => {
    cwd = process.cwd()
    tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-corpus-'))
  })

  after(() => {
    if ('' !== cwd) process.chdir(cwd)
    if ('' !== tmp) Fs.rmSync(tmp, { recursive: true, force: true })
  })


  test('ts: cost cases execute against the generated client', async () => {
    ok(Fs.existsSync(TSC), 'no local typescript — run `npm install`')

    // The features the cases below compose. `test` and `log` are the fixture
    // model's own defaults and stay, so this differs from the other ts
    // generations only by the features under test.
    const sdkroot = Path.join(tmp, 'ts')
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })

    const before = process.cwd()
    process.chdir(SCAFFOLD)
    const res = await sdkgen.generate({
      model: makeModel(['ts'], undefined, undefined,
        ['test', 'log', 'cost', 'netsim', 'retry', 'cache']),
      root: makeRoot(),
    })
    process.chdir(before)
    strictEqual(res.ok, true, 'generation did not report ok')

    const out: Record<string, string> = {}
    for (const [path, content] of Object.entries(vol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.startsWith('.jostraca/') || rel.includes('/.jostraca/')) continue
      if (!rel.startsWith('ts/')) continue
      out[rel.slice(3)] = content
    }
    materialise(out, sdkroot)

    ok(null != out['src/feature/cost/CostFeature.ts'],
      'the cost feature was not generated into the SDK')
    ok(null != out['test/feature/Corpus.test.ts'],
      'the corpus runner was not generated into the SDK')

    // Where a project keeps the compiled corpus: the runner resolves
    // `../../.sdk/test/test.json` from its own dist-test/ directory.
    const testdir = Path.join(tmp, '.sdk', 'test')
    Fs.mkdirSync(testdir, { recursive: true })
    Fs.writeFileSync(Path.join(testdir, 'test.json'),
      JSON.stringify(CORPUS_FIXTURE, null, 2))

    linkDeps(sdkroot)

    const src = tsc(sdkroot, 'src')
    ok(src.ok, 'generated src does not compile:\n' + src.out)
    const suite = tsc(sdkroot, 'test')
    ok(suite.ok, 'the generated test suite does not compile:\n' + suite.out)

    // `node --test` on a path that does not exist is not an error, so check
    // the compiled runner is really there before reading its output.
    const compiled = Path.join(sdkroot, 'dist-test', 'feature', 'Corpus.test.js')
    ok(Fs.existsSync(compiled),
      'the corpus runner did not compile to ' + compiled + ':\n' + suite.out)

    const ran = run(process.execPath,
      ['--test', '--test-reporter=tap',
        Path.join('dist-test', 'feature', 'Corpus.test.js')],
      sdkroot, nestedTestEnv())

    ok(ran.ok,
      'the feature corpus FAILED against the generated SDK:\n' + ran.out)

    // A skip is the failure this test exists to catch, so read the counts
    // rather than trusting the exit code: node reports a fully-skipped suite
    // as a pass.
    const skipped = Number((ran.out.match(/^# skipped (\d+)$/m) || [])[1] || 0)
    strictEqual(skipped, 0,
      'the corpus SKIPPED rather than ran — the generated client is missing ' +
      'the feature, or has no operation the cases can drive:\n' + ran.out)

    const passed = Number((ran.out.match(/^# pass (\d+)$/m) || [])[1] || 0)
    ok(2 < passed, 'expected the corpus runner\'s own tests plus the cost ' +
      'section to pass, got ' + passed + ':\n' + ran.out)
  })
})


// A corpus in the shape create-sdkgen compiles, cut down to the cases that
// exercise both of cost's seams: pricing at the transport, and attributing
// once per operation at PreDone. `#OP1` is substituted by the runner with an
// operation it found on the generated client.
const CORPUS_FIXTURE = {
  feature: {
    cost: {
      basic: {
        set: [
          {
            name: 'flat unit is charged per call',
            feature: [{ name: 'cost', active: true, unit: 0.002 }],
            op: [{ op: '#OP1' }],
            out: { total: { calls: 1, amount: 0.002 }, last: { source: 'unit' } },
          },
          {
            name: 'every retry attempt is charged, but attributed as one operation',
            feature: [
              { name: 'netsim', active: true, failTimes: 2, failStatus: 503 },
              { name: 'cost', active: true, unit: 1 },
              { name: 'retry', active: true, retries: 3, minDelay: 1 },
            ],
            op: [{ op: '#OP1' }],
            out: { total: { calls: 1, attempts: 3, amount: 3 } },
          },
          {
            name: 'ordered inside the cache, a hit served from cache costs nothing',
            feature: [
              { name: 'cost', active: true, unit: 2 },
              { name: 'cache', active: true, ttl: 10000 },
            ],
            op: [{ op: '#OP1' }, { op: '#OP1' }],
            out: { total: { calls: 2, attempts: 1, amount: 2 } },
          },
          {
            name: 'deny refuses the call once the budget is spent',
            feature: [
              { name: 'cost', active: true, unit: 1, budget: 2, onBudget: 'deny' },
            ],
            op: [
              { op: '#OP1' }, { op: '#OP1' }, { op: '#OP1', err: 'cost_budget' },
            ],
            out: { total: { calls: 2, attempts: 2, amount: 2 }, budget: { exceeded: true } },
          },
        ],
      },
    },
  },
}


// An entity whose name PHP reserves, plus the flow entry the fixture model
// requires for every entity. Declared here rather than inline so the reason
// it exists stays next to the test that needs it.
const RESERVED_ENTITY = `
main: kit: entity: namespace: {
  alias: field: {}
  name: "namespace"
  id: { field: "id", name: "id" }
  field: {
    id:   { name: "id",   kind: "field", type: "\`$STRING\`", required: true }
    path: { name: "path", kind: "field", type: "\`$STRING\`", required: true }
  }
  fields: [
    { name: "id",   req: true, type: "\`$STRING\`" }
    { name: "path", req: true, type: "\`$STRING\`" }
  ]
  op: {
    list: {
      name: "list"
      points: [ {
        args: {}, method: "GET", orig: "/namespace", parts: ["namespace"]
        transform: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
  }
}

main: kit: flow: BasicNamespaceFlow: {
  entity: "namespace", kind: "basic", name: "BasicNamespaceFlow"
  step: [
    { op: "list" }
  ]
}
`
