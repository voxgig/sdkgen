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
import { spawnSync } from 'node:child_process'

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


// BOTH STREAMS, on success as well as on failure.
//
// execFileSync hands back stdout alone when a command succeeds, and the
// runners this drives report through stderr - perl's `diag`, phpunit's
// fwrite(STDERR), java's System.err - because that is where a test framework
// puts a diagnostic. A lane that read stdout only would see a passing suite
// and none of what it said, which is how a fully-SKIPPED run looks.
function run(
  cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv,
): { ok: boolean, out: string, unlaunchable: boolean } {
  // A windows toolchain shim is a BATCH FILE - `mvn.cmd`, `phpunit.bat` - and
  // node refuses to spawn one without a shell (CVE-2024-27980). Quote the
  // path rather than pass it bare: `shell: true` builds one command line, so
  // an unquoted `C:\Program Files\...` would split at the space. Everything
  // else spawns directly, which needs no quoting and cannot be shell-injected.
  const shim = 'win32' === process.platform && /\.(cmd|bat)$/i.test(cmd)

  const res = spawnSync(shim ? '"' + cmd + '"' : cmd, args,
    {
      cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      ...(shim ? { shell: true } : {}),
      ...(env ? { env } : {}),
    })

  const out = String(res.stdout || '') + String(res.stderr || '')

  // A command that could not be LAUNCHED (ENOENT, EINVAL) has no output to
  // report, and says nothing about what it would have run: that is an
  // environment gap, which callers report as a skip rather than a failure.
  if (null != res.error) {
    return {
      ok: false,
      out: '' === out.trim() ? String(res.error.message) : out,
      unlaunchable: true,
    }
  }

  return { ok: 0 === res.status, out, unlaunchable: false }
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

  const found = probe.out.trim().split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => '' !== line)
  if (0 === found.length) return null

  if ('win32' !== process.platform) return found[0]

  // `where` lists EVERY match, and a tool packaged from a unix-shaped
  // distribution puts its extensionless shell script first: maven ships
  // `bin\mvn` beside `bin\mvn.cmd`, and windows cannot execute the former
  // (spawnSync ... ENOENT), so taking the first line picked the one thing
  // that could not run. Prefer a match windows can actually launch, and
  // report none as absent - a lane then SKIPS rather than failing on a
  // toolchain this machine cannot start.
  return found.find((path) => /\.(exe|com|cmd|bat)$/i.test(path)) || null
}


// Generate one target into a fresh directory and hand back its root.
async function generateTo(
  target: string, root: string, extra?: string, features?: string[],
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
    model: makeModel([target], undefined, extra, features), root: makeRoot() })
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
  // A request transform that FAILS must abort the operation.
  //
  // struct go 0.1.3 gave Transform an error return, so this path exists for
  // the first time. The ts reference routes the failure through makeError -
  // which THROWS, unwinding the operation. go's makeError cannot throw, it
  // returns; and the PrepareBody seam this sits behind returns a plain
  // value. So without an explicit abort in makeSpec the error object simply
  // became the request BODY: the call went out, and a 200 made a failed
  // transform look like a successful operation. That is what this pins.
  //
  // Driven through the supported `transformRequest` utility override rather
  // than a spec that makes Transform fail: the validate injectors that
  // produce Transform errors are not reachable from a transform spec, and
  // the defect is in how the RESULT is handled, not in what triggers it.
  test('go: a failed request transform aborts instead of being sent', async () => {
    const go = toolchain('go')
    if (null == go) {
      return
    }

    const sdkroot = Path.join(tmp, 'go-reqform')
    await generateTo('go', sdkroot)

    Fs.writeFileSync(
      Path.join(sdkroot, 'test', 'reqform_probe_test.go'),
      `package sdktest

import (
	"errors"
	"testing"

	sdk "github.com/voxgig-sdk/demo-sdk/go"
	"github.com/voxgig-sdk/demo-sdk/go/core"
)

// A failed request transform must ABORT the operation, not travel onward as
// the request body.
func TestReqformProbe(t *testing.T) {
	sent := 0

	client := sdk.NewDemoSDK(map[string]any{
		"utility": map[string]any{
			// Stands in for \`vs.Transform\` reporting an error: an error
			// VALUE out of the seam, which is exactly what
			// transformRequestUtil hands back on that path.
			"transformRequest": func(ctx *core.Context) any {
				return errors.New("reqform exploded")
			},
			"fetcher": sdk.FetcherFunc(func(
				ctx *sdk.Context, fullurl string, fetchdef map[string]any,
			) (any, error) {
				sent++
				return map[string]any{
					"status": 200, "ok": true,
					"json": func() (any, error) { return map[string]any{}, nil },
				}, nil
			}),
		},
	})

	out, err := client.Planet(nil).Create(map[string]any{"name": "p1"}, map[string]any{})

	t.Logf("sent=%d err=%v out=%T", sent, err, out)

	if sent != 0 {
		t.Errorf("FAIL: request was SENT despite a failed request transform (sent=%d)", sent)
	}
	if err == nil {
		t.Errorf("FAIL: operation reported success despite a failed request transform")
	}
}
`)

    const probe = run(go, ['test', './test/', '-run', 'TestReqformProbe', '-v'], sdkroot)
    ok(probe.ok,
      'a failed request transform did not abort the operation:\n' + tail(probe.out))
  })


  // The response half of the same story, and a different trap.
  //
  // transformResponse runs from BOTH makeResponse and makeResult, but only
  // the makeResult call reaches the transform: resultBasic never sets Ok, so
  // the makeResponse call returns at its `!result.Ok` guard, and makeResponse
  // then sets Ok true. By the time the transform really runs, Ok is already
  // true - and doneUtil returns result.Resdata whenever Ok is true, WITHOUT
  // consulting Err. So recording only the error left a failed response
  // transform resolving successfully.
  //
  // Unlike the request lane this drives a REAL vs.Transform error, an unknown
  // $FORMAT name in the list form, through the real utility.
  test('go: a failed response transform fails the operation', async () => {
    const go = toolchain('go')
    if (null == go) {
      return
    }

    const sdkroot = Path.join(tmp, 'go-resform')
    await generateTo('go', sdkroot)

    Fs.writeFileSync(
      Path.join(sdkroot, 'test', 'resform_probe_test.go'),
      `package sdktest

import (
	"testing"

	sdk "github.com/voxgig-sdk/demo-sdk/go"
	"github.com/voxgig-sdk/demo-sdk/go/core"
)

// A failed RESPONSE transform must fail the operation.
//
// Driven with a real vs.Transform error - an unknown $FORMAT name - through
// the real transformResponse utility, in the state makeResult reaches it in:
// result.Ok already true. resultBasic never sets Ok, so the makeResponse call
// returns at the !result.Ok guard and only the makeResult call gets this far.
func TestResformProbe(t *testing.T) {
	client := sdk.NewDemoSDK(map[string]any{})
	utility := client.GetUtility()

	result := core.NewResult(map[string]any{})
	result.Ok = true
	result.Body = map[string]any{"a": "hi"}

	ctx := &core.Context{
		Out:     map[string]any{},
		Ctrl:    &core.Control{},
		Client:  client,
		Utility: utility,
		Op:      core.NewOperation(map[string]any{"name": "load"}),
		Point: map[string]any{
			"transform": map[string]any{
				"res": []any{"\`$FORMAT\`", "nosuchformat", "\`body\`"},
			},
		},
		Result: result,
	}

	utility.TransformResponse(ctx)

	if result.Err == nil {
		t.Errorf("FAIL: a failed response transform recorded no error")
	}

	// The half that matters: doneUtil returns result.Resdata whenever Ok is
	// true and never consults Err, so recording only the error would leave
	// the operation resolving successfully.
	if result.Ok {
		t.Errorf("FAIL: result.Ok left TRUE after a failed response transform - " +
			"doneUtil ignores Err, so the operation would report success")
	}
}
`)

    const probe = run(go, ['test', './test/', '-run', 'TestResformProbe', '-v'], sdkroot)
    ok(probe.ok,
      'a failed response transform did not fail the operation:\n' + tail(probe.out))
  })


  // `auth: null` - the documented way to disable auth outright - must beat an
  // explicit apikey.
  //
  // struct's validate treats a STORED NULL as "no value", so the optspec's
  // `auth` default fires and the suppression silently becomes "use default
  // auth", putting on the wire the very credential the caller asked to
  // withhold. ts hit this on its own migration and fixed it in makeOptions;
  // go had the same defect independently.
  //
  // No corpus entry can catch this: corpus nulls travel as the '__NULL__'
  // STRING, so real-JSON-null semantics are invisible to every port's shared
  // fixtures. It has to be a target-level test like this one.
  test('go: auth null suppresses the credential', async () => {
    const go = toolchain('go')
    if (null == go) {
      return
    }

    const sdkroot = Path.join(tmp, 'go-authnull')
    await generateTo('go', sdkroot)

    Fs.writeFileSync(
      Path.join(sdkroot, 'test', 'authnull_probe_test.go'),
      `package sdktest

import (
	"testing"

	sdk "github.com/voxgig-sdk/demo-sdk/go"
)

// \`auth: nil\` is the documented way to disable auth outright. It must beat an
// explicit apikey, because that is the only case that DISCRIMINATES: with no
// apikey nothing goes on the wire anyway, so "auth nil alone" passes whether
// the suppression works or not.
func TestAuthNullProbe(t *testing.T) {
	// Captures what the transport would actually send.
	wire := func(opts map[string]any) (string, bool) {
		var seen any
		var had bool

		full := map[string]any{}
		for k, v := range opts {
			full[k] = v
		}
		full["utility"] = map[string]any{
			"fetcher": sdk.FetcherFunc(func(
				ctx *sdk.Context, fullurl string, fetchdef map[string]any,
			) (any, error) {
				if h, ok := fetchdef["headers"].(map[string]any); ok {
					seen, had = h["authorization"]
				}
				return map[string]any{
					"status": 200, "ok": true,
					"json": func() (any, error) { return map[string]any{}, nil },
				}, nil
			}),
		}

		client := sdk.NewDemoSDK(full)
		_, _ = client.Planet(nil).Create(map[string]any{"name": "p1"}, map[string]any{})

		str, _ := seen.(string)
		return str, had
	}

	// Baseline: an apikey with no suppression must still be sent, else the
	// test below would pass for the wrong reason.
	if got, had := wire(map[string]any{"apikey": "OPTKEY01"}); !had || got != "OPTKEY01" {
		t.Fatalf("baseline broken: an ordinary apikey was not sent (had=%v got=%q)", had, got)
	}

	// The suppression, against an explicit credential.
	if got, had := wire(map[string]any{"apikey": "OPTKEY01", "auth": nil}); had {
		t.Errorf("FAIL: auth nil did not suppress the credential - sent authorization %q", got)
	}

	// And the option survives validation rather than being replaced by the
	// optspec's default auth map.
	client := sdk.NewDemoSDK(map[string]any{"apikey": "OPTKEY01", "auth": nil})
	if av, ok := client.OptionsMap()["auth"]; !ok || av != nil {
		t.Errorf("FAIL: options.auth is %#v, not nil - validate replaced the suppression", av)
	}
}
`)

    const probe = run(go, ['test', './test/', '-run', 'TestAuthNullProbe', '-v'], sdkroot)
    ok(probe.ok, 'auth null did not suppress the credential:\n' + tail(probe.out))
  })


  // The same contract on the js reference target, which fails DIFFERENTLY.
  //
  // go's struct treats a stored null as "no value", so the optspec default
  // fired and the credential went out - a leak. js still ships struct 0.0.10,
  // whose validate REJECTS a stored null outright, so `auth: null` threw
  // "Expected field auth to be map" at construction. Same broken contract,
  // opposite failure mode, so both need pinning rather than one standing in
  // for the other.
  test('js: auth null suppresses the credential', async () => {
    const sdkroot = Path.join(tmp, 'js-authnull')
    await generateTo('js', sdkroot)
    linkDeps(sdkroot)

    Fs.mkdirSync(Path.join(sdkroot, 'test', 'utility'), { recursive: true })
    Fs.writeFileSync(
      Path.join(sdkroot, 'test', 'utility', 'authnull.test.js'),
      `const { test, describe } = require('node:test')
const assert = require('node:assert')

const { SDK } = require('../..')

// \`auth: null\` is the documented way to disable auth outright. It must beat
// an explicit apikey, because that is the only case that DISCRIMINATES: with
// no apikey nothing goes on the wire anyway.
//
// This target's struct rejects a stored null in validate, so before the fix
// the failure was not a leak but a CONSTRUCTION ERROR - the documented option
// threw "Expected field auth to be map, but found no value".
describe('auth null', () => {

  // What the transport would actually send.
  async function wire(opts) {
    let seen
    let had = false

    const sdk = SDK.test({}, {
      ...opts,
      utility: {
        fetcher: async (_ctx, _fullurl, fetchdef) => {
          had = Object.prototype.hasOwnProperty.call(
            fetchdef.headers || {}, 'authorization')
          seen = (fetchdef.headers || {}).authorization
          return { status: 200, ok: true, json: async () => ({}) }
        },
      },
    })

    const fetchdef = await sdk.prepare({ path: '/' })
    assert.ok(!(fetchdef instanceof Error), String(fetchdef))

    had = Object.prototype.hasOwnProperty.call(fetchdef.headers || {}, 'authorization')
    seen = (fetchdef.headers || {}).authorization
    return { seen, had }
  }

  // Baseline, so the assertion below cannot pass vacuously.
  test('an ordinary apikey is sent', async () => {
    const { seen } = await wire({ apikey: 'OPTKEY01' })
    assert.equal(seen, 'OPTKEY01')
  })

  test('auth null suppresses an explicit apikey', async () => {
    const { seen, had } = await wire({ apikey: 'OPTKEY01', auth: null })
    assert.equal(had, false,
      'auth null did not suppress the credential - sent authorization ' + seen)
  })

  test('constructing with auth null does not throw', async () => {
    // The pre-fix failure mode on this target: validate rejected the null.
    assert.doesNotThrow(() => SDK.test({}, { apikey: 'OPTKEY01', auth: null }))
  })

  test('options.auth survives validation as null', async () => {
    const sdk = SDK.test({}, { apikey: 'OPTKEY01', auth: null })
    assert.equal(sdk.options().auth, null,
      'validate replaced the suppression with the optspec default')
  })
})
`)

    const probe = run(process.execPath,
      ['--test', '--test-reporter=tap', Path.join('test', 'utility', 'authnull.test.js')],
      sdkroot, nestedTestEnv())

    ok(probe.ok, 'js auth null did not suppress the credential:\n' + tail(probe.out))
  })


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
// The features every corpus lane generates with. `test` and `log` are the
// fixture model's own defaults and stay; the rest are what the cases below
// compose.
const CORPUS_FEATURES = ['test', 'log', 'cost', 'netsim', 'retry', 'cache']


// The one line every runner prints, in every language, when a section runs:
// "feature.cost: ran 15 of 15 case(s) against 2 operation(s)". Reading it is
// how a lane tells a section that RAN from one that skipped - which each
// framework reports as a pass.
const RAN_LINE = /feature\.\w+: ran (\d+) of (\d+) case/


// Output that means the toolchain cannot run here, rather than the generated
// SDK being wrong: a missing test framework, an unresolvable dependency. That
// is an environment gap, so the lane skips - visibly, and not as a pass.
const UNUSABLE = [
  /No module named pytest/,
  /cannot load such file -- minitest/,
  /Could not resolve dependencies/,
  /Non-resolvable/,
  /Cannot access central/,
  /Could not find artifact/,
  /Could not transfer artifact/,
  /Network is unreachable/,
  /Connection (refused|timed out)/,
  /Read timed out/,
  /Can't locate Test\/More\.pm/,
]


// Long compiler output buried in an assertion message is unreadable; the end
// is where the error is.
function tail(out: string, lines = 40): string {
  const all = out.split(/\r?\n/)
  return all.length <= lines ? out : all.slice(-lines).join('\n')
}


// Where a project keeps the compiled corpus. Every runner resolves
// `.sdk/test/test.json` relative to its own directory, and with each SDK
// generated into `<tmp>/<target>` they all land here.
function writeCorpus(tmp: string) {
  const testdir = Path.join(tmp, '.sdk', 'test')
  Fs.mkdirSync(testdir, { recursive: true })
  Fs.writeFileSync(Path.join(testdir, 'test.json'),
    JSON.stringify(CORPUS_FIXTURE, null, 2))
}


// Run a module through a language's own interpreter, when the check is
// whether that language can load a library at all.
function probeOk(bin: string, args: string[]): boolean {
  return run(bin, args, process.cwd()).ok
}


type CorpusLane = {
  target: string,
  // The runner file the target must generate - asserted even when the
  // toolchain is absent, so a lane that cannot run still proves that much.
  runner: string,
  // What a machine needs for this lane, quoted back in the skip message.
  needs: string,
  // A build step, for targets that have one. Returns a message when the lane
  // cannot get as far as running, or null when it is ready.
  prepare?: (sdkroot: string) => string | null,
  // The command that runs JUST the corpus runner, or null when the toolchain
  // is not here.
  command: () => { bin: string, args: string[], env?: NodeJS.ProcessEnv } | null,
}


// Every target with a feature corpus runner, and how to run it.
//
// Each command runs the CORPUS RUNNER ALONE, not the target's whole suite: a
// generated SDK's entity tests need seed data a project supplies, and this is
// a question about the feature pipeline.
const CORPUS_LANES: CorpusLane[] = [
  {
    target: 'ts',
    runner: 'test/feature/Corpus.test.ts',
    needs: 'the local typescript (run `npm install`)',
    prepare: (sdkroot) => {
      linkDeps(sdkroot)
      const src = tsc(sdkroot, 'src')
      if (!src.ok) return 'generated src does not compile:\n' + tail(src.out)
      const suite = tsc(sdkroot, 'test')
      if (!suite.ok) {
        return 'the generated test suite does not compile:\n' + tail(suite.out)
      }
      // `node --test` on a path that does not exist is not an error, so make
      // sure the compiled runner is really there before reading its output.
      const compiled = Path.join(sdkroot, 'dist-test', 'feature', 'Corpus.test.js')
      return Fs.existsSync(compiled)
        ? null
        : 'the corpus runner did not compile to ' + compiled + ':\n' + tail(suite.out)
    },
    command: () => Fs.existsSync(TSC)
      ? {
        bin: process.execPath,
        args: ['--test', '--test-reporter=tap',
          Path.join('dist-test', 'feature', 'Corpus.test.js')],
        env: nestedTestEnv(),
      }
      : null,
  },
  {
    target: 'js',
    runner: 'test/feature/Corpus.test.js',
    needs: 'node',
    prepare: (sdkroot) => {
      linkDeps(sdkroot)
      return null
    },
    command: () => ({
      bin: process.execPath,
      args: ['--test', '--test-reporter=tap',
        Path.join('test', 'feature', 'Corpus.test.js')],
      env: nestedTestEnv(),
    }),
  },
  {
    target: 'go',
    runner: 'test/feature_corpus_test.go',
    needs: 'go',
    command: () => {
      const go = toolchain('go')
      return null == go
        ? null
        : { bin: go, args: ['test', './test/', '-run', 'TestFeatureCorpus', '-v'] }
    },
  },
  {
    target: 'py',
    runner: 'test/test_feature_corpus.py',
    needs: 'python3 with pytest',
    command: () => {
      const py = toolchain('python3') || toolchain('python')
      if (null == py) return null
      // pytest is a dev dependency, not part of python: a lane that assumed
      // it would fail on a machine that simply does not have it.
      if (!probeOk(py, ['-m', 'pytest', '--version'])) return null
      // `-s` so the runner's own count reaches this process; pytest captures
      // stdout by default and the line this lane reads would vanish.
      return { bin: py, args: ['-m', 'pytest', 'test/test_feature_corpus.py', '-q', '-s'] }
    },
  },
  {
    target: 'rb',
    runner: 'test/feature_corpus_test.rb',
    needs: 'ruby with minitest',
    command: () => {
      const rb = toolchain('ruby')
      if (null == rb) return null
      if (!probeOk(rb, ['-e', 'require "minitest/autorun"'])) return null
      return { bin: rb, args: ['test/feature_corpus_test.rb'] }
    },
  },
  {
    target: 'php',
    runner: 'test/FeatureCorpusTest.php',
    needs: 'php with phpunit (on PATH, or PHPUNIT=<path to phpunit.phar>)',
    command: () => {
      const php = toolchain('php')
      if (null == php) return null
      // A phar is a file, not something `which` finds, so honour an explicit
      // path as well as an installed binary.
      const phar = process.env.PHPUNIT
      if (null != phar && '' !== phar && Fs.existsSync(phar)) {
        return { bin: php, args: [phar, '--no-configuration', 'test/FeatureCorpusTest.php'] }
      }
      const phpunit = toolchain('phpunit')
      return null == phpunit
        ? null
        : { bin: phpunit, args: ['--no-configuration', 'test/FeatureCorpusTest.php'] }
    },
  },
  {
    target: 'perl',
    runner: 't/feature_corpus.t',
    needs: 'perl',
    command: () => {
      const perl = toolchain('perl')
      return null == perl ? null : { bin: perl, args: ['-Ilib', 't/feature_corpus.t'] }
    },
  },
  {
    target: 'java',
    runner: 'test/FeatureCorpusTest.java',
    needs: 'java and maven',
    command: () => {
      const mvn = toolchain('mvn')
      if (null == mvn || null == toolchain('java')) return null
      return {
        bin: mvn,
        args: ['-q', '-B', 'test', '-Dtest=FeatureCorpusTest',
          '-DfailIfNoSpecifiedTests=false'],
      }
    },
  },
]



// Recursive file list by extension, for the lanes that must hand a compiler
// every source file (java has no in-tree build that avoids the network).
function listFiles(root: string, ext: string): string[] {
  const out: string[] = []
  for (const entry of Fs.readdirSync(root, { withFileTypes: true })) {
    const full = Path.join(root, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(full, ext))
    else if (entry.name.endsWith(ext)) out.push(full)
  }
  return out
}


// The auth-null rollout: `auth: null` - the documented way to disable auth
// outright - must beat an explicit apikey on EVERY target.
//
// A lane per target, driven by a table so a target is a row. Each probe opens
// with a baseline assertion (an ordinary apikey IS sent, or DOES yield an auth
// block) because the suppression on its own cannot fail visibly: with no
// apikey nothing goes on the wire either way, so a probe without the baseline
// would pass with the defect live.
//
// COVERAGE IS NOT COMPLETE, and AUTHNULL_UNCOVERED below says so in code
// rather than in a comment nobody re-reads: csharp, dart, kotlin and swift
// carry the fix but have no lane. The reason is not that they do not deserve
// one - it is that a lane which has never been executed even once is a
// liability. It fails on someone else's machine, in a language whose build
// invocation was guessed at, and reads as a regression in the fix rather than
// a broken probe. Adding those four is real work for whoever has dotnet,
// dart, kotlin or swift to hand; the test below makes sure the gap cannot
// widen in silence while they wait.
//
// The failure being pinned differs by target, which is why one lane cannot
// stand in for another. Where the target's struct treats a stored null as
// "no value" (py, rb, perl, rust, java, c, and go) the optspec default fires
// and the credential is TRANSMITTED. Where it rejects one (php, and js)
// construction THROWS. Both are the same broken contract.
//
// No corpus entry can cover this for any port: corpus nulls travel as the
// '__NULL__' STRING, so real-JSON-null semantics are invisible to the shared
// fixtures. It has to be target-level, here.
const AUTHNULL_LANES: {
  target: string,
  needs: string,
  probe: string,
  source: string,
  // `phase` separates a BUILD failure from a PROBE failure. Without it a
  // toolchain that cannot compile the generated SDK at all is reported as an
  // auth-null regression, which sends the reader hunting in the wrong file.
  exec: (sdkroot: string) => { ok: boolean, out: string, phase?: string } | null,
}[] = [
  {
    target: 'py',
    needs: 'python3',
    probe: 'authnull_probe.py',
    source: `# \`auth: None\` must suppress an explicit apikey.
#
# Only that pairing DISCRIMINATES: with no apikey nothing goes on the wire
# either way, so the obvious "auth None alone" check passes with the defect
# live. The baseline below fails loudly if an ordinary apikey stops being
# sent, so this cannot pass vacuously.
import sys

sys.path.insert(0, ".")
from demo_sdk import DemoSDK

def wire(opts):
    # \`called\` matters as much as \`had\`. If the suppressed path fails before
    # the transport runs, \`had\` stays False - indistinguishable from a
    # successful suppression - and the lane would pass on a broken SDK. The
    # baseline cannot catch that, since it exercises different options.
    seen = {"called": False, "had": False, "val": None}

    def fetcher(ctx, fullurl, fetchdef):
        seen["called"] = True
        h = fetchdef.get("headers") or {}
        seen["had"] = "authorization" in h
        seen["val"] = h.get("authorization")
        return {"status": 200, "ok": True, "json": lambda: {}}

    full = dict(opts)
    full["utility"] = {"fetcher": fetcher}
    sdk = DemoSDK(full)
    try:
        sdk.Planet().create({"name": "p1"})
    except Exception:
        pass
    return seen

fail = []

base = wire({"apikey": "OPTKEY01"})
if not base["had"] or "OPTKEY01" != base["val"]:
    fail.append("baseline broken: an ordinary apikey was not sent: %r" % (base,))

supp = wire({"apikey": "OPTKEY01", "auth": None})
if not supp["called"]:
    fail.append("the request never reached the transport, so nothing was proved "
                "about suppression - the suppressed path failed earlier")
if supp["had"]:
    fail.append("auth None did not suppress the credential - sent %r" % (supp["val"],))

sdk = DemoSDK({"apikey": "OPTKEY01", "auth": None})
if sdk.options.get("auth", "MISSING") is not None:
    fail.append("options.auth is %r, not None - validate replaced the suppression"
                % (sdk.options.get("auth", "MISSING"),))

for f in fail:
    print("FAIL:", f)
print("auth-null probe:", "FAILED" if fail else "ok")
sys.exit(1 if fail else 0)
`,
    exec: (sdkroot) => {
      const py = toolchain('python3')
      if (null == py) return null
      return run(py, ['authnull_probe.py'], sdkroot)
    },
  },
  {
    target: 'rb',
    needs: 'ruby',
    probe: 'authnull_probe.rb',
    source: `# \`auth: nil\` must suppress an explicit apikey. See authnull.py for why that
# pairing is the only discriminating case; the baseline guards vacuity.
require_relative "Demo_sdk"

def wire(opts)
  # \`called\` matters as much as \`had\` - see authnull.py.
  seen = { called: false, had: false, val: nil }
  fetcher = lambda do |_ctx, _fullurl, fetchdef|
    seen[:called] = true
    h = fetchdef["headers"] || {}
    seen[:had] = h.key?("authorization")
    seen[:val] = h["authorization"]
    { "status" => 200, "ok" => true, "json" => lambda { {} } }
  end
  sdk = DemoSDK.new(opts.merge("utility" => { "fetcher" => fetcher }))
  begin
    sdk.Planet.create({ "name" => "p1" })
  rescue StandardError
    nil
  end
  seen
end

fail_msgs = []

base = wire({ "apikey" => "OPTKEY01" })
unless base[:had] && "OPTKEY01" == base[:val]
  fail_msgs << "baseline broken: an ordinary apikey was not sent: #{base.inspect}"
end

supp = wire({ "apikey" => "OPTKEY01", "auth" => nil })
unless supp[:called]
  fail_msgs << "the request never reached the transport, so nothing was proved about suppression"
end
if supp[:had]
  fail_msgs << "auth nil did not suppress the credential - sent #{supp[:val].inspect}"
end

sdk = DemoSDK.new({ "apikey" => "OPTKEY01", "auth" => nil })
om = sdk.options_map
unless om.key?("auth") && om["auth"].nil?
  fail_msgs << "options.auth is #{om['auth'].inspect}, not nil - validate replaced the suppression"
end

fail_msgs.each { |m| puts "FAIL: #{m}" }
puts "auth-null probe: #{fail_msgs.empty? ? 'ok' : 'FAILED'}"
exit(fail_msgs.empty? ? 0 : 1)
`,
    exec: (sdkroot) => {
      const rb = toolchain('ruby')
      if (null == rb) return null
      return run(rb, ['authnull_probe.rb'], sdkroot)
    },
  },
  {
    target: 'perl',
    needs: 'perl',
    probe: 'authnull_probe.pl',
    source: `# \`auth => undef\` must suppress an explicit apikey. See authnull.py for why
# that pairing is the only discriminating case; the baseline guards vacuity.
use strict;
use warnings;
use lib "lib";
use DemoSDK;

sub wire {
  my ($opts) = @_;
  # \`called\` matters as much as \`had\` - see authnull.py.
  my %seen = (called => 0, had => 0, val => undef);
  my %full = (%$opts, utility => { fetcher => sub {
    my (undef, undef, $fetchdef) = @_;
    $seen{called} = 1;
    my $h = $fetchdef->{headers} || {};
    $seen{had} = exists $h->{authorization} ? 1 : 0;
    $seen{val} = $h->{authorization};
    return { status => 200, ok => 1, json => sub { {} } };
  } });
  my $sdk = DemoSDK->new(\\%full);
  eval { $sdk->Planet->create({ name => 'p1' }); 1 };
  return \\%seen;
}

my @fail;

my $base = wire({ apikey => 'OPTKEY01' });
push @fail, "baseline broken: an ordinary apikey was not sent"
  unless $base->{had} && defined $base->{val} && 'OPTKEY01' eq $base->{val};

my $supp = wire({ apikey => 'OPTKEY01', auth => undef });
push @fail, "the request never reached the transport, so nothing was proved about suppression"
  unless $supp->{called};
push @fail, "auth undef did not suppress the credential - sent "
  . (defined $supp->{val} ? $supp->{val} : 'undef')
  if $supp->{had};

my $sdk = DemoSDK->new({ apikey => 'OPTKEY01', auth => undef });
my $om = $sdk->options_map;
push @fail, "options.auth is defined - validate replaced the suppression"
  unless exists $om->{auth} && !defined $om->{auth};

print "FAIL: $_\\n" for @fail;
print "auth-null probe: " . (@fail ? "FAILED" : "ok") . "\\n";
exit(@fail ? 1 : 0);
`,
    exec: (sdkroot) => {
      const pl = toolchain('perl')
      if (null == pl) return null
      return run(pl, ['authnull_probe.pl'], sdkroot)
    },
  },
  {
    target: 'php',
    needs: 'php',
    probe: 'authnull_probe.php',
    source: `<?php
// \`auth: null\` must suppress an explicit apikey. See authnull.py for why that
// pairing is the only discriminating case; the baseline guards vacuity.
//
// On this target the pre-fix failure was not a leak but a CONSTRUCTION ERROR:
// its struct rejects a stored null in validate.
require_once __DIR__ . '/demo_sdk.php';

function wire(array $opts): array {
  // \`called\` matters as much as \`had\` - see authnull.py.
  $seen = ['called' => false, 'had' => false, 'val' => null];
  $opts['utility'] = ['fetcher' => function ($ctx, $fullurl, $fetchdef) use (&$seen) {
    $seen['called'] = true;
    $h = $fetchdef['headers'] ?? [];
    $seen['had'] = array_key_exists('authorization', $h);
    $seen['val'] = $h['authorization'] ?? null;
    return ['status' => 200, 'ok' => true, 'json' => function () { return []; }];
  }];
  $sdk = new DemoSDK($opts);
  try { $sdk->Planet()->create(['name' => 'p1']); } catch (\\Throwable $e) { }
  return $seen;
}

$fail = [];

$base = wire(['apikey' => 'OPTKEY01']);
if (!$base['had'] || 'OPTKEY01' !== $base['val']) {
  $fail[] = 'baseline broken: an ordinary apikey was not sent';
}

$supp = wire(['apikey' => 'OPTKEY01', 'auth' => null]);
if (!$supp['called']) {
  $fail[] = 'the request never reached the transport, so nothing was proved about suppression';
}
if ($supp['had']) {
  $fail[] = 'auth null did not suppress the credential - sent ' . var_export($supp['val'], true);
}

$sdk = new DemoSDK(['apikey' => 'OPTKEY01', 'auth' => null]);
$om = $sdk->options_map();
if (!array_key_exists('auth', $om) || null !== $om['auth']) {
  $fail[] = 'options.auth is ' . var_export($om['auth'] ?? 'MISSING', true)
    . ', not null - validate replaced the suppression';
}

foreach ($fail as $f) { echo "FAIL: $f\\n"; }
echo 'auth-null probe: ' . (empty($fail) ? 'ok' : 'FAILED') . "\\n";
exit(empty($fail) ? 0 : 1);
`,
    exec: (sdkroot) => {
      const ph = toolchain('php')
      if (null == ph) return null
      return run(ph, ['authnull_probe.php'], sdkroot)
    },
  },
  {
    target: 'java',
    needs: 'javac and java',
    probe: 'AuthNullProbe.java',
    source: `// \`auth: null\` must suppress an explicit apikey ON THE WIRE.
//
// This asserts on the authorization header a mocked transport receives, not on
// the options map. An options-level assertion is not enough: lean's prepareAuth
// never reads options.auth at all, so a port of that shape passes an options
// check while still transmitting the credential.
//
// The baseline fails loudly if an ordinary apikey stops being sent, because the
// suppression alone cannot fail visibly - with no apikey nothing goes on the
// wire either way.
import java.util.*;

import voxgig.demosdk.core.DemoSDK;
import voxgig.demosdk.core.Utility;

public class AuthNullProbe {

  static String seen;
  static boolean had;
  // \`called\` matters as much as \`had\`. If the suppressed path fails before the
  // transport runs, \`had\` stays false - indistinguishable from a successful
  // suppression - and this would pass on a broken SDK. The baseline cannot
  // catch that, since it exercises different options.
  static boolean called;

  @SuppressWarnings("unchecked")
  static void wire(Map<String, Object> opts) {
    seen = null;
    had = false;
    called = false;

    Map<String, Object> full = new LinkedHashMap<>(opts);
    Utility.FetcherFn mock = (ctx, fullurl, fetchdef) -> {
      called = true;
      Object h = fetchdef.get("headers");
      if (h instanceof Map) {
        had = ((Map<String, Object>) h).containsKey("authorization");
        Object v = ((Map<String, Object>) h).get("authorization");
        seen = null == v ? null : String.valueOf(v);
      }
      Map<String, Object> res = new LinkedHashMap<>();
      res.put("status", 200);
      res.put("ok", true);
      res.put("json", (java.util.function.Supplier<Object>) LinkedHashMap::new);
      return res;
    };
    Map<String, Object> util = new LinkedHashMap<>();
    util.put("fetcher", mock);
    full.put("utility", util);

    DemoSDK sdk = new DemoSDK(full);
    try {
      sdk.planet(null).create(new LinkedHashMap<>(Map.of("name", "p1")), null);
    }
    catch (Throwable ignored) { }
  }

  public static void main(String[] args) {
    List<String> fail = new ArrayList<>();

    wire(new LinkedHashMap<>(Map.of("apikey", "OPTKEY01")));
    if (!had || !"OPTKEY01".equals(seen)) {
      fail.add("baseline broken: an ordinary apikey was not sent (had=" + had
        + " value=" + seen + ")");
    }

    Map<String, Object> supp = new LinkedHashMap<>();
    supp.put("apikey", "OPTKEY01");
    supp.put("auth", null);
    wire(supp);
    if (!called) {
      fail.add("the request never reached the transport, so nothing was proved "
        + "about suppression - the suppressed path failed earlier");
    }
    if (had) {
      fail.add("auth null did not suppress the credential - sent " + seen);
    }

    for (String f : fail) { System.out.println("FAIL: " + f); }
    System.out.println("auth-null probe: " + (fail.isEmpty() ? "ok" : "FAILED"));
    System.exit(fail.isEmpty() ? 0 : 1);
  }
}
`,
    exec: (sdkroot) => {
      const javac = toolchain('javac')
      const java = toolchain('java')
      if (null == javac || null == java) return null

      // Compiled straight with javac rather than through mvn: the probe needs
      // no test framework, and a maven run would hit the network on a cold
      // runner.
      const classes = Path.join(sdkroot, 'zz-classes')
      Fs.mkdirSync(classes, { recursive: true })

      const sources = listFiles(sdkroot, '.java')
        .filter((f) => !f.split(Path.sep).includes('test'))
      const built = run(javac, ['-d', classes, ...sources], sdkroot)
      if (!built.ok) return { ...built, phase: 'build' }

      return run(java, ['-cp', classes, 'AuthNullProbe'], sdkroot)
    },
  },
  {
    target: 'c',
    needs: 'make and a C compiler',
    probe: 'tests/authnull_probe.c',
    source: `/* \`auth: null\` must suppress an explicit apikey IN THE HEADER prepareAuth
 * writes - not merely in the options map.
 *
 * An options-level assertion is not enough: lean's prepareAuth never reads
 * options.auth at all, so a port of that shape passes an options check while
 * still transmitting the credential. This drives the real makeOptions (through
 * the client constructor) and then the real prepare_auth, and asserts on what
 * lands in spec->headers - which is what makeRequest sends.
 *
 * The baseline fails loudly if an ordinary apikey stops being sent, because
 * the suppression alone cannot fail visibly: with no apikey nothing goes on
 * the wire either way. */
#include "sdk.h"

#include <stdbool.h>
#include <stdio.h>
#include <string.h>

static int fails = 0;

static void fail(const char* msg, const char* got) {
  printf("FAIL: %s%s%s\\n", msg, got ? " - sent " : "", got ? got : "");
  fails++;
}

/* Build a client from opts, run the real prepare_auth, and report whether the
 * authorization header is present plus what it holds.
 *
 * *ok is set false when prepare_auth ERRORED. That matters as much as the
 * header: a suppressed path that fails before writing anything leaves no
 * header, which is indistinguishable from a successful suppression, and this
 * would pass on a broken SDK. The baseline cannot catch it, since it
 * exercises different options. */
static const char* authheader(voxgig_value* sdkopts, bool* ok, bool* present) {
  DemoSDK* client = test_sdk(v_undef(), sdkopts);
  Utility* utility = sdk_get_utility(client);

  CtxSpec cs;
  memset(&cs, 0, sizeof(cs));
  cs.opname = "load";
  cs.client = client;
  cs.utility = utility;
  Context* ctx = make_context_util(cs, sdk_get_root_ctx(client));

  ctx->spec = spec_new(cmap(2, "headers", v_map(), "step", v_str("s")));

  PNError* err = NULL;
  prepare_auth_util(ctx, &err);
  if (ok) *ok = (NULL == err);

  /* Presence separately from value: a present-but-EMPTY header is not
   * suppression, and get_str alone cannot tell the two apart. */
  if (present) {
    *present = voxgig_is_map(ctx->spec->headers)
      && NULL != voxgig_map_get(voxgig_as_map(ctx->spec->headers), "authorization");
  }

  return get_str(ctx->spec->headers, "authorization");
}

int main(void) {
  voxgig_value* plain = cmap(1, "apikey", v_str("OPTKEY01"));
  bool baseok = false;
  bool basepresent = false;
  const char* base = authheader(plain, &baseok, &basepresent);
  if (!baseok) {
    fail("baseline broken: prepare_auth errored", NULL);
  }
  if (!basepresent || NULL == base || 0 != strcmp(base, "OPTKEY01")) {
    fail("baseline broken: an ordinary apikey was not sent", base);
  }

  voxgig_value* supp = cmap(2, "apikey", v_str("OPTKEY01"), "auth", voxgig_new_null());
  bool suppok = false;
  bool supppresent = false;
  const char* got = authheader(supp, &suppok, &supppresent);
  if (!suppok) {
    fail("prepare_auth errored on the suppressed path, so nothing was proved", NULL);
  }
  if (supppresent) {
    fail("auth null did not suppress the credential - header still present", got);
  }

  printf("auth-null probe: %s\\n", 0 == fails ? "ok" : "FAILED");
  return 0 == fails ? 0 : 1;
}
`,
    exec: (sdkroot) => {
      const make = toolchain('make')

      // The compiler is probed as well as make, because the generated Makefile
      // takes CC from the environment and otherwise uses make's own `cc`: an
      // image carrying make without a working compiler would fail INSIDE the
      // build and be read as an auth-null regression rather than the visible
      // skip it should be.
      //
      // A configured CC that does not resolve is a SKIP, not a silent
      // substitution - running the lane against some other compiler would not
      // be testing what the operator asked for. Only when CC is unset does
      // this fall back, and then it passes the resolved path to make
      // explicitly, so make cannot pick a different one than was probed.
      const configured = process.env.CC
      const cc = null == configured || '' === configured
        ? (toolchain('cc') || toolchain('gcc'))
        : toolchain(configured)
      if (null == make || null == cc) return null

      const built = run(make, ['CC=' + cc, 'tests/authnull_probe.out'], sdkroot)
      if (!built.ok) return { ...built, phase: 'build' }
      return run(Path.join(sdkroot, 'tests', 'authnull_probe.out'), [], sdkroot)
    },
  },
  {
    target: 'cpp',
    needs: 'make and a C++ compiler',
    probe: 'test/authnull_probe.cpp',
    source: `// \`auth: null\` must suppress an explicit apikey IN THE HEADER prepareAuth
// writes - not merely in the options map.
//
// An options-level assertion is not enough: lean's prepareAuth never reads
// options.auth at all, so a port of that shape passes an options check while
// still transmitting the credential. This drives the real makeOptions (through
// the client constructor) and then the real prepareAuth, and asserts on what
// lands in spec->headers - which is what makeRequest sends.
//
// The baseline fails loudly if an ordinary apikey stops being sent, because
// the suppression alone cannot fail visibly: with no apikey nothing goes on
// the wire either way.
#include "runner_support.hpp"

#include <cstdio>
#include <string>

using namespace sdk;

static int fails = 0;

static void fail(const char* msg, const std::string& got) {
  std::printf("FAIL: %s%s%s\\n", msg, got.empty() ? "" : " - sent ", got.c_str());
  fails++;
}

// Build a client from opts, run the real prepareAuth, and report BOTH whether
// the authorization header is present and what it holds. Presence is returned
// separately because a present-but-EMPTY header is not suppression - returning
// only the string would make "" mean both "absent" and "sent empty", and the
// second would read as a pass.
struct AuthResult {
  bool present = false;
  std::string value;
  // Set false when prepareAuth returned nothing, i.e. it failed. That matters
  // as much as the header: a suppressed path that fails before writing leaves
  // no header, which is indistinguishable from a successful suppression, and
  // this would pass on a broken SDK. The baseline cannot catch it, since it
  // exercises different options.
  bool ok = false;
};

static AuthResult authheader(const Value& sdkopts) {
  auto client = std::make_shared<DemoSDK>(sdkopts);
  auto utility = client->getUtility();

  Value ctxmap = vmap();
  map_put(ctxmap, "opname", Value(std::string("load")));
  map_put(ctxmap, "spec", vmap());

  CtxPtr ctx = rs::make_ctx_from_map(ctxmap, client, utility);
  Value specmap = vmap();
  map_put(specmap, "headers", vmap());
  map_put(specmap, "step", Value(std::string("s")));
  ctx->spec = std::make_shared<Spec>(specmap);

  SpecPtr got = utility->prepareAuth(ctx);

  Value h = ctx->spec->headers;
  AuthResult out;
  out.ok = (nullptr != got);
  out.present = map_contains(h, "authorization");
  if (out.present) {
    Value a = mapget(h, "authorization");
    out.value = a.is_string() ? a.as_string() : std::string();
  }
  return out;
}

int main() {
  Value plain = vmap();
  map_put(plain, "apikey", Value(std::string("OPTKEY01")));
  AuthResult base = authheader(plain);
  if (!base.ok) {
    fail("baseline broken: prepareAuth failed", "");
  }
  if (!base.present || "OPTKEY01" != base.value) {
    fail("baseline broken: an ordinary apikey was not sent", base.value);
  }

  Value supp = vmap();
  map_put(supp, "apikey", Value(std::string("OPTKEY01")));
  map_put(supp, "auth", Value(nullptr));
  AuthResult got = authheader(supp);
  if (!got.ok) {
    fail("prepareAuth failed on the suppressed path, so nothing was proved", "");
  }
  if (got.present) {
    fail("auth null did not suppress the credential - header still present", got.value);
  }

  std::printf("auth-null probe: %s\\n", 0 == fails ? "ok" : "FAILED");
  return 0 == fails ? 0 : 1;
}
`,
    exec: (sdkroot) => {
      const make = toolchain('make')

      // Same reasoning as the c lane: a configured CXX that does not resolve
      // is a SKIP rather than a silent substitution, and the resolved path is
      // passed to make so it cannot pick a different compiler than was probed.
      const configured = process.env.CXX
      const cxx = null == configured || '' === configured
        ? (toolchain('g++') || toolchain('c++') || toolchain('clang++'))
        : toolchain(configured)
      if (null == make || null == cxx) return null

      const built = run(make, ['CXX=' + cxx, 'test/authnull_probe.out'], sdkroot)
      if (!built.ok) return { ...built, phase: 'build' }
      return run(Path.join(sdkroot, 'test', 'authnull_probe.out'), [], sdkroot)
    },
  },
  {
    target: 'rust',
    needs: 'cargo',
    probe: 'tests/authnull_probe.rs',
    source: `#![allow(unused_imports)]
use std::cell::RefCell;
use std::rc::Rc;

use demo_sdk::core::helpers::{getp, ja, jo, json_thunk, to_map};
use demo_sdk::utility::voxgigstruct as vs;
use demo_sdk::{DemoEntity, DemoSDK, Value};

// Returns (header present, header value, transport was reached).
//
// The third matters as much as the first: if the suppressed path fails before
// the transport runs, "no header" is indistinguishable from a successful
// suppression, and this would pass on a broken SDK. The baseline cannot catch
// that, since it exercises different options.
fn wire(opts: Vec<(&str, Value)>) -> (bool, Value, bool) {
    let seen: Rc<RefCell<Value>> = Rc::new(RefCell::new(Value::Noval));
    let called: Rc<RefCell<bool>> = Rc::new(RefCell::new(false));
    let s = seen.clone();
    let c = called.clone();
    let mock = Value::func(move |_inj, args, _r, _st| {
        *c.borrow_mut() = true;
        let init = vs::get_elem(args, &Value::Num(1.0), Value::Noval);
        *s.borrow_mut() = getp(&init, "headers");
        jo(vec![
            ("status", Value::Num(200.0)),
            ("statusText", Value::str("OK")),
            ("headers", Value::empty_map()),
            ("json", json_thunk(jo(vec![("id", Value::str("p1"))]))),
        ])
    });

    let mut all = opts;
    all.push(("base", Value::str("http://localhost:8080")));
    all.push(("system", jo(vec![("fetch", mock)])));
    let client = DemoSDK::new(jo(all));
    let _ = client.planet(Value::Noval).create(jo(vec![("name", Value::str("p1"))]), Value::Noval);

    let h = seen.borrow().clone();
    let auth = match &h {
        Value::Map(m) => m.borrow().get("authorization").cloned(),
        _ => None,
    };
    let was_called = *called.borrow();
    (auth.is_some(), auth.unwrap_or(Value::Noval), was_called)
}

#[test]
fn authnull_probe() {
    // Baseline: an ordinary apikey must be sent, else this proves nothing.
    let (had, val, called) = wire(vec![("apikey", Value::str("OPTKEY01"))]);
    assert!(called, "baseline broken: the request never reached the transport");
    assert!(had, "baseline broken: an ordinary apikey was not sent");
    assert_eq!(val, Value::str("OPTKEY01"));

    // The suppression, against an explicit credential.
    let (had2, val2, called2) = wire(vec![
        ("apikey", Value::str("OPTKEY01")),
        ("auth", Value::Null),
    ]);
    assert!(called2,
        "the request never reached the transport, so nothing was proved about \\
         suppression - the suppressed path failed earlier");
    assert!(!had2, "auth null did not suppress the credential - sent {:?}", val2);

    // And it survives validation rather than becoming the optspec default.
    let client = DemoSDK::new(jo(vec![
        ("apikey", Value::str("OPTKEY01")),
        ("auth", Value::Null),
    ]));
    let om = client.options_map();
    let a = match &om {
        Value::Map(m) => m.borrow().get("auth").cloned(),
        _ => None,
    };
    assert_eq!(a, Some(Value::Null), "options.auth is {:?}, not Null", a);
}
`,
    exec: (sdkroot) => {
      const cargo = toolchain('cargo')
      if (null == cargo) return null
      return run(cargo, ['test', '--test', 'authnull_probe'], sdkroot)
    },
  },
]


// Every target is classified below, and the suite further down holds each
// classification against what the templates actually contain.
//
// This exists because the FIRST audit behind this rollout was keyed on files
// named like `makeOptions`, which silently skipped thirteen of the twenty-six
// targets - cpp keeps this logic in `utility/pipeline.hpp`, lean in
// `SdkUtility.lean`, and so on. That produced a confident and wrong claim
// that the rollout was complete. Nothing here reads a filename.

// Fixed, and covered by a row in AUTHNULL_LANES above.
// (derived, not declared - see the suite below)

// Fixed, but covered by their own dedicated lanes earlier in this file:
// `go: auth null suppresses the credential` and the js equivalent, both
// written before the table existed. Folding them in would mean rewriting two
// lanes that already work.
const AUTHNULL_STANDALONE = ['go', 'js']


// Fixed, but with no behavioural lane here, each with the reason.
const AUTHNULL_UNCOVERED: Record<string, string> = {
  ts: 'pinned instead by the shipped tm/ts/test/feature/secrets/Secrets.test.ts ' +
    '("auth null suppresses the credential, chain or no chain"), which runs in ' +
    'a generated SDK rather than in sdkgen CI',
  csharp: 'needs dotnet; the probe has never been executed, so it is not shipped',
  dart: 'needs dart; the probe has never been executed, so it is not shipped',
  kotlin: 'needs gradle; the probe has never been executed, so it is not shipped',
  swift: 'needs swift; a probe needs a Package.swift target, and none is written',
}


// NOT FIXED YET. These carry the defect: with an explicit apikey AND
// `auth: null`, the credential still goes out. They are listed rather than
// quietly omitted, and the suite below fails if one of them ever gains the
// fix without moving out of this list.
const AUTHNULL_OUTSTANDING: Record<string, string> = {
  clojure: 'merges and validates without capturing suppliedness',
  elixir: 'merges and validates without capturing suppliedness',
  ocaml: 'merges and validates without capturing suppliedness',
  scala: 'merges and validates without capturing suppliedness',
  zig: 'merges and validates without capturing suppliedness',
  lean: 'TWO defects: makeOptions does not capture suppliedness, AND ' +
    'prepareAuth never reads options.auth at all - it branches only on an ' +
    'empty apikey, so a null auth has no effect even if it survives',
}


// Cannot express the suppression at all. A Lua table stores no nil -
// `t.auth = nil` removes the key - and the port has no null sentinel, so
// `auth = nil` and an omitted auth are the same value. There is nothing for
// makeOptions to detect and nothing to pin.
const AUTHNULL_INEXPRESSIBLE = ['lua']


// No auth optspec at all: wrappers and variants that do not build client
// options of their own.
const AUTHNULL_NOT_APPLICABLE = ['go-cli', 'go-mcp', 'py-data', 'seneca-provider']


// The lists above are only worth having if something holds them to the
// templates. This scans EVERY file of every target for the suppression
// marker - never a filename - and requires each target's real state to match
// the list it is declared in.
describe('auth null coverage is honest', () => {

  // The marker every implementation uses for the captured flag, in each
  // language's casing.
  const MARKER = /authsuppressed|auth_suppressed/i

  const TM = Path.resolve(PKG, 'project', '.sdk', 'tm')

  function allTargets(): string[] {
    return Fs.readdirSync(TM)
      .filter((n) => Fs.statSync(Path.join(TM, n)).isDirectory())
      .sort()
  }

  // Whole-tree scan. cpp keeps this logic in utility/pipeline.hpp and lean in
  // SdkUtility.lean, so anything narrower than "every file" reintroduces the
  // blind spot that made the first audit wrong.
  //
  // The marker must appear on BOTH SIDES of the validate call, not merely
  // somewhere in the file. The fix is capture-before / restore-after, and
  // presence of the identifier alone would accept a file that captures
  // suppliedness and never restores it - or one where the only surviving
  // mention is a comment. That shape passes an identifier check while leaking
  // the credential, which is exactly what this list exists to prevent for the
  // targets that have no lane.
  function carriesFix(target: string): boolean {
    return listFiles(Path.join(TM, target), '')
      .some((f) => {
        let src = ''
        try {
          src = Fs.readFileSync(f, 'utf8')
        }
        catch (_e) {
          return false
        }

        // Every validate CALL site, not the first mention of the word: the
        // files open with comments like "so merge/validate/init are
        // unchanged", which sit before the capture and would make an
        // otherwise-correct file look wrong. It is enough that SOME call has
        // the marker on both sides.
        const calls = [...src.matchAll(/\bvalidate\s*\(/gi)].map((m) => m.index ?? -1)
        return calls.some((at) => 0 <= at
          && MARKER.test(src.slice(0, at))
          && MARKER.test(src.slice(at)))
      })
  }

  const declaredFixed = () => [
    ...AUTHNULL_LANES.map((l) => l.target),
    ...AUTHNULL_STANDALONE,
    ...Object.keys(AUTHNULL_UNCOVERED),
  ]

  const declaredUnfixed = () => [
    ...Object.keys(AUTHNULL_OUTSTANDING),
    ...AUTHNULL_INEXPRESSIBLE,
    ...AUTHNULL_NOT_APPLICABLE,
  ]


  // A new target must be classified. Without this the lists drift out of date
  // silently, which is how the first audit came to miss half the tree.
  test('every target is classified', () => {
    const known = new Set([...declaredFixed(), ...declaredUnfixed()])
    const unclassified = allTargets().filter((t) => !known.has(t))

    deepStrictEqual(unclassified, [],
      'these targets appear in tm/ but in none of the auth-null lists - ' +
      'classify each as covered, uncovered, outstanding, inexpressible or ' +
      'not-applicable, and do not let a new target inherit the gap unnoticed')
  })


  // Without this, deleting the fix from an unexecuted target (csharp, dart,
  // kotlin, swift) simply drops it from the scan and every other check still
  // passes - the excuse then describes a fix that is no longer there.
  test('every target declared fixed actually carries the fix', () => {
    const lying = declaredFixed().filter((t) => !carriesFix(t))

    deepStrictEqual(lying, [],
      'these targets are listed as carrying the auth-null suppression but no ' +
      'longer do - the fix was removed, or the marker renamed; either way the ' +
      'list is now describing something that is not in the templates')
  })


  // And the other direction: a target that GAINS the fix must move out of the
  // outstanding list, or its entry becomes a lie in the opposite sense.
  test('nothing declared unfixed has quietly gained the fix', () => {
    const moved = declaredUnfixed().filter((t) => carriesFix(t))

    deepStrictEqual(moved, [],
      'these targets carry the auth-null suppression but are still listed as ' +
      'outstanding, inexpressible or not-applicable - move them to a lane or ' +
      'to AUTHNULL_UNCOVERED')
  })


  test('nothing is excused that already has a lane', () => {
    const covered = new Set([
      ...AUTHNULL_LANES.map((l) => l.target),
      ...AUTHNULL_STANDALONE,
    ])
    const stale = Object.keys(AUTHNULL_UNCOVERED).filter((t) => covered.has(t))

    deepStrictEqual(stale, [],
      'these targets have a lane AND an AUTHNULL_UNCOVERED entry - drop the ' +
      'entry, the gap it describes is closed')
  })


  test('no target is declared both fixed and unfixed', () => {
    const unfixed = new Set(declaredUnfixed())
    const both = declaredFixed().filter((t) => unfixed.has(t))

    deepStrictEqual(both, [], 'these targets are declared both fixed and unfixed')
  })
})


describe('auth null suppresses the credential', () => {

  let tmp = ''

  before(() => {
    tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-authnull-'))
  })

  after(() => {
    if ('' !== tmp) Fs.rmSync(tmp, { recursive: true, force: true })
  })

  for (const lane of AUTHNULL_LANES) {

    test(lane.target + ': auth null beats an explicit apikey', async (t) => {
      const sdkroot = Path.join(tmp, lane.target)
      await generateTo(lane.target, sdkroot)

      const probe = Path.join(sdkroot, ...lane.probe.split('/'))
      Fs.mkdirSync(Path.dirname(probe), { recursive: true })
      Fs.writeFileSync(probe, lane.source)

      // Probed AFTER generating, so a machine without the toolchain still
      // proves the SDK generates - the half of this check that needs no
      // interpreter or compiler.
      const ran = lane.exec(sdkroot)
      if (null == ran) {
        return t.skip('no usable ' + lane.target + ' toolchain here (' +
          lane.needs + ')')
      }

      ok(ran.ok, lane.target + ': ' + ('build' === ran.phase
        ? 'the generated SDK did not build, so the probe never ran'
        : 'auth null did not suppress the credential') + ':\n' + tail(ran.out))
    })
  }
})


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


  // One lane per target that ships a feature corpus runner, driven by the
  // same table so a new target is a row rather than a new test.
  for (const lane of CORPUS_LANES) {

    test(lane.target + ': cost cases execute against the generated client',
      async (t) => {
        const sdkroot = Path.join(tmp, lane.target)
        const files = await generateTo(
          lane.target, sdkroot, undefined, CORPUS_FEATURES)

        ok(null != files[lane.runner],
          'the corpus runner was not generated into the SDK: expected ' +
          lane.runner + ' among ' + Object.keys(files).length + ' files')

        writeCorpus(tmp)

        // Probed AFTER generating, so a machine without the toolchain still
        // proves the runner is emitted - the half of this check that needs
        // no compiler.
        const cmd = lane.command()
        if (null == cmd) {
          return t.skip(
            'no usable ' + lane.target + ' toolchain here (' + lane.needs + ')')
        }

        const notready = null == lane.prepare ? null : lane.prepare(sdkroot)
        ok(null == notready, lane.target + ': ' + notready)

        const ran = run(cmd.bin, cmd.args, sdkroot, cmd.env)

        // An environment gap reads like a failure - a missing test framework,
        // an unresolvable dependency - and must not be reported as one. It
        // must not be reported as a PASS either, which is why it skips.
        if (ran.unlaunchable) {
          return t.skip(lane.target + ': the toolchain could not be started ' +
            'here: ' + tail(ran.out, 3))
        }

        const gap = UNUSABLE.find((re) => re.test(ran.out))
        if (null != gap && !ran.ok) {
          return t.skip(lane.target + ': toolchain present but not usable (' +
            gap.source + '):\n' + tail(ran.out))
        }

        ok(ran.ok, 'the feature corpus FAILED against the generated ' +
          lane.target + ' SDK:\n' + tail(ran.out))

        // Exit zero is not enough: every runner skips a feature the SDK was
        // not generated with, and a fully-skipped suite exits zero in every
        // one of these frameworks. Each runner prints how many cases it ran,
        // in the same wording, precisely so this can read it.
        const counted = ran.out.match(RAN_LINE)
        ok(null != counted,
          'the ' + lane.target + ' corpus runner did not report running any ' +
          'case - it SKIPPED the section, so the generated client is missing ' +
          'the feature or has no operation the cases can drive:\n' +
          tail(ran.out))
        ok(0 < Number(counted![1]),
          'the ' + lane.target + ' corpus ran zero cases:\n' + tail(ran.out))
      })
  }


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
