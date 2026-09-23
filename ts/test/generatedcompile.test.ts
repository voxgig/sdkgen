
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


import { makeModel, makeRoot, layeredFs, makeLog } from './generateharness'


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


const RUN_TIMEOUT_MS = 5 * 60 * 1000

function exunitCount(out: string): { total: number, failed: number } | null {
  const legacy = /(\d+) tests?, (\d+) failures?/.exec(out)
  if (null != legacy) {
    return { total: Number(legacy[1]), failed: Number(legacy[2]) }
  }

  const ratio = /Result: (\d+)\/(\d+) passed/.exec(out)
  if (null != ratio) {
    const passed = Number(ratio[1])
    const total = Number(ratio[2])
    return { total, failed: total - passed }
  }

  const allpass = /Result: (\d+) passed/.exec(out)
  if (null != allpass) {
    return { total: Number(allpass[1]), failed: 0 }
  }

  const none = /Result: (\d+) tests?\b/.exec(out)
  if (null != none) {
    return { total: Number(none[1]), failed: 0 }
  }

  return null
}


function run(
  cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv,
  timeoutMs: number = RUN_TIMEOUT_MS,
): { ok: boolean, out: string, unlaunchable: boolean, timedOut: boolean } {
  // A windows toolchain shim is a BATCH FILE - `mvn.cmd`, `phpunit.bat` - and
  // node refuses to spawn one without a shell (CVE-2024-27980). Quote the
  // path rather than pass it bare: `shell: true` builds one command line, so
  // an unquoted `C:\Program Files\...` would split at the space. Everything
  // else spawns directly, which needs no quoting and cannot be shell-injected.
  const shim = 'win32' === process.platform && /\.(cmd|bat)$/i.test(cmd)

  const res = spawnSync(shim ? '"' + cmd + '"' : cmd, args,
    {
      cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
      ...(shim ? { shell: true } : {}),
      ...(env ? { env } : {}),
    })

  const out = String(res.stdout || '') + String(res.stderr || '')

  const timedOut = 'SIGKILL' === res.signal
    || 'ETIMEDOUT' === (res.error as any)?.code

  if (timedOut) {
    return {
      ok: false,
      out: cmd + ' did not finish within ' + Math.round(timeoutMs / 1000) +
        's on this machine' + ('' === out.trim() ? '' : ':\n' + out),
      unlaunchable: false,
      timedOut: true,
    }
  }

  // A command that could not be LAUNCHED (ENOENT, EINVAL) has no output to
  // report, and says nothing about what it would have run: that is an
  // environment gap, which callers report as a skip rather than a failure.
  if (null != res.error) {
    return {
      ok: false,
      out: '' === out.trim() ? String(res.error.message) : out,
      unlaunchable: true,
      timedOut: false,
    }
  }

  return { ok: 0 === res.status, out, unlaunchable: false, timedOut: false }
}


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

  return found.find((path) => /\.(exe|com|cmd|bat)$/i.test(path)) || null
}


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


// One generated file, by the tail of its path: several template trees carry
// a placeholder directory (py's `pkg`, swift's `Sources/<Name>SDK`) that the
// generated tree spells with the project's own name.
function pick(
  out: Record<string, string>, target: string, tail: string,
): string {
  const found = Object.keys(out).filter((p) => p.endsWith(tail))
  strictEqual(found.length, 1,
    target + ': expected one ' + tail + ', got ' + JSON.stringify(found))
  return out[found[0]]
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


  for (const target of ['ts', 'js']) {
    test(target + ': paging isolates independent operations', async () => {
      const sdkroot = Path.join(tmp, target + '-paging')
      await generateTo(target, sdkroot, undefined, ['paging'])
      linkDeps(sdkroot)
      if ('ts' === target) {
        const compiled = tsc(sdkroot, 'src')
        ok(compiled.ok, compiled.out)
      }
      const probe = Path.join(sdkroot, 'paging.cjs')
      Fs.copyFileSync(Path.join(PKG, 'test/fixture/transport/paging.js'), probe)
      const result = run(process.execPath,
        [probe, './' + ('ts' === target ? 'dist' : 'src')], sdkroot)
      ok(result.ok, result.out)
      ok(result.out.includes('explicit continuation preserved'), result.out)
    })
  }


  test('py: pooled HTTP connections do not share cookies', async (t) => {
    const sdkroot = Path.join(tmp, 'py-cookies')
    const out = await generateTo('py', sdkroot)

    // Read the transport BEFORE consulting the toolchain: `requests` is not
    // installed on a GitHub runner, so a lane that skipped first proved
    // nothing anywhere.
    const fetcher = pick(out, 'py', 'utility/fetcher.py')
    ok(fetcher.includes('DefaultCookiePolicy(allowed_domains=[])'),
      'py: the shared session does not refuse cookies')

    const py = toolchain('python3') || toolchain('python')
    if (null == py || !probeOk(py, ['-c', 'import requests'])) {
      return t.skip('generated source checked; needs Python with requests to run it')
    }
    Fs.copyFileSync(Path.join(PKG, 'test/fixture/transport/cookies.py'),
      Path.join(sdkroot, 'cookies.py'))
    const result = run(py, ['-B', 'cookies.py'], sdkroot, {
      ...process.env, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1',
    })
    ok(result.ok, result.out)
    ok(result.out.includes('cookies: isolated; connection: reused'), result.out)
  })


  // The shared-client cookie store, where the platform turns it on by
  // default. Neither toolchain is on a GitHub runner, so the lane reads the
  // generated transport first and only the RUN is conditional.
  for (const [target, file, needles] of [
    ['csharp', 'utility/Fetcher.cs', ['UseCookies = false', 'CookielessHandler']],
    ['swift', 'utility/Fetcher.swift',
      ['httpCookieStorage = nil', 'httpShouldSetCookies = false',
        'httpShouldHandleCookies = false']],
  ] as [string, string, string[]][]) {
    test(target + ': the shared transport stores no cookies', async (t) => {
      const sdkroot = Path.join(tmp, target + '-cookies')
      const out = await generateTo(target, sdkroot)

      const src = pick(out, target, file)
      for (const needle of needles) {
        ok(src.includes(needle), target + ': ' + file + ' is missing ' + needle)
      }
      // Every client/session the transport hands out, not just the first.
      strictEqual(/URLSession\.shared|new HttpClient\(\)/.test(src), false,
        target + ': a cookie-storing default client survives in ' + file)

      const bin = toolchain('csharp' === target ? 'dotnet' : 'swift')
      if (null == bin) {
        return t.skip('generated source checked; no ' +
          ('csharp' === target ? 'dotnet' : 'swift') + ' toolchain to run it')
      }
    })
  }


  test('rb: pooled HTTP connections do not replay unsafe requests', async (t) => {
    const sdkroot = Path.join(tmp, 'rb-replay')
    const out = await generateTo('rb', sdkroot)

    // The replay was a retry loop around http.request; its absence is what
    // the lane proves where Ruby is missing.
    const fetcher = pick(out, 'rb', 'utility/fetcher.rb')
    strictEqual(/rescue EOFError|raise e if stale/.test(fetcher), false,
      'rb: the connection-error replay loop is back in the fetcher')

    const rb = toolchain('ruby')
    if (null == rb) return t.skip('generated source checked; needs Ruby to run it')
    Fs.copyFileSync(Path.join(PKG, 'test/fixture/transport/replay.rb'),
      Path.join(sdkroot, 'replay.rb'))
    const result = run(rb, ['replay.rb'], sdkroot, {
      ...process.env, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1',
    })
    ok(result.ok, result.out)
    ok(result.out.includes('POST: 1 request(s)'), result.out)
    ok(result.out.includes('PATCH: 1 request(s)'), result.out)
    ok(result.out.includes('GET: 2 request(s)'), result.out)
  })


  for (const [target, tool, file, ctxfile] of [
    ['py', 'python3', 'context.py', 'core/context.py'],
    ['rb', 'ruby', 'context.rb', 'core/context.rb'],
    ['php', 'php', 'context.php', 'core/Context.php'],
    ['perl', 'perl', 'context.pl', 'core/context.pm'],
  ]) {
    test(target + ': operation controls are isolated', async (t) => {
      const sdkroot = Path.join(tmp, target + '-context')
      const out = await generateTo(target, sdkroot)

      // The condition first, so the lane still says something on a runner
      // without this interpreter.
      const ctx = pick(out, target, ctxfile)
      ok(/opname/.test(ctx) && /ctrl/i.test(ctx),
        target + ': the control inheritance is not gated on opname')

      const bin = toolchain(tool)
      if (null == bin) {
        return t.skip('generated source checked; needs ' + tool + ' to run it')
      }
      Fs.copyFileSync(Path.join(PKG, 'test/fixture/transport', file),
        Path.join(sdkroot, file))
      const result = run(bin, [file], sdkroot)
      ok(result.ok, result.out)
      ok(result.out.includes('explicit and nested controls preserved'), result.out)
    })
  }


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


  test('typescript: src and tests type-check with the config as DATA', async () => {
    ok(Fs.existsSync(TSC), 'no local typescript — run `npm install`')

    const sdkroot = Path.join(tmp, 'ts-data')
    const out = await generateTo('ts', sdkroot, "main: kit: config: repr: 'data'\n" + 'main: kit: config: headers: ' + JSON.stringify({ 'X-Contract': '\ufeffdescription\nline' }))
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
    await generateTo('go', sdkroot, 'main: kit: config: headers: ' + JSON.stringify({ 'X-Contract': '\ufeffdescription\nline' }))

    const vet = run(go, ['vet', './...'], sdkroot)
    ok(vet.ok, 'generated go does not vet clean:\n' + vet.out)
  })


  // go read a closed type switch and silently used the DEFAULT for any other
  // numeric type; `retry` makes the budget observable as a call count.
  test('go: a feature option is honoured whatever numeric type it arrives as',
    async (t) => {
      const go = toolchain('go')
      if (null == go) {
        return t.skip('no go toolchain here')
      }

      const sdkroot = Path.join(tmp, 'go-optnum')
      const files = await generateTo('go', sdkroot, undefined, ['retry'])
      ok(null != files['test/feature_test.go'],
        'the feature suite was not generated into the SDK')

      const ran = run(go,
        ['test', './test/', '-run', 'TestFeatureOptionNumericTypes', '-v'],
        sdkroot)
      ok(ran.ok, 'a numeric feature option was dropped by the go SDK:\n' +
        tail(ran.out))

      // `go test -run` matching nothing exits zero having run nothing.
      for (const sub of ['json.Number', 'defined_int', 'survives-the-real-makeoptions']) {
        ok(ran.out.includes('--- PASS: TestFeatureOptionNumericTypes/' + sub),
          'the ' + sub + ' case did not run - the suite matched nothing:\n' +
          tail(ran.out))
      }
    })


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
// On struct 0.0.10 this target's validate rejected a stored null, so the
// pre-fix failure was a CONSTRUCTION ERROR ("Expected field auth to be map").
// Since the tag resync (struct-js 0.1.4, 0.3.x behaviour) validate returns
// the optspec default instead, so without the fix this would now be the
// fail-open LEAK - the assertions below pin against both.
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


  test('js: the secrets feature runs with the feature active', async () => {
    const sdkroot = Path.join(tmp, 'js-secrets')
    await generateTo('js', sdkroot,
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])
    linkDeps(sdkroot)

    const suite = Path.join(sdkroot, 'test', 'feature', 'secrets', 'Secrets.test.js')
    ok(Fs.existsSync(suite), 'js: the gated secrets suite was not generated')

    const probe = run(process.execPath,
      ['--test', '--test-reporter=tap',
        Path.join('test', 'feature', 'secrets', 'Secrets.test.js')],
      sdkroot, nestedTestEnv())

    const failed = probe.out.split(/\r?\n/)
      .filter((l: string) => /^\s*not ok /.test(l))
    ok(probe.ok, 'js secrets suite failed:\n' + failed.join('\n') +
      '\n' + tail(probe.out))
  })


  test('lua: the secrets feature runs with the feature active', async (t) => {
    const lua = toolchain('lua5.4')
    if (null == lua) return t.skip('no lua 5.4 toolchain here (lua5.4)')
    const busted = toolchain('busted')
    if (null == busted) return t.skip('lua 5.4 is here but busted is not')
    const make = toolchain('make')
    if (null == make) return t.skip('lua 5.4 is here but make is not')
    if (!probeOk(lua, ['-e', 'require "dkjson"'])) {
      return t.skip('lua 5.4 is here but the dkjson rock is not')
    }

    const sdkroot = Path.join(tmp, 'lua-secrets')
    await generateTo('lua', sdkroot,
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])

    // The shipped suite must actually be there: busted over a directory
    // with no matching file exits zero, so a lane that lost its suite
    // would otherwise fail on the count with a message naming the wrong
    // thing.
    const suite = Path.join(sdkroot, 'test', 'feature', 'secrets',
      'secrets_feature_test.lua')
    ok(Fs.existsSync(suite), 'lua: the gated secrets suite was not generated')
    ok(Fs.existsSync(Path.join(sdkroot, 'feature', 'secrets', 'native', 'sekretonet.c')),
      'lua: the transport helper source was not generated')
    ok(Fs.existsSync(Path.join(sdkroot, 'feature', 'secrets', 'native.mk')),
      'lua: the native build fragment was not generated for an active group')

    // Parse-check every lua file of the feature first. It cannot catch a
    // bad require, but a syntax error inside a plugin only surfaces at the
    // moment the chain loads it, which is one kind that one test drives.
    const luac = toolchain('luac5.4')
    if (null != luac) {
      const files = listFiles(Path.join(sdkroot, 'feature'), '.lua')
      ok(0 < files.length, 'lua: no feature source was generated')
      for (const file of files) {
        const syn = run(luac, ['-p', file], sdkroot)
        ok(syn.ok, 'lua: ' + Path.relative(sdkroot, file) +
          ' does not parse:\n' + tail(syn.out))
      }
    }

    // The native build: the generated Makefile compiles the helper
    // because a plugin group is active. A machine with lua but no C
    // compiler or OpenSSL headers skips rather than fails - that is an
    // environment gap, not a generator defect - but a compiler that IS
    // here and fails is a defect.
    const built = run(make, ['build'], sdkroot)
    if (!built.ok && /a C compiler .* is needed|openssl\/ssl\.h: No such file/.test(built.out)) {
      return t.skip('lua: no C compiler or OpenSSL headers here to build the sekreto helper:\n' +
        tail(built.out, 10))
    }
    ok(built.ok, 'lua: make build failed:\n' + tail(built.out))
    ok(Fs.existsSync(Path.join(sdkroot, 'feature', 'secrets', 'native', 'sekreto-net')),
      'lua: make build did not produce feature/secrets/native/sekreto-net')

    const probe = run(busted,
      ['-p', '_test', Path.join('test', 'feature', 'secrets')], sdkroot)
    if (probe.unlaunchable) {
      return t.skip('lua: busted could not be started here: ' + tail(probe.out, 5))
    }
    if (probe.timedOut) return t.skip('lua: ' + probe.out)

    const out = probe.out.replace(/\r\n/g, '\n')

    const failed = out.split('\n')
      .filter((l: string) => /^(Failure|Error) ->/.test(l))
    ok(probe.ok, 'lua secrets suite failed:\n' + failed.join('\n') +
      '\n' + tail(out))

    // POSITIVE EVIDENCE THE TESTS RAN. busted prints one summary line;
    // without it - or with a count that says the suite was trimmed to a
    // handful - the lane would go green on a run that proved nothing.
    const summary = /(\d+) successes? \/ (\d+) failures? \/ (\d+) errors? \/ (\d+) pending/.exec(out)
    ok(null != summary, 'lua: busted printed no summary:\n' + tail(out))
    const [, successes, failures, errors] = (summary as RegExpExecArray).map(Number)
    strictEqual(failures, 0, 'lua: the secrets suite reported failures:\n' + tail(out))
    strictEqual(errors, 0, 'lua: the secrets suite reported errors:\n' + tail(out))
    ok(10 < successes,
      'lua: the secrets suite ran only ' + successes +
      ' tests - it was trimmed, not run:\n' + tail(out))
    t.diagnostic('lua: secrets suite ran ' + successes + ' tests, ' + failures +
      ' failures, ' + errors + ' errors (vault group, native helper built)')
  })


  test('rb: the secrets feature runs with the feature active', async () => {
    const rb = toolchain('ruby')
    if (null == rb) return
    if (!probeOk(rb, ['-e', 'require "minitest/autorun"'])) return

    const sdkroot = Path.join(tmp, 'rb-secrets')
    await generateTo('rb', sdkroot,
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])

    // The shipped suite must actually be there: a `ruby <path>` on a
    // missing file IS an error, but a lane whose runner moved would then
    // fail for a reason that names the wrong thing.
    const suite = Path.join(sdkroot, 'test', 'feature', 'secrets',
      'secrets_feature_test.rb')
    ok(Fs.existsSync(suite), 'rb: the gated secrets suite was not generated')

    // Parse-check the vendored tree first. It cannot catch a bad require,
    // but a syntax error inside a plugin only surfaces at the moment the
    // chain loads it, which is one kind that one test drives.
    const files: string[] = []
    const walk = (dir: string) => {
      for (const ent of Fs.readdirSync(dir, { withFileTypes: true })) {
        const full = Path.join(dir, ent.name)
        if (ent.isDirectory()) walk(full)
        else if (ent.name.endsWith('.rb')) files.push(full)
      }
    }
    walk(Path.join(sdkroot, 'feature'))
    ok(0 < files.length, 'rb: no feature source was generated')
    for (const file of files) {
      const syn = run(rb, ['-c', file], sdkroot)
      ok(syn.ok, 'rb: ' + Path.relative(sdkroot, file) +
        ' does not parse:\n' + tail(syn.out))
    }

    const probe = run(rb,
      ['-Ilib', '-Itest',
        Path.join('test', 'feature', 'secrets', 'secrets_feature_test.rb')],
      sdkroot)

    const failed = probe.out.split(/\r?\n/)
      .filter((l: string) => /^\s*\d+\) (Failure|Error):/.test(l))
    ok(probe.ok, 'rb secrets suite failed:\n' + failed.join('\n') +
      '\n' + tail(probe.out))

    // A minitest file that defines no test method EXITS ZERO. Without this
    // the lane would go green on a suite `target add` had trimmed to
    // nothing, or one whose class name stopped matching — the vacuous pass
    // this lane exists to prevent.
    const runs = /(\d+) runs, (\d+) assertions/.exec(probe.out)
    ok(null != runs, 'rb: minitest printed no summary:\n' + tail(probe.out))
    ok(10 < Number((runs as RegExpExecArray)[1]),
      'rb: the secrets suite ran only ' + (runs as RegExpExecArray)[1] +
      ' tests - it was trimmed, not run:\n' + tail(probe.out))
    ok(Number((runs as RegExpExecArray)[1]) < Number((runs as RegExpExecArray)[2]),
      'rb: the secrets suite made ' + (runs as RegExpExecArray)[2] +
      ' assertions across ' + (runs as RegExpExecArray)[1] +
      ' tests - cases are exiting before they assert:\n' + tail(probe.out))
  })


  // An SDL-derived SDK unwraps `body.data.<field>`. The probe sets that shape
  // on the real generated config and drives the real mock.
  test('rb: the mock synthesises a multi-segment response envelope', async () => {
    const rb = toolchain('ruby')
    if (null == rb) return

    const sdkroot = Path.join(tmp, 'rb-envelope')
    await generateTo('rb', sdkroot, undefined, ['test', 'log'])

    Fs.writeFileSync(Path.join(sdkroot, 'envelope_probe.rb'), `
require_relative "Demo_sdk"

point = DemoConfig.shared_config["entity"]["planet"]["op"]["list"]["points"][0]
point["transform"]["res"] = "\`body.data.planets\`"

seed = { "entity" => { "planet" => {
  "s1" => { "id" => "s1" }, "s2" => { "id" => "s2" }, "s3" => { "id" => "s3" },
} } }

got = DemoSDK.test(seed, nil).Planet(nil).list(nil, nil)
n = got.respond_to?(:length) ? got.length : -1
puts "ENVELOPE n=#{n}"
abort("FAIL: a multi-segment envelope was not synthesised - #{n} of 3 records") unless 3 == n
`)

    const probe = run(rb, ['-I.', 'envelope_probe.rb'], sdkroot)
    ok(probe.ok, 'rb: ' + tail(probe.out))
    // The probe exits zero if it never reached the assertion.
    ok(/ENVELOPE n=3/.test(probe.out),
      'rb: the probe did not run the list op:\n' + tail(probe.out))
  })


  test('c: the secrets feature runs with the feature active', async (t) => {
    const make = toolchain('make')
    const configured = process.env.CC
    const cc = null == configured || '' === configured
      ? (toolchain('cc') || toolchain('gcc'))
      : toolchain(configured)
    if (null == make || null == cc) {
      return t.skip('needs make and a C compiler (make: ' + make + ', cc: ' + cc + ')')
    }

    const sdkroot = Path.join(tmp, 'c-secrets')
    await generateTo('c', sdkroot,
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])

    ok(Fs.existsSync(Path.join(sdkroot, 'feature', 'secrets', 'kinds.c')) &&
      Fs.existsSync(Path.join(sdkroot, 'feature', 'secrets', 'kinds.mk')),
      'c: the wiring files feature/secrets/kinds.{c,mk} were not generated')
    const suite = Path.join('tests', 'feature', 'secrets', 'secrets_test.c')
    ok(Fs.existsSync(Path.join(sdkroot, suite)),
      'c: the gated secrets suite was not generated')

    const hdrprobe = Path.join(tmp, 'c-secrets-headers.c')
    Fs.writeFileSync(hdrprobe,
      '#include <openssl/ssl.h>\n#include <curl/curl.h>\nint main(void) { return 0; }\n')
    const hdr = run(cc, ['-fsyntax-only', hdrprobe], tmp)
    if (hdr.timedOut) return t.skip('c: ' + hdr.out)
    if (!hdr.ok) {
      return t.skip('c: a compiler is here but the OpenSSL and libcurl ' +
        'development headers are not (libssl-dev, libcurl4-openssl-dev):\n' +
        tail(hdr.out, 5))
    }

    // Build the ONE suite binary (the Makefile builds libsdk.a for it),
    // as the auth-null lane does; `make test` would also run the corpus
    // drivers, which need a corpus this lane does not write.
    const built = run(make, ['CC=' + cc, 'tests/feature/secrets/secrets_test.out'], sdkroot)
    if (built.timedOut) return t.skip('c: ' + built.out)
    ok(built.ok, 'c: the secrets suite did not build:\n' + tail(built.out))

    const probe = run(Path.join(sdkroot, 'tests', 'feature', 'secrets', 'secrets_test.out'),
      [], sdkroot)
    if (probe.timedOut) return t.skip('c: ' + probe.out)
    const out = probe.out.replace(/\r\n/g, '\n')

    const failed = out.split('\n').filter((l: string) => /^FAIL \[/.test(l))
    ok(probe.ok, 'c secrets suite failed:\n' + failed.join('\n') + '\n' + tail(out))

    const ran = /^secrets: ran (\d+) case\(s\)$/m.exec(out)
    ok(null != ran, 'c: the suite printed no case count:\n' + tail(out))
    ok(10 < Number((ran as RegExpExecArray)[1]),
      'c: the secrets suite ran only ' + (ran as RegExpExecArray)[1] +
      ' cases - it was trimmed, not run:\n' + tail(out))

    const summary = /^secrets: (\d+) checks, (\d+) failed$/m.exec(out)
    ok(null != summary, 'c: ctest printed no summary:\n' + tail(out))
    ok('0' === (summary as RegExpExecArray)[2],
      'c: the secrets suite reports failures:\n' + tail(out))
    ok(Number((ran as RegExpExecArray)[1]) < Number((summary as RegExpExecArray)[1]),
      'c: the secrets suite made ' + (summary as RegExpExecArray)[1] +
      ' checks across ' + (ran as RegExpExecArray)[1] +
      ' cases - cases are exiting before they assert:\n' + tail(out))

    ok(/^secrets: 2 plugin definition\(s\) selected by the model$/m.test(out),
      'c: feature_plugins("secrets") did not answer the vault group\'s two definitions:\n' +
      tail(out))
  })


  test('perl: the secrets feature runs with the feature active', async (t) => {
    const sdkroot = Path.join(tmp, 'perl-secrets')
    await generateTo('perl', sdkroot,
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])

    // The shipped suite must actually be there: `perl <path>` on a missing
    // file IS an error, but a lane whose runner moved would then fail for
    // a reason that names the wrong thing.
    const suite = Path.join('t', 'feature', 'secrets', 'secrets.t')
    ok(Fs.existsSync(Path.join(sdkroot, suite)),
      'perl: the gated secrets suite was not generated')

    // Probed AFTER generating, so a machine without perl still proves the
    // suite is emitted - the half of this check that needs no interpreter.
    // Test::More is core, but a minimal perl can be built without it, and
    // a `use` that fails is a compile error that would read as a suite
    // failure.
    const perl = toolchain('perl')
    if (null == perl) return t.skip('no usable perl toolchain here (perl)')
    if (!probeOk(perl, ['-MTest::More', '-e', '1'])) {
      return t.skip('perl is here but Test::More is not')
    }

    const probe = run(perl, ['-Ilib', suite], sdkroot)

    if (probe.unlaunchable) {
      return t.skip('perl: the toolchain could not be started here: ' +
        tail(probe.out, 3))
    }
    if (probe.timedOut) return t.skip('perl: ' + probe.out)

    const gap = UNUSABLE.find((re) => re.test(probe.out))
    if (null != gap && !probe.ok) {
      return t.skip('perl: toolchain present but not usable (' +
        gap.source + '):\n' + tail(probe.out))
    }

    const lines = probe.out.split(/\r?\n/)

    const failed = lines.filter((l: string) => /^not ok /.test(l))
    ok(probe.ok, 'perl secrets suite failed:\n' + failed.join('\n') +
      '\n' + tail(probe.out))

    const plan = lines
      .map((l: string) => /^1\.\.(\d+)$/.exec(l))
      .find((m) => null != m)
    ok(null != plan,
      'perl: no TAP plan line - the suite did not run to done_testing:\n' +
      tail(probe.out))
    const planned = Number((plan as RegExpExecArray)[1])
    const passed = lines.filter((l: string) => /^ok \d+/.test(l)).length
    const skipped = lines.filter((l: string) => /^ok \d+ # skip/i.test(l))

    ok(10 < planned, 'perl: the secrets suite planned only ' + planned +
      ' assertion(s) - it was trimmed, not run:\n' + tail(probe.out))
    strictEqual(passed, planned,
      'perl: the secrets suite planned ' + planned + ' assertion(s) but ' +
      passed + ' passed:\n' + failed.join('\n') + '\n' + tail(probe.out))
    strictEqual(skipped.length, 0,
      'perl: ' + skipped.length + ' assertion(s) were SKIPPED - the vault ' +
      'plugin group was not generated, so the plugin vocabulary went ' +
      'untested:\n' + skipped.join('\n'))

    t.diagnostic('perl: secrets suite ran ' + passed + ' of ' + planned +
      ' planned assertion(s), 1..' + planned)
  })


  test('zig: the secrets feature runs with the feature active', async (t) => {
    const sdkroot = Path.join(tmp, 'zig-secrets')
    await generateTo('zig', sdkroot,
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])

    // The shipped suite and the module root must actually be there: build.zig
    // names both, so a lane that lost either would fail for a reason that
    // names the wrong thing.
    ok(Fs.existsSync(Path.join(sdkroot, 'test', 'feature', 'secrets', 'secrets_test.zig')),
      'zig: the gated secrets suite was not generated')
    ok(Fs.existsSync(Path.join(sdkroot, 'feature', 'secrets', 'plugins.zig')),
      'zig: the sekretoplugins module root was not generated')

    const zig = toolchain('zig')
    if (null == zig) return t.skip('no zig toolchain here (zig)')
    const version = run(zig, ['version'], sdkroot)
    const found = version.out.trim().split(/\r?\n/)[0] || ''
    if (!version.ok || !/^0\.16\./.test(found)) {
      return t.skip('zig 0.16 is required by the generated build.zig; found: ' +
        (found || tail(version.out, 3)))
    }

    const probe = run(zig, ['build', 'test-secrets', '--summary', 'all'], sdkroot)

    if (probe.unlaunchable) {
      return t.skip('zig: the toolchain could not be started here: ' +
        tail(probe.out, 3))
    }
    if (probe.timedOut) return t.skip('zig: ' + probe.out)

    const out = probe.out.replace(/\r\n/g, '\n')

    const failed = out.split('\n')
      .filter((l: string) => /^error: '.*' failed/.test(l))
    ok(probe.ok, 'zig secrets suite failed:\n' + failed.join('\n') +
      '\n' + tail(out))

    const tally = /(\d+)\/(\d+) tests passed( \(([^)]*)\))?/.exec(out)
    ok(null != tally,
      'zig: no `N/N tests passed` tally - the suite did not run:\n' + tail(out))
    const passed = Number((tally as RegExpExecArray)[1])
    const total = Number((tally as RegExpExecArray)[2])
    const annotation = (tally as RegExpExecArray)[4] || ''

    ok(10 < total, 'zig: the secrets suite counted only ' + total +
      ' test(s) - it was trimmed, not run:\n' + tail(out))
    strictEqual(passed, total,
      'zig: the secrets suite counted ' + total + ' test(s) but ' + passed +
      ' passed:\n' + failed.join('\n') + '\n' + tail(out))
    ok(!/skipped/.test(annotation),
      'zig: test(s) were SKIPPED (' + annotation + ') - the vault plugin ' +
      'group was not generated, so the plugin vocabulary went untested:\n' +
      tail(out))
    ok(/steps succeeded/.test(out) && !/failed\)/.test(out.match(/Build Summary:.*/)?.[0] || ''),
      'zig: a build step failed, so the tally is incomplete:\n' + tail(out))

    t.diagnostic('zig: secrets suite ran ' + passed + ' of ' + total +
      ' test(s) through `zig build test-secrets`')
  })


  test('swift: the secrets feature runs with the feature active', async (t) => {
    const swift = toolchain('swift')
    if (null == swift) return t.skip('no swift toolchain here (swift)')

    const sdkroot = Path.join(tmp, 'swift-secrets')
    await generateTo('swift', sdkroot,
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])

    // The shipped suite must actually be there: a --filter that matches
    // nothing is not an error to `swift test`, so a lane that lost its
    // suite would otherwise fail on the count with a message naming the
    // wrong thing. The test directory carries the model name, so find it
    // rather than hardcode it.
    const testdirs = Fs.readdirSync(Path.join(sdkroot, 'Tests'))
      .filter((n) => n.endsWith('SdkTests'))
    strictEqual(testdirs.length, 1,
      'swift: expected exactly one Tests/<Name>SdkTests directory, found: ' +
      JSON.stringify(testdirs))
    const suite = Path.join(sdkroot, 'Tests', testdirs[0],
      'feature', 'secrets', 'SecretsFeatureTest.swift')
    ok(Fs.existsSync(suite), 'swift: the gated secrets suite was not generated')

    const probe = run(swift,
      ['test', '-j', '2', '--filter', 'SecretsFeatureTest'],
      sdkroot, undefined, 30 * 60 * 1000)

    if (probe.unlaunchable) {
      return t.skip('swift: the toolchain could not be started here: ' +
        tail(probe.out, 3))
    }
    if (probe.timedOut) return t.skip('swift: ' + probe.out)

    const lines = probe.out.split(/\r?\n/)

    const failed = lines.filter((l: string) =>
      /^Test Case '.*' failed/.test(l) || /error: /.test(l))
    ok(probe.ok, 'swift secrets suite failed:\n' + failed.join('\n') +
      '\n' + tail(probe.out))

    // POSITIVE evidence the tests RAN. XCTest prints `Executed N tests,
    // with F failures (U unexpected)` per suite and then for the run; the
    // LAST one is the run's total, which under --filter is this suite's.
    // A filter that matched nothing executes zero tests and EXITS ZERO -
    // the vacuous pass this lane exists to prevent.
    const executed = lines
      .map((l: string) => /Executed (\d+) tests?, with (\d+) failures? \((\d+) unexpected\)/.exec(l))
      .filter((m) => null != m)
    ok(0 < executed.length,
      'swift: XCTest printed no `Executed N tests` summary:\n' + tail(probe.out))
    const [, ran, nfailed] = (executed[executed.length - 1] as RegExpExecArray).map(Number)

    strictEqual(nfailed, 0, 'swift: the secrets suite reported failures:\n' +
      failed.join('\n') + '\n' + tail(probe.out))
    ok(10 < ran, 'swift: the secrets suite ran only ' + ran +
      ' tests - it was trimmed, not run:\n' + tail(probe.out))

    t.diagnostic('swift: secrets suite ran ' + ran + ' tests, ' + nfailed + ' failures')
  })


  test('go: data and literal paths agree on number types', async () => {
    const go = toolchain('go')
    if (null == go) {
      return
    }

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

    ok(/x-int=int\b/.test(litTypes),
      'literal path did not carry an int - the fixture proves nothing: ' + litTypes)
    strictEqual(dataTypes, litTypes,
      'data and literal paths disagree on value types')
  })


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


  test('csharp: the secrets feature runs with the feature active', async (t) => {
    const dotnet = toolchain('dotnet')
    if (null == dotnet) {
      return t.skip('no dotnet toolchain here')
    }

    const sdkroot = Path.join(tmp, 'csharp-secrets')
    await generateTo('csharp', sdkroot,
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])

    // The shipped suite must actually be there: a --filter that matches
    // nothing is not an error to `dotnet test`, so a lane that lost its
    // suite would otherwise fail on the count with a message naming the
    // wrong thing.
    const suite = Path.join(sdkroot, 'test', 'feature', 'secrets', 'SecretsFeatureTest.cs')
    ok(Fs.existsSync(suite), 'csharp: the gated secrets suite was not generated')

    const testproj = Fs.readdirSync(Path.join(sdkroot, 'test'))
      .filter((n) => n.endsWith('.csproj'))
    strictEqual(testproj.length, 1,
      'csharp: expected exactly one test csproj, found: ' + JSON.stringify(testproj))

    // `dotnet test` builds the library through the project reference, so
    // a broken vendored file fails HERE, naming the file - which is also
    // why the build is not run separately first.
    const probe = run(dotnet,
      ['test', '--nologo', '-v', 'quiet',
        '--filter', 'FullyQualifiedName~SecretsFeatureTest',
        Path.join('test', testproj[0])],
      sdkroot)

    if (probe.timedOut) {
      return t.skip('csharp: ' + probe.out)
    }

    const lines = probe.out.split(/\r?\n/)
    const failed = lines.filter((l: string) => /^\s*(Failed|\[FAIL\])\s+\S/.test(l))
    ok(probe.ok, 'csharp secrets suite failed:\n' + failed.join('\n') +
      '\n' + tail(probe.out))

    const summary = /Passed!\s+-\s+Failed:\s+(\d+),\s+Passed:\s+(\d+),\s+Skipped:\s+(\d+),\s+Total:\s+(\d+)/
      .exec(probe.out)
    ok(null != summary, 'csharp: dotnet test printed no Passed! summary:\n' + tail(probe.out))
    const [, nfailed, npassed, nskipped] = (summary as RegExpExecArray).map(Number)
    strictEqual(nfailed, 0, 'csharp: the secrets suite reported failures:\n' + tail(probe.out))
    strictEqual(nskipped, 0, 'csharp: the secrets suite skipped cases:\n' + tail(probe.out))
    ok(10 < npassed,
      'csharp: the secrets suite ran only ' + npassed +
      ' tests - it was trimmed, not run:\n' + tail(probe.out))
  })



  test('cpp: the secrets feature runs with the feature active', async (t) => {
    const make = toolchain('make')
    const configured = process.env.CXX
    const cxx = null == configured || '' === configured
      ? (toolchain('g++') || toolchain('c++') || toolchain('clang++'))
      : toolchain(configured)
    if (null == make || null == cxx) {
      return t.skip('needs make and a C++ compiler (make: ' + make + ', cxx: ' + cxx + ')')
    }

    const sdkroot = Path.join(tmp, 'cpp-secrets')
    await generateTo('cpp', sdkroot,
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])

    ok(Fs.existsSync(Path.join(sdkroot, 'feature', 'secrets', 'kinds.cpp')) &&
      Fs.existsSync(Path.join(sdkroot, 'feature', 'secrets', 'kinds.mk')),
      'cpp: the wiring files feature/secrets/kinds.{cpp,mk} were not generated')
    const suite = Path.join('test', 'feature', 'secrets', 'secrets_test.cpp')
    ok(Fs.existsSync(Path.join(sdkroot, suite)),
      'cpp: the gated secrets suite was not generated')

    const hdrprobe = Path.join(tmp, 'cpp-secrets-headers.cpp')
    Fs.writeFileSync(hdrprobe, '#include <openssl/ssl.h>\nint main() { return 0; }\n')
    const hdr = run(cxx, ['-fsyntax-only', hdrprobe], tmp)
    if (hdr.timedOut) return t.skip('cpp: ' + hdr.out)
    if (!hdr.ok) {
      return t.skip('cpp: a compiler is here but the OpenSSL development ' +
        'headers are not (libssl-dev):\n' + tail(hdr.out, 5))
    }

    const built = run(make, ['-j2', 'CXX=' + cxx, 'test/feature/secrets/secrets_test.out'], sdkroot)
    if (built.timedOut) return t.skip('cpp: ' + built.out)
    ok(built.ok, 'cpp: the secrets suite did not build:\n' + tail(built.out))

    const probe = run(Path.join(sdkroot, 'test', 'feature', 'secrets', 'secrets_test.out'),
      [], sdkroot)
    if (probe.timedOut) return t.skip('cpp: ' + probe.out)
    const out = probe.out.replace(/\r\n/g, '\n')

    const failed = out.split('\n').filter((l: string) => /^\s*FAIL \[/.test(l))
    ok(probe.ok, 'cpp secrets suite failed:\n' + failed.join('\n') + '\n' + tail(out))

    // POSITIVE evidence the tests RAN: the case count the suite prints from
    // its own RUN macro, and testlib's summary. A suite that `target add`
    // trimmed, or that the Makefile never compiled, prints neither.
    const ran = /^secrets: ran (\d+) case\(s\)$/m.exec(out)
    ok(null != ran, 'cpp: the suite printed no case count:\n' + tail(out))
    ok(10 < Number((ran as RegExpExecArray)[1]),
      'cpp: the secrets suite ran only ' + (ran as RegExpExecArray)[1] +
      ' cases - it was trimmed, not run:\n' + tail(out))

    const summary = /^secrets_test: (\d+) tests, (\d+) checks, (\d+) failures$/m.exec(out)
    ok(null != summary, 'cpp: testlib printed no summary:\n' + tail(out))
    strictEqual((summary as RegExpExecArray)[3], '0',
      'cpp: the secrets suite reports failures:\n' + tail(out))
    ok(Number((ran as RegExpExecArray)[1]) < Number((summary as RegExpExecArray)[2]),
      'cpp: the secrets suite made ' + (summary as RegExpExecArray)[2] +
      ' checks across ' + (ran as RegExpExecArray)[1] +
      ' cases - cases are exiting before they assert:\n' + tail(out))

    ok(/^secrets: 2 plugin definition\(s\) selected by the model$/m.test(out),
      'cpp: featurePlugins("secrets") did not answer the vault group\'s two definitions:\n' +
      tail(out))
  })


  test('php: README output stays bounded and detects errors after large output', async () => {
    const php = toolchain('php')
    if (null == php) return
    const sdkroot = Path.join(tmp, 'php-output')
    await generateTo('php', sdkroot)
    Fs.writeFileSync(Path.join(sdkroot, 'writer.php'), `<?php
 echo "\\n@@VOXBEGIN 0\\n";
 for ($i = 0; $i < 8192; $i++) echo str_repeat('x', 8191) . "\\n";
 if (($argv[1] ?? '') === 'error') echo str_repeat('x', 8180) . "Call to undefined method Demo::missing()\\n";
 echo "\\n@@VOXEND 0\\n";
 exit(($argv[1] ?? '') === 'error' ? 7 : 0);
`)
    Fs.writeFileSync(Path.join(sdkroot, 'probe.php'), `<?php
namespace PHPUnit\\Framework { class TestCase {} }
namespace {
 require __DIR__ . '/test/ReadmeExamplesTest.php';
 $suite = new ReadmeExamplesTest();
 $run = new \\ReflectionMethod($suite, 'runOutput');
 $segment = new \\ReflectionMethod($suite, 'batchSegment');
 foreach (['clean', 'error'] as $kind) {
  [$summary, $rc] = $run->invoke($suite, escapeshellarg(PHP_BINARY) . ' -d memory_limit=16M ' . escapeshellarg(__DIR__ . '/writer.php') . ' ' . $kind);
  $text = $segment->invoke($suite, $summary, 0);
  if ($text === null || strlen($summary) > 2048 || $rc !== ($kind === 'error' ? 7 : 0)) exit(1);
  if (str_contains($text, 'Call to undefined method') !== ($kind === 'error')) exit(2);
 }
 echo "streamed 128 MiB; late error detected\\n";
}
`)
    const result = run(php, ['-d', 'memory_limit=16M', 'probe.php'], sdkroot)
    ok(result.ok, 'PHP output scanner failed under a bounded heap:\n' + result.out)
    ok(result.out.includes('streamed 128 MiB; late error detected'), result.out)
    const readme = Fs.readFileSync(Path.join(sdkroot, 'README.md'), 'utf8')
    const sample = [...readme.matchAll(/```php\n([\s\S]*?)```/g)]
      .map(match => match[1]).find(code => code.includes('mock record'))
    ok(sample, 'no generated mock-record example to execute')
    Fs.writeFileSync(Path.join(sdkroot, 'print-record.php'),
      "<?php\nrequire __DIR__ . '/demo_sdk.php';\n" + sample)
    const printed = run(php, ['-d', 'memory_limit=16M', 'print-record.php'], sdkroot)
    ok(printed.ok, sample + '\n' + printed.out)
    ok(printed.out.includes('test01'), 'example did not print the mock record: ' + printed.out)
    ok(printed.out.length < 4096, 'example printed the SDK object graph instead of record data')
  })


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


  test('clojure: the secrets feature runs with the feature active', async (t) => {
    const clj = toolchain('clojure')
    if (null == clj) {
      return t.skip('no clojure toolchain here')
    }

    const sdkroot = Path.join(tmp, 'clojure-secrets')
    await generateTo('clojure', sdkroot,
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])

    // The shipped suite and the feature must actually be there: the
    // runner's discovery is conditional on the FILES, so a lane that lost
    // either would still exit zero, reporting a run of nothing.
    ok(Fs.existsSync(Path.join(sdkroot, 'test', 'sdk', 'test', 'feature', 'secrets.clj')),
      'clojure: the gated secrets suite was not generated')
    ok(Fs.existsSync(Path.join(sdkroot, 'feature', 'secrets', 'sdk', 'feature', 'secrets.clj')),
      'clojure: the secrets feature source was not generated')

    const probe = run(clj, ['-M:test', '--sdk-only'], sdkroot)

    if (probe.unlaunchable) {
      return t.skip('clojure: the toolchain could not be started here: ' +
        tail(probe.out, 3))
    }
    if (probe.timedOut) {
      return t.skip('clojure: ' + tail(probe.out, 3))
    }

    const failed = probe.out.split(/\r?\n/)
      .filter((l: string) => /^FAIL /.test(l))
    ok(probe.ok, 'clojure secrets suite failed:\n' + failed.join('\n') +
      '\n' + tail(probe.out))

    const ran = /^feature\.secrets: ran (\d+) check\(s\)$/m.exec(probe.out)
    ok(null != ran,
      'clojure: the runner printed no `feature.secrets: ran N check(s)` line ' +
      '- -main is not calling run-feature-suites, so the shipped secrets ' +
      'suite never ran:\n' + tail(probe.out))
    ok(10 < Number((ran as RegExpExecArray)[1]),
      'clojure: the secrets suite ran only ' + (ran as RegExpExecArray)[1] +
      ' checks - it was trimmed, not run:\n' + tail(probe.out))
    ok(/^ALL GREEN$/m.test(probe.out),
      'clojure: the runner exited zero without printing ALL GREEN:\n' +
      tail(probe.out))
  })


  test('ocaml: the secrets feature runs with the feature active', async (t) => {
    const ocamlc = toolchain('ocamlc')
    const make = toolchain('make')
    const configured = process.env.CC
    const cc = null == configured || '' === configured
      ? (toolchain('cc') || toolchain('gcc'))
      : toolchain(configured)
    if (null == ocamlc || null == make || null == cc) {
      return t.skip('needs ocamlc, make and a C compiler (ocamlc: ' + ocamlc +
        ', make: ' + make + ', cc: ' + cc + ')')
    }

    const sdkroot = Path.join(tmp, 'ocaml-secrets')
    await generateTo('ocaml', sdkroot,
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])

    ok(Fs.existsSync(Path.join(sdkroot, 'feature', 'secrets', 'feature.mk')),
      'ocaml: the build fragment feature/secrets/feature.mk was not generated')
    ok(Fs.existsSync(Path.join(sdkroot, 'test', 'feature', 'secrets', 't_secrets.ml')),
      'ocaml: the gated secrets suite was not generated')
    ok(Fs.existsSync(Path.join(sdkroot, 'feature', 'secrets', 'plugins', 'tls_stubs.c')),
      'ocaml: the OpenSSL binding source was not carried')

    const hdrprobe = Path.join(tmp, 'ocaml-secrets-headers.c')
    Fs.writeFileSync(hdrprobe,
      '#include <openssl/ssl.h>\n#include <caml/mlvalues.h>\nint main(void) { return 0; }\n')
    const where = run(ocamlc, ['-where'], tmp)
    if (!where.ok) return t.skip('ocaml: ocamlc -where failed: ' + tail(where.out, 3))
    const hdr = run(cc, ['-fsyntax-only', '-I' + where.out.trim(), hdrprobe], tmp)
    if (hdr.timedOut) return t.skip('ocaml: ' + hdr.out)
    if (!hdr.ok) {
      return t.skip('ocaml: a compiler is here but the OpenSSL or OCaml runtime ' +
        'headers are not (libssl-dev, the ocaml package):\n' + tail(hdr.out, 5))
    }

    // Type-check the library first (the Makefile's `build` is `-c` over the
    // whole ordered list), then build and run the SDK suite binary, which
    // links the gated tier: unix.cma, the stub, -custom, OpenSSL.
    const built = run(make, ['CC=' + cc, 'OCAMLC=' + ocamlc, 'build'], sdkroot)
    if (built.timedOut) return t.skip('ocaml: ' + built.out)
    ok(built.ok, 'ocaml: the generated SDK does not type-check:\n' + tail(built.out))

    const probe = run(make, ['CC=' + cc, 'OCAMLC=' + ocamlc, 'test-sdk'], sdkroot)
    if (probe.timedOut) return t.skip('ocaml: ' + probe.out)
    const out = probe.out.replace(/\r\n/g, '\n')

    const failed = out.split('\n').filter((l: string) => /^FAIL /.test(l))
    ok(probe.ok, 'ocaml secrets suite failed:\n' + failed.join('\n') + '\n' + tail(out))

    const ran = /^feature\.secrets: ran (\d+) check\(s\)$/m.exec(out)
    ok(null != ran,
      'ocaml: the suite printed no `feature.secrets: ran N check(s)` line - ' +
      'feature.mk is not linking test/feature/secrets/t_secrets.ml into ' +
      'run_sdk_test, so the shipped suite never ran:\n' + tail(out))
    ok(10 < Number((ran as RegExpExecArray)[1]),
      'ocaml: the secrets suite ran only ' + (ran as RegExpExecArray)[1] +
      ' checks - it was trimmed, not run:\n' + tail(out))

    const summary = /^SDK PASS (\d+)  FAIL (\d+)$/m.exec(out)
    ok(null != summary, 'ocaml: the harness printed no summary:\n' + tail(out))
    ok('0' === (summary as RegExpExecArray)[2],
      'ocaml: the SDK suite reports failures:\n' + tail(out))
    ok(Number((ran as RegExpExecArray)[1]) <= Number((summary as RegExpExecArray)[1]),
      'ocaml: the summary counts fewer passes than the secrets suite ran')

    ok(/^secrets: 2 plugin definition\(s\) selected by the model$/m.test(out),
      'ocaml: feature_plugins "secrets" did not answer the vault group\'s two definitions:\n' +
      tail(out))

    // And the bundled transport really is the vendored client: with no
    // system.fetch the exchange dialled the loopback port and said so in
    // sekreto's words, rather than answering "no transport".
    ok(/^secrets: exchange without system\.fetch -> sekreto: cannot reach /m.test(out),
      'ocaml: the exchange did not reach the vendored HTTP client (secrets_transport):\n' +
      tail(out))

    t.diagnostic('ocaml: secrets suite ran ' + (ran as RegExpExecArray)[1] +
      ' checks (vault group, OpenSSL binding built and linked -custom)')
  })
})


const CORPUS_FEATURES = [
  'test', 'log', 'cost', 'netsim', 'retry', 'cache', 'timeout', 'ratelimit', 'paging',
]


// The one line every runner prints, in every language, when a section runs:
// "feature.cost: ran 15 of 15 case(s) against 2 operation(s)". Reading it is
// how a lane tells a section that RAN from one that skipped - which each
// framework reports as a pass.
const RAN_LINE = /feature\.\w+: ran (\d+) of (\d+) case/

function ranLine(name: string): RegExp {
  return new RegExp('feature\\.' + name + ': ran (\\d+) of (\\d+) case')
}

// A section naming a feature the SDK does not generate is INERT, and every
// runner says so in this one wording rather than skipping in silence.
function inertLine(name: string): RegExp {
  return new RegExp('feature\\.' + name + ': inert \\(this SDK does not generate the feature\\)')
}

// Sections of the fixture whose feature the lane does NOT generate, to pin
// the inert line. Every other section must run.
const CORPUS_INERT = ['audit']


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
  /Can't locate builtin\.pm/,
  /requires perl 5\.36 or later/,
]


function tail(out: string, lines = 40): string {
  const all = out.split(/\r?\n/)
  return all.length <= lines ? out : all.slice(-lines).join('\n')
}


function writeCorpus(tmp: string) {
  const testdir = Path.join(tmp, '.sdk', 'test')
  Fs.mkdirSync(testdir, { recursive: true })
  Fs.writeFileSync(Path.join(testdir, 'test.json'),
    JSON.stringify(CORPUS_FIXTURE, null, 2))
}


function probeOk(bin: string, args: string[]): boolean {
  return run(bin, args, process.cwd()).ok
}


type CorpusLane = {
  target: string,
  // The runner file the target must generate - asserted even when the
  // toolchain is absent, so a lane that cannot run still proves that much.
  runner: string,
  needs: string,
  // A build step, for targets that have one. Returns a message when the lane
  // cannot get as far as running, or null when it is ready.
  prepare?: (sdkroot: string) => string | null,
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
      if (!probeOk(py, ['-m', 'pytest', '--version'])) return null
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


const AUTHNULL_LANES: {
  target: string,
  needs: string,
  probe: string,
  source: string,
  exec: (sdkroot: string) =>
    { ok: boolean, out: string, phase?: string, timedOut?: boolean }
    | { skip: string }
    | null,
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
      if (built.timedOut) return built
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
  {
    target: 'kotlin',
    needs: 'gradle (which resolves the Kotlin plugin from the network)',
    probe: 'test/AuthNullProbe.kt',
    source: `package voxgig.demosdk.sdktest

// \`auth: null\` must suppress an explicit apikey ON THE WIRE - in the headers
// the transport is handed - not merely in the options map.
//
// An options-level assertion is not enough: lean's prepareAuth never read
// options.auth at all, so a port of that shape passes an options check while
// still transmitting the credential. This drives the real makeOptions (through
// the constructor) and a real entity operation, and asserts on what a mock
// fetcher receives.
//
// The baseline fails loudly if an ordinary apikey stops being sent, because
// the suppression alone cannot fail visibly: with no apikey nothing goes on
// the wire either way, so a probe without the baseline passes with the defect
// live.

import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

import voxgig.demosdk.core.Context
import voxgig.demosdk.core.DemoSDK

class AuthNullProbe {

  private var seen: String? = null
  private var had = false

  // \`called\` matters as much as \`had\`. If the suppressed path fails before
  // the transport runs, \`had\` stays false - indistinguishable from a
  // successful suppression - and this would pass on a broken SDK. The baseline
  // cannot catch that, since it exercises different options.
  private var called = false

  private fun wire(opts: MutableMap<String, Any?>) {
    seen = null
    had = false
    called = false

    val full = LinkedHashMap<String, Any?>(opts)
    val mock: (Context, String, MutableMap<String, Any?>) -> Any? = { _, _, fetchdef ->
      called = true
      val h = fetchdef["headers"]
      if (h is Map<*, *>) {
        // Presence separately from value: a present-but-empty header is not
        // suppression, and reading the value alone cannot tell them apart.
        had = h.containsKey("authorization")
        seen = h["authorization"]?.toString()
      }
      val res = linkedMapOf<String, Any?>()
      res["status"] = 200
      res["statusText"] = "OK"
      res["headers"] = linkedMapOf<String, Any?>()
      res["body"] = "{}"
      res
    }
    full["utility"] = linkedMapOf<String, Any?>("fetcher" to mock)

    // The plain constructor, not a test client: the \`test\` feature is
    // transport: 'base' and REPLACES the transport by design, so a client in
    // test mode would shadow the mock and this would assert nothing.
    val sdk = DemoSDK(full)
    try {
      sdk.planet(null).create(linkedMapOf<String, Any?>("name" to "p1"), null)
    }
    catch (ignored: Throwable) {
    }
  }

  @Test
  fun authNullBeatsAnExplicitApikey() {
    val fail = ArrayList<String>()

    wire(linkedMapOf<String, Any?>("apikey" to "OPTKEY01"))
    if (!had || "OPTKEY01" != seen) {
      fail.add("baseline broken: an ordinary apikey was not sent (had=" + had +
        " value=" + seen + ")")
    }

    val supp = linkedMapOf<String, Any?>("apikey" to "OPTKEY01")
    supp["auth"] = null
    wire(supp)
    if (!called) {
      fail.add("the request never reached the transport, so nothing was proved " +
        "about suppression - the suppressed path failed earlier")
    }
    if (had) {
      fail.add("auth null did not suppress the credential - sent " + seen)
    }

    assertTrue(fail.isEmpty(), fail.joinToString("; "))
  }
}
`,
    exec: (sdkroot) => {
      if ('win32' === process.platform) {
        return {
          skip: 'gradle hangs on windows (it does not fail - it never ' +
            'returns), and this lane already runs on ubuntu and macos, ' +
            'where the behaviour it pins is identical',
        }
      }

      const gradle = toolchain('gradle')
      if (null == gradle) return null

      const built = run(gradle, ['--console=plain', 'compileTestKotlin'], sdkroot)
      if (built.timedOut) return built
      if (!built.ok) return { ...built, phase: 'build' }

      return run(gradle, ['--console=plain', 'test', '--tests', '*AuthNullProbe*'],
        sdkroot)
    },
  },
  {
    target: 'csharp',
    needs: 'dotnet',
    probe: 'test/AuthNullProbe.cs',
    source: `// \`auth: null\` must suppress an explicit apikey ON THE WIRE - in the headers
// the transport is handed - not merely in the options map.
//
// An options-level assertion is not enough: lean's prepareAuth never read
// options.auth at all, so a port of that shape passes an options check while
// still transmitting the credential. This drives the real MakeOptions (through
// the constructor) and a real entity operation, and asserts on what a mock
// fetcher receives.
//
// The baseline fails loudly if an ordinary apikey stops being sent, because
// the suppression alone cannot fail visibly: with no apikey nothing goes on
// the wire either way, so a probe without the baseline passes with the defect
// live.

using DemoSdk;

public static class AuthNullProbe
{
    private static string? seen;
    private static bool had;

    // \`called\` matters as much as \`had\`. If the suppressed path fails before
    // the transport runs, \`had\` stays false - indistinguishable from a
    // successful suppression - and this would pass on a broken SDK. The
    // baseline cannot catch that, since it exercises different options.
    private static bool called;

    private static void Wire(Dictionary<string, object?> opts)
    {
        seen = null;
        had = false;
        called = false;

        var full = new Dictionary<string, object?>(opts);

        // A NATURAL lambda, as a caller writes it - NOT declared as
        // FetcherFunc. C# delegate types are nominal, so this is a Func and
        // not an instance of FetcherFunc at all; declaring it as the named
        // type would exercise only the form that already worked.
        var mock = (Context ctx, string fullurl, Dictionary<string, object?> fetchdef) =>
        {
            called = true;
            if (fetchdef.TryGetValue("headers", out var hraw) &&
                hraw is Dictionary<string, object?> headers)
            {
                // Presence separately from value: a present-but-empty header
                // is not suppression, and reading the value alone cannot tell
                // the two apart.
                had = headers.ContainsKey("authorization");
                seen = headers.TryGetValue("authorization", out var v) && null != v
                    ? Convert.ToString(v)
                    : null;
            }
            return (object?)new Dictionary<string, object?>
            {
                ["status"] = 200,
                ["statusText"] = "OK",
                ["headers"] = new Dictionary<string, object?>(),
                ["json"] = (Func<object?>)(() => new Dictionary<string, object?>()),
                ["body"] = "{}",
            };
        };
        full["utility"] = new Dictionary<string, object?> { ["fetcher"] = mock };

        // The plain constructor, not a test client: the \`test\` feature is
        // transport: 'base' and REPLACES the transport by design, so a client
        // in test mode would shadow the mock and this would assert nothing.
        var sdk = new DemoSDK(full);
        try
        {
            sdk.Planet(null).Create(new Dictionary<string, object?> { ["name"] = "p1" }, null);
        }
        catch (Exception)
        {
        }
    }

    public static int Main()
    {
        var fail = new List<string>();

        Wire(new Dictionary<string, object?> { ["apikey"] = "OPTKEY01" });
        if (!had || "OPTKEY01" != seen)
        {
            fail.Add("baseline broken: an ordinary apikey was not sent (had=" + had +
                " value=" + seen + ")");
        }

        var supp = new Dictionary<string, object?> { ["apikey"] = "OPTKEY01" };
        supp["auth"] = null;
        Wire(supp);
        if (!called)
        {
            fail.Add("the request never reached the transport, so nothing was proved " +
                "about suppression - the suppressed path failed earlier");
        }
        if (had)
        {
            fail.Add("auth null did not suppress the credential - sent " + seen);
        }

        foreach (var f in fail)
        {
            Console.WriteLine("FAIL: " + f);
        }
        Console.WriteLine("auth-null probe: " + (0 == fail.Count ? "ok" : "FAILED"));
        return 0 == fail.Count ? 0 : 1;
    }
}
`,
    exec: (sdkroot) => {
      const dotnet = toolchain('dotnet')
      if (null == dotnet) return null

      // A standalone console project referencing the SDK, rather than the
      // generated xunit test project: with no PackageReference there is no
      // nuget graph to restore, and no test framework that can fail
      // independently of what is being probed.
      const sdkproj = Fs.readdirSync(sdkroot).filter((n) => n.endsWith('.csproj'))
      if (1 !== sdkproj.length) {
        return {
          ok: false,
          phase: 'build',
          out: 'expected exactly one .csproj at the SDK root, found: ' +
            JSON.stringify(sdkproj),
        }
      }

      // Read the framework rather than hardcode it: the probe and the library
      // it references have to agree, and a bumped TargetFramework should not
      // silently strand this lane.
      const csproj = Fs.readFileSync(Path.join(sdkroot, sdkproj[0]), 'utf8')
      const tfm = (csproj.match(/<TargetFramework>([^<]+)<\/TargetFramework>/) || [])[1]
      if (null == tfm) {
        return { ok: false, phase: 'build', out: 'no <TargetFramework> in ' + sdkproj[0] }
      }

      const dir = Path.join(sdkroot, 'zz-authnull')
      Fs.mkdirSync(dir, { recursive: true })

      // EnableDefaultCompileItems off, and the probe pulled in by an explicit
      // path: the default glob would take nothing here (the .cs lives in
      // test/) and adding a .cs beside this csproj would put it into the
      // library's glob as well.
      Fs.writeFileSync(Path.join(dir, 'AuthNullProbe.csproj'),
        '<Project Sdk="Microsoft.NET.Sdk">\n' +
        '  <PropertyGroup>\n' +
        '    <OutputType>Exe</OutputType>\n' +
        '    <TargetFramework>' + tfm + '</TargetFramework>\n' +
        '    <Nullable>enable</Nullable>\n' +
        '    <ImplicitUsings>enable</ImplicitUsings>\n' +
        '    <LangVersion>12</LangVersion>\n' +
        '    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>\n' +
        '    <AssemblyName>AuthNullProbe</AssemblyName>\n' +
        '    <NoWarn>$(NoWarn);CS8600;CS8601;CS8602;CS8603;CS8604;CS8618;CS8625</NoWarn>\n' +
        '  </PropertyGroup>\n' +
        '  <ItemGroup>\n' +
        '    <Compile Include="../test/AuthNullProbe.cs" />\n' +
        '    <ProjectReference Include="../' + sdkproj[0] + '" />\n' +
        '  </ItemGroup>\n' +
        '</Project>\n')

      const proj = Path.join(dir, 'AuthNullProbe.csproj')
      const built = run(dotnet, ['build', '--nologo', '-v', 'quiet', proj], sdkroot)
      if (built.timedOut) return built
      if (!built.ok) return { ...built, phase: 'build' }

      return run(dotnet, ['run', '--no-build', '--project', proj], sdkroot)
    },
  },
]


describe('the elixir secrets feature runs from a generated SDK', () => {

  let tmp = ''

  before(() => {
    tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-elixir-secrets-'))
  })

  after(() => {
    if ('' !== tmp) Fs.rmSync(tmp, { recursive: true, force: true })
  })

  test('elixir: the secrets feature runs with the feature active', async (t) => {
    const sdkroot = Path.join(tmp, 'elixir-secrets')
    await generateTo('elixir', sdkroot,
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])

    // The shipped suite must actually be there, and the trim must have
    // happened: asserted BEFORE the toolchain probe, so a machine without
    // mix still proves that much.
    const suite = Path.join('test', 'feature', 'secrets', 'secrets_test.exs')
    ok(Fs.existsSync(Path.join(sdkroot, suite)),
      'elixir: the gated secrets suite was not generated')
    const app = Fs.readdirSync(Path.join(sdkroot, 'lib'))
      .find((n) => Fs.existsSync(Path.join(sdkroot, 'lib', n, 'feature', 'secrets')))
    ok(null != app, 'elixir: no lib/<app>/feature/secrets/ was generated')
    const plugins = Path.join(sdkroot, 'lib', app!, 'feature', 'secrets',
      'sekreto', 'plugins')
    ok(Fs.existsSync(Path.join(plugins, 'hashicorp.ex')),
      'elixir: the ACTIVE vault group lost hashicorp')
    ok(!Fs.existsSync(Path.join(plugins, 'gcpsecrets.ex')),
      'elixir: the inactive cloud group still ships gcpsecrets - mix would ' +
      'compile it without complaint, so the trim has to be checked here')

    // Probed AFTER generating: a machine without the toolchain still
    // proves the SDK generates. `mix` is the entry point; `elixir` is
    // checked too because a mix shim can outlive the runtime it wraps.
    const mix = toolchain('mix')
    const elixir = toolchain('elixir')
    if (null == mix || null == elixir) {
      return t.skip('no usable elixir toolchain here (elixir + mix)')
    }

    // `mix test` refuses to run under any other MIX_ENV, so it is pinned
    // rather than inherited. `--no-color` because the assertions below read
    // the output, and `--trace` for the per-case lines they need.
    const env = { ...process.env, MIX_ENV: 'test' }
    const ran = run(mix, ['test', '--no-color', '--trace', suite], sdkroot, env)

    if (ran.unlaunchable) {
      return t.skip('elixir: the toolchain could not be started here: ' +
        tail(ran.out, 3))
    }
    if (ran.timedOut) {
      return t.skip('elixir: ' + ran.out)
    }
    const gap = UNUSABLE.find((re) => re.test(ran.out))
    if (null != gap && !ran.ok) {
      return t.skip('elixir: toolchain present but not usable (' +
        gap.source + '):\n' + tail(ran.out))
    }

    const out = ran.out.split(/\r?\n/).join('\n')

    const failed = out.split('\n')
      .filter((l: string) => /^\s+\d+\) test /.test(l))
    ok(ran.ok, 'elixir secrets suite failed:\n' + failed.join('\n') +
      '\n' + tail(out))

    const counted = exunitCount(out)
    ok(null != counted, 'elixir: ExUnit printed no summary:\n' + tail(out))
    ok(10 < counted!.total,
      'elixir: the secrets suite ran only ' + counted!.total +
      ' tests - it was trimmed, not run:\n' + tail(out))
    strictEqual(counted!.failed, 0,
      'elixir: ' + counted!.failed + ' secrets tests failed:\n' + tail(out))

    for (const name of [
      'auth nil suppresses the credential, chain or no chain',
      'auth nil suppresses an EXPLICIT apikey too',
    ]) {
      ok(out.includes('test secrets active: ' + name),
        'elixir: the shipped suite no longer runs "' + name + '" - the ' +
        'auth-null classification below rests on it:\n' + tail(out))
    }
  })
})




const AUTHNULL_STANDALONE = ['go', 'js', 'elixir']


const AUTHNULL_UNCOVERED: Record<string, string> = {
  ts: 'pinned instead by the shipped tm/ts/test/feature/secrets/Secrets.test.ts ' +
    '("auth null suppresses the credential, chain or no chain"), which runs in ' +
    'a generated SDK rather than in sdkgen CI',
  swift: 'pinned by the shipped tm/swift/Tests/ProjectNameSDKTests/feature/' +
    'secrets/SecretsFeatureTest.swift ' +
    '("testAuthNullSuppressesTheCredentialChainOrNoChain"), which the swift ' +
    'secrets lane in this file runs through `swift test`',

  clojure: 'pinned by the shipped tm/clojure/test/sdk/test/feature/' +
    'secrets.clj ("secrets-auth-nil-suppresses-the-credential"), which the ' +
    'clojure secrets lane in this file runs through the generated runner',

  zig: 'pinned by the shipped tm/zig/test/feature/secrets/secrets_test.zig ' +
    '("secrets active: auth null suppresses the credential, chain or no ' +
    'chain"), which the zig secrets lane in this file runs through ' +
    '`zig build test-secrets`',

  ocaml: 'pinned by the shipped tm/ocaml/test/feature/secrets/t_secrets.ml ' +
    '("auth.null_suppresses_the_credential_chain_or_no_chain"), which the ' +
    'ocaml secrets lane in this file runs through the generated Makefile',

  scala: 'compiled and executed by hand on scala-cli 1.15.0 / Scala 3.8.4 ' +
    '(the generated SDK\'s own `make test`, plus a direct auth:null probe ' +
    'on header, query and cookie placements); no sdkgen CI lane yet',
}


const AUTHNULL_OUTSTANDING: Record<string, string> = {
}


// Cannot express the suppression at all. A Lua table stores no nil -
// `t.auth = nil` removes the key - and the port has no null sentinel, so
// `auth = nil` and an omitted auth are the same value. There is nothing for
// makeOptions to detect and nothing to pin.
const AUTHNULL_INEXPRESSIBLE = ['lua']


const AUTHNULL_NOT_APPLICABLE = ['go-cli', 'go-mcp', 'py-data']


// The lists above are only worth having if something holds them to the
// templates. This scans EVERY file of every target for the suppression
// marker - never a filename - and requires each target's real state to match
// the list it is declared in.
describe('auth null coverage is honest', () => {

  // The marker every implementation uses for the captured flag, in each
  // language's casing - INCLUDING kebab-case, which is not a stylistic
  // afterthought: clojure spells it `auth-suppressed` because that is what
  // Clojure names look like, and a marker that only knew camel and snake read
  // a correctly fixed clojure template as unfixed.
  const MARKER = /auth[-_]?suppressed/i

  const TM = Path.resolve(PKG, 'project', '.sdk', 'tm')

  function allTargets(): string[] {
    return Fs.readdirSync(TM)
      .filter((n) => Fs.statSync(Path.join(TM, n)).isDirectory())
      .sort()
  }

  function bracketsValidate(src: string): boolean {
    const marks = [...src.matchAll(new RegExp(MARKER.source, 'gi'))]
      .map((m) => m.index ?? -1)
      .filter((i) => 0 <= i)

    if (marks.length < 2) {
      return false
    }

    const first = marks[0]
    const last = marks[marks.length - 1]

    return [...src.matchAll(/\bvalidate\b/gi)]
      .some((m) => first < (m.index ?? -1) && (m.index ?? -1) < last)
  }


  const AUTHNULL_FIX_SHAPE: Record<string, (src: string) => boolean> = {
  }


  // Whole-tree scan. cpp keeps this logic in utility/pipeline.hpp, so
  // anything narrower than "every file" reintroduces the
  // blind spot that made the first audit wrong.
  function carriesFix(target: string): boolean {
    const shape = AUTHNULL_FIX_SHAPE[target] || bracketsValidate

    return listFiles(Path.join(TM, target), '')
      .some((f) => {
        let src = ''
        try {
          src = Fs.readFileSync(f, 'utf8')
        }
        catch (_e) {
          return false
        }

        return shape(src)
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


  test('every target is classified', () => {
    const known = new Set([...declaredFixed(), ...declaredUnfixed()])
    const unclassified = allTargets().filter((t) => !known.has(t))

    deepStrictEqual(unclassified, [],
      'these targets appear in tm/ but in none of the auth-null lists - ' +
      'classify each as covered, uncovered, outstanding, inexpressible or ' +
      'not-applicable, and do not let a new target inherit the gap unnoticed')
  })


  test('every target declared fixed actually carries the fix', () => {
    const lying = declaredFixed().filter((t) => !carriesFix(t))

    deepStrictEqual(lying, [],
      'these targets are listed as carrying the auth-null suppression but no ' +
      'longer do - the fix was removed, or the marker renamed; either way the ' +
      'list is now describing something that is not in the templates')
  })


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


  // A custom shape is a hole punched in the default check, so it must name a
  // real target. A stale key - a target renamed or removed - is a hole that
  // guards nothing while reading as though it does.
  test('every custom fix shape names a real target', () => {
    const targets = new Set(allTargets())
    const stale = Object.keys(AUTHNULL_FIX_SHAPE).filter((t) => !targets.has(t))

    deepStrictEqual(stale, [],
      'these targets have a custom auth-null fix shape but no longer exist ' +
      'in tm/ - drop the entry rather than leave a check that matches nothing')
  })


  test('no target is declared both fixed and unfixed', () => {
    const unfixed = new Set(declaredUnfixed())
    const both = declaredFixed().filter((t) => unfixed.has(t))

    deepStrictEqual(both, [], 'these targets are declared both fixed and unfixed')
  })
})


const AUTHNULL_MODEL = `
main: kit: config: auth: { active: true, prefix: '' }
`


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
      await generateTo(lane.target, sdkroot, AUTHNULL_MODEL)

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

      if ('skip' in ran) {
        return t.skip(lane.target + ': ' + ran.skip)
      }

      if (ran.timedOut) {
        return t.skip(lane.target + ': ' + ran.out)
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


  for (const lane of CORPUS_LANES) {

    test(lane.target + ': the feature corpus executes against the generated client',
      async (t) => {
        const sdkroot = Path.join(tmp, lane.target)
        const files = await generateTo(
          lane.target, sdkroot, undefined, CORPUS_FEATURES)

        ok(null != files[lane.runner],
          'the corpus runner was not generated into the SDK: expected ' +
          lane.runner + ' among ' + Object.keys(files).length + ' files')

        writeCorpus(tmp)

        const cmd = lane.command()
        if (null == cmd) {
          return t.skip(
            'no usable ' + lane.target + ' toolchain here (' + lane.needs + ')')
        }

        const notready = null == lane.prepare ? null : lane.prepare(sdkroot)
        ok(null == notready, lane.target + ': ' + notready)

        const ran = run(cmd.bin, cmd.args, sdkroot, cmd.env)

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
        // in the same wording, precisely so this can read it - once per
        // section, so a section that silently skips still fails.
        for (const name of CORPUS_INERT) {
          ok(inertLine(name).test(ran.out),
            'the ' + lane.target + ' corpus runner did not say that ' +
            'feature.' + name + ' is inert:\n' + tail(ran.out))
        }

        for (const name of Object.keys(CORPUS_FIXTURE.feature)) {
          if (CORPUS_INERT.includes(name)) continue
          const counted = ran.out.match(ranLine(name))
          ok(null != counted,
            'the ' + lane.target + ' corpus runner did not report running ' +
            'feature.' + name + ' - it SKIPPED the section, so the generated ' +
            'client is missing the feature or has no operation the cases can ' +
            'drive:\n' + tail(ran.out))
          ok(0 < Number(counted![1]),
            'the ' + lane.target + ' corpus ran zero feature.' + name +
            ' cases:\n' + tail(ran.out))
        }
      })
  }


})


// A corpus in the shape create-sdkgen compiles: one section per shipped
// feature whose behaviour is observable from its activity record. `#OP1` is
// substituted by the runner with an operation found on the generated client.
// A feature named here must also be in CORPUS_FEATURES, or every lane skips
// the section and fails on the missing ran line.
const CORPUS_FIXTURE: { feature: Record<string, any> } = {
  feature: {
    // Not generated by the lane (see CORPUS_INERT): pins the inert line.
    audit: {
      basic: {
        set: [
          {
            name: 'an operation is recorded',
            feature: [{ name: 'audit', active: true }],
            op: [{ op: '#OP1' }],
            out: {},
          },
        ],
      },
    },
    retry: {
      basic: {
        set: [
          {
            name: 'a transient failure is retried until the transport answers',
            feature: [
              { name: 'netsim', active: true, failTimes: 2, failStatus: 503 },
              { name: 'retry', active: true, retries: 3, minDelay: 1, jitter: false },
            ],
            op: [{ op: '#OP1' }],
            out: { attempts: 2 },
          },
          {
            name: 'retries is a ceiling, and the last failure is the answer',
            feature: [
              { name: 'netsim', active: true, failTimes: 5, failStatus: 503 },
              { name: 'retry', active: true, retries: 1, minDelay: 1, jitter: false },
            ],
            op: [{ op: '#OP1', err: true }],
            out: { attempts: 1 },
          },
        ],
      },
    },
    timeout: {
      basic: {
        set: [
          {
            name: 'a transport slower than ms is a timeout error',
            feature: [
              { name: 'netsim', active: true, latency: 300 },
              { name: 'timeout', active: true, ms: 20 },
            ],
            op: [{ op: '#OP1', err: 'timeout' }],
            out: { count: 1 },
          },
        ],
      },
    },
    ratelimit: {
      basic: {
        set: [
          {
            name: 'a call past the burst waits for a token',
            feature: [{ name: 'ratelimit', active: true, rate: 5, burst: 1 }],
            op: [{ op: '#OP1' }, { op: '#OP1' }],
            out: { throttled: 1 },
          },
        ],
      },
    },
    cache: {
      basic: {
        set: [
          {
            name: 'the second identical call is served from cache',
            feature: [{ name: 'cache', active: true, ttl: 10000 }],
            op: [{ op: '#OP1' }, { op: '#OP1' }],
            out: { hit: 1, miss: 1 },
          },
        ],
      },
    },
    netsim: {
      basic: {
        set: [
          {
            name: 'a scripted failure is counted and fails the call',
            feature: [{ name: 'netsim', active: true, failTimes: 1, failStatus: 503 }],
            op: [{ op: '#OP1', err: true }],
            out: { calls: 1 },
          },
        ],
      },
    },
    paging: {
      basic: {
        set: [
          {
            name: 'a snake_case body flag is read',
            feature: [{ name: 'paging', active: true }],
            res: [{ status: 200, body: { has_more: true, next_cursor: 'c2' } }],
            op: [{ op: '#OP1' }],
            out: { last: { hasMore: true, cursor: 'c2' } },
          },
          {
            name: 'a next-page header is read',
            feature: [{ name: 'paging', active: true }],
            res: [{ status: 200, headers: { 'x-next-page': '2' }, body: [] }],
            op: [{ op: '#OP1' }],
            out: { last: { hasMore: true, nextPage: 2 } },
          },
        ],
      },
    },
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


const RESERVED_ENTITY = `
main: kit: entity: namespace: {
  alias: field: {}
  name: "namespace"
  id: { field: "id", name: "id" }
  field: {
    id:   { name: "id",   kind: "field", type: "\`$STRING\`", required: true }
    path: { name: "path", kind: "field", type: "\`$STRING\`", required: true }
  }
  fields: {
    "id": { h: 'Id', n: "id",   r: true, t: "\`$STRING\`" }
    "path": { h: 'Path', n: "path", r: true, t: "\`$STRING\`" }
  }
  op: {
    list: {
      name: "list"
      points: [ {
        g: {}, m: "GET", o: "/namespace", s: [{ lit: "namespace" }]
        t: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
  }
}

main: kit: flow: BasicNamespaceFlow: {
  entity: "namespace", kind: "basic", name: "BasicNamespaceFlow"
  step: [
    { o: "list" }
  ]
}
`


// APIs whose credential a generated test cannot name in advance. apidef takes
// the name from the spec's own security scheme, so a test asserting the
// literal `authorization` fails while the SDK places the credential rightly.

// The Basic entry selects the HTTP Basic branch, whose generated config
// carries `auth.basic: true`: a probe supplying no secret sees nothing placed
// and reads an auth-active SDK as a public one, which leaves every assertion
// after it unable to fail.

// Cookie cleanup is a separate runtime defect; the cookie model exercises
// corpus placement without running the pipeline's cleanup cases.
const CREDNAME_MODELS: {
  name: string,
  extra: string,
  targets?: string[],
  corpusOnly?: boolean,
}[] = [
  {
    name: 'a credential named by the API, not `authorization`',
    extra: `
main: kit: config: auth: { active: true, prefix: '', in: 'header', name: 'X-Api-Key' }
`,
  },
  {
    name: 'an HTTP Basic API, where a secretless probe places nothing',
    extra: `
main: kit: config: auth: { active: true, prefix: 'Basic', basic: true, in: 'header', name: 'X-Api-Key' }
`,
  },
  {
    name: 'a query credential preserves its case',
    extra: "main: kit: config: auth: { active: true, in: 'query', name: 'ApiToken' }",
    targets: ['c', 'cpp', 'rust', 'csharp'],
  },
  {
    name: 'a header named cookie is not a cookie credential',
    extra: "main: kit: config: auth: { active: true, in: 'header', name: 'cookie' }",
    targets: ['c', 'cpp', 'rust', 'csharp'],
  },
  {
    name: 'a public API places no credential',
    extra: "main: kit: config: auth: { active: false }",
    targets: ['c', 'cpp', 'rust', 'csharp'],
  },
  {
    name: 'a cookie credential retargets the corpus value',
    extra: "main: kit: config: auth: { active: true, in: 'cookie', name: 'session' }",
    targets: ['c', 'cpp', 'rust', 'csharp'],
    corpusOnly: true,
  },
]


// The prepareAuth corpus section, in the shape create-sdkgen compiles. The
// `authorization` name here is the PLACEHOLDER each runner must retarget onto
// the container and name its own API uses; a runner that reads it literally
// fails against the model above. It mirrors the shared corpus case rather
// than copying the corpus, so a changed placeholder leaves it stale.
const CREDNAME_CORPUS = {
  primary: {
    prepareAuth: {
      DEF: { setup: { a: { apikey: 'APIKEY01', auth: { basic: false, prefix: '' } } } },
      basic: {
        set: [
          {
            ctx: { spec: { headers: {} } },
            match: { ctx: { spec: { headers: { authorization: 'APIKEY01' } } } },
          },
        ],
      },
    },
  },
}


type CredNameStep = {
  corpus?: boolean,
  // What the step proves, for the failure message.
  name: string,
  cmd: () => { bin: string, args: string[], env?: NodeJS.ProcessEnv } | null,
  // A line the run must PRINT. Exit zero is not enough: a filtered run that
  // matches nothing is a fully-skipped suite, which every one of these
  // frameworks reports as a pass.
  ran: RegExp,
  // Set where the exit code cannot be read: perl's Test::More has no
  // per-test filter, so the whole primary suite runs against a fixture that
  // carries ONE section and legitimately fails the rest. The TAP line for
  // the section under test is the verdict there.
  byline?: boolean,
}

type CredNameLane = {
  target: string,
  needs: string,
  prepare?: (sdkroot: string) => string | null,
  steps: CredNameStep[],
}


const CREDNAME_LANES: CredNameLane[] = [
  {
    target: 'c',
    needs: 'make and a c compiler',
    prepare: (sdkroot) => {
      if ('win32' === process.platform) return 'the C corpus requires POSIX regex.h'
      const make = toolchain('make')
      if (null == make || null == toolchain('cc')) return 'compiler or make is unavailable'
      const built = run(make, ['tests/pipeline_test.out', 'tests/primary_corpus_test.out'], sdkroot)
      ok(built.ok, 'c credential suites did not compile:\n' + tail(built.out))
      return null
    },
    steps: [
      {
        name: 'the pipeline suite',
        cmd: () => ({ bin: './tests/pipeline_test.out', args: [] }),
        ran: /pipeline: [1-9]\d* checks, 0 failed/,
      },
      {
        name: 'the corpus prepareAuth section',
        corpus: true,
        cmd: () => ({ bin: './tests/primary_corpus_test.out', args: ['--prepare-auth'] }),
        ran: /PRIMARY CORPUS: [1-9]\d* cases in 1 sections, 0 section\(s\) FAILED/,
      },
    ],
  },
  {
    target: 'cpp',
    needs: 'make and a cpp compiler',
    prepare: (sdkroot) => {
      const make = toolchain('make')
      if (null == make || null == toolchain('c++')) return 'compiler or make is unavailable'
      const built = run(make, ['test/pipeline_test.out', 'test/primary_utility_test.out'], sdkroot)
      ok(built.ok, 'cpp credential suites did not compile:\n' + tail(built.out))
      return null
    },
    steps: [
      {
        name: 'the pipeline suite',
        cmd: () => ({ bin: './test/pipeline_test.out', args: [] }),
        ran: /[1-9]\d* checks, 0 failures/,
      },
      {
        name: 'the corpus prepareAuth section',
        corpus: true,
        cmd: () => ({ bin: './test/primary_utility_test.out', args: ['--prepare-auth'] }),
        ran: /1 tests, [1-9]\d* checks, 0 failures/,
      },
    ],
  },
  {
    target: 'csharp',
    needs: 'dotnet',
    steps: [
      ...['PipelineTest.PrepareAuth', 'PrimaryUtilityTest.PrepareAuthBasic'].map((filter) => ({
        name: filter,
        corpus: filter.startsWith('PrimaryUtilityTest'),
        cmd: () => {
          const dotnet = toolchain('dotnet')
          return null == dotnet ? null : {
            bin: dotnet,
            args: ['test', 'test/DemoSDKTest.csproj', '--nologo', '-v', 'quiet', '--filter', 'FullyQualifiedName~' + filter],
          }
        },
        ran: /Passed!\s+-\s+Failed:\s+0,\s+Passed:\s+[1-9]\d*,\s+Skipped:\s+0/,
      })),
    ],
  },
  {
    target: 'rust',
    needs: 'cargo',
    steps: [
      {
        name: 'the pipeline suite',
        cmd: () => {
          const cargo = toolchain('cargo')
          return null == cargo ? null : { bin: cargo, args: ['test', '--test', 'pipeline_test', 'pipeline_prepare_auth'] }
        },
        ran: /test result: ok\. [1-9]\d* passed; 0 failed/,
      },
      {
        name: 'the corpus prepareAuth section',
        corpus: true,
        cmd: () => {
          const cargo = toolchain('cargo')
          return null == cargo ? null : { bin: cargo, args: ['test', '--test', 'primary_utility_test', 'primary_prepare_auth_basic'] }
        },
        ran: /test result: ok\. 1 passed; 0 failed/,
      },
    ],
  },
  {
    target: 'ts',
    needs: 'the local typescript (run `npm install`)',
    prepare: (sdkroot) => {
      linkDeps(sdkroot)
      if (!Fs.existsSync(TSC)) return 'typescript is not installed here'
      const src = tsc(sdkroot, 'src')
      if (!src.ok) return 'generated src does not compile:\n' + tail(src.out)
      const suite = tsc(sdkroot, 'test')
      return suite.ok
        ? null
        : 'the generated test suite does not compile:\n' + tail(suite.out)
    },
    steps: [
      {
        name: 'the pipeline suite',
        cmd: () => Fs.existsSync(TSC)
          ? {
            bin: process.execPath,
            args: ['--test', '--test-reporter=tap',
              Path.join('dist-test', 'pipeline.test.js')],
            env: nestedTestEnv(),
          }
          : null,
        ran: /^\s*ok \d+ - pipeline:prepareAuth/m,
      },
      {
        name: 'the corpus prepareAuth section',
        cmd: () => Fs.existsSync(TSC)
          ? {
            bin: process.execPath,
            args: ['--test', '--test-reporter=tap', '--test-name-pattern=auth-basic',
              Path.join('dist-test', 'utility', 'PrimaryUtility.test.js')],
            env: nestedTestEnv(),
          }
          : null,
        ran: /^\s*ok \d+ - auth-basic/m,
      },
    ],
  },
  {
    target: 'js',
    needs: 'node',
    prepare: (sdkroot) => {
      linkDeps(sdkroot)
      return null
    },
    steps: [
      {
        name: 'the pipeline suite',
        cmd: () => ({
          bin: process.execPath,
          args: ['--test', '--test-reporter=tap', Path.join('test', 'pipeline.test.js')],
          env: nestedTestEnv(),
        }),
        ran: /^\s*ok \d+ - pipeline:prepareAuth/m,
      },
      {
        name: 'the corpus prepareAuth section',
        cmd: () => ({
          bin: process.execPath,
          args: ['--test', '--test-reporter=tap', '--test-name-pattern=auth-basic',
            Path.join('test', 'utility', 'PrimaryUtility.test.js')],
          env: nestedTestEnv(),
        }),
        ran: /^\s*ok \d+ - auth-basic/m,
      },
    ],
  },
  {
    target: 'go',
    needs: 'go',
    steps: [
      {
        name: 'the pipeline suite',
        cmd: () => {
          const go = toolchain('go')
          return null == go ? null : {
            bin: go,
            args: ['test', './test/', '-run', 'TestPipelinePrepareAuth', '-v'],
          }
        },
        ran: /--- PASS: TestPipelinePrepareAuth\b/,
      },
      {
        name: 'the corpus prepareAuth section',
        cmd: () => {
          const go = toolchain('go')
          return null == go ? null : {
            bin: go,
            args: ['test', './test/', '-run',
              'TestPrimaryUtility/prepareAuth-basic', '-v'],
          }
        },
        ran: /--- PASS: TestPrimaryUtility\/prepareAuth-basic/,
      },
    ],
  },
  {
    target: 'py',
    needs: 'python3 with pytest',
    steps: [
      {
        name: 'the pipeline suite',
        cmd: () => pytest(['test/test_pipeline.py', '-k', 'PrepareAuth', '-q']),
        ran: /(\d+) passed/,
      },
      {
        name: 'the corpus prepareAuth section',
        cmd: () => pytest(['test/test_primary_utility.py', '-k', 'prepare_auth', '-q']),
        ran: /1 passed/,
      },
    ],
  },
  {
    target: 'rb',
    needs: 'ruby with minitest',
    steps: [
      {
        name: 'the pipeline suite',
        cmd: () => minitest(['test/pipeline_test.rb', '-n', '/prepare_auth/']),
        ran: /[1-9]\d* runs, \d+ assertions, 0 failures, 0 errors/,
      },
      {
        name: 'the corpus prepareAuth section',
        cmd: () => minitest(['test/primary_utility_test.rb', '-n', 'test_prepare_auth_basic']),
        ran: /1 runs, \d+ assertions, 0 failures, 0 errors/,
      },
    ],
  },
  {
    target: 'php',
    needs: 'php with phpunit (on PATH, or PHPUNIT=<path to phpunit.phar>)',
    steps: [
      {
        name: 'the pipeline suite',
        cmd: () => phpunit(['--filter', 'prepare_auth', 'test/PipelineTest.php']),
        ran: /OK \([1-9]\d* tests?/,
      },
      {
        name: 'the corpus prepareAuth section',
        cmd: () => phpunit(['--filter', 'test_prepare_auth_basic', 'test/PrimaryUtilityTest.php']),
        ran: /OK \(1 test/,
      },
    ],
  },
  {
    target: 'lua',
    needs: 'lua with busted',
    steps: [
      {
        name: 'the pipeline suite',
        // busted's --filter is a LUA PATTERN, where `-` is a quantifier, so
        // the section name is given without its `-basic` suffix.
        cmd: () => busted(['--filter', 'prepareAuth', 'test/pipeline_test.lua']),
        ran: /[1-9]\d* success(es)? \/ 0 failures \/ 0 errors/,
      },
      {
        name: 'the corpus prepareAuth section',
        cmd: () => busted(['--filter', 'prepareAuth', 'test/primary_utility_test.lua']),
        ran: /1 success \/ 0 failures \/ 0 errors/,
      },
    ],
  },
  {
    target: 'perl',
    needs: 'perl',
    steps: [
      {
        name: 'the pipeline suite',
        cmd: () => {
          const perl = toolchain('perl')
          return null == perl ? null : { bin: perl, args: ['-Ilib', 't/pipeline.t'] }
        },
        ran: /^ok \d+ - prepare_auth places the apikey where this API puts it/m,
      },
      {
        name: 'the corpus prepareAuth section',
        cmd: () => {
          const perl = toolchain('perl')
          return null == perl
            ? null
            : { bin: perl, args: ['-Ilib', 't/primary_utility.t'] }
        },
        ran: /^ok \d+ - prepareAuth\.basic/m,
        byline: true,
      },
    ],
  },
  {
    target: 'java',
    needs: 'java and maven',
    steps: [
      {
        name: 'the pipeline suite',
        cmd: () => maven(['-Dtest=PipelineTest#prepareAuth_*']),
        ran: /Tests run: [1-9]\d*, Failures: 0, Errors: 0/,
      },
      {
        name: 'the corpus prepareAuth section',
        cmd: () => maven(['-Dtest=PrimaryUtilityTest#prepareAuthBasic']),
        ran: /Tests run: 1, Failures: 0, Errors: 0/,
      },
    ],
  },
]


function pytest(args: string[]) {
  const py = toolchain('python3') || toolchain('python')
  if (null == py) return null
  if (!probeOk(py, ['-m', 'pytest', '--version'])) return null
  return { bin: py, args: ['-m', 'pytest', ...args] }
}


function minitest(args: string[]) {
  const rb = toolchain('ruby')
  if (null == rb) return null
  if (!probeOk(rb, ['-e', 'require "minitest/autorun"'])) return null
  return { bin: rb, args }
}


function phpunit(args: string[]) {
  const php = toolchain('php')
  if (null == php) return null
  const phar = process.env.PHPUNIT
  if (null != phar && '' !== phar && Fs.existsSync(phar)) {
    return { bin: php, args: [phar, '--no-configuration', ...args] }
  }
  const bin = toolchain('phpunit')
  return null == bin ? null : { bin, args: ['--no-configuration', ...args] }
}


function busted(args: string[]) {
  const bin = toolchain('busted')
  return null == bin ? null : { bin, args }
}


// NOT `-q`, unlike the feature-corpus lane: that one reads a line the
// generated runner prints itself, while this one reads surefire's
// `Tests run:` summary, which quiet mode suppresses.
function maven(args: string[]) {
  const mvn = toolchain('mvn')
  if (null == mvn || null == toolchain('java')) return null
  return { bin: mvn, args: ['-B', 'test', ...args, '-DfailIfNoSpecifiedTests=false'] }
}


// A generated test that asserts the literal `authorization` passes here
// while every consumer whose API names its credential otherwise gets a red
// suite. These lanes close that gap: generate an SDK whose credential is not
// named `authorization`, then run the shipped tests against it.
describe('generated auth tests discover the credential name', () => {

  let tmp = ''
  let cwd = ''

  before(() => {
    cwd = process.cwd()
    tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-credname-'))
    const testdir = Path.join(tmp, '.sdk', 'test')
    Fs.mkdirSync(testdir, { recursive: true })
    Fs.writeFileSync(Path.join(testdir, 'test.json'),
      JSON.stringify(CREDNAME_CORPUS, null, 2))
  })

  after(() => {
    if ('' !== cwd) process.chdir(cwd)
    if ('' !== tmp) Fs.rmSync(tmp, { recursive: true, force: true })
  })

  for (const lane of CREDNAME_LANES) {
    for (const model of CREDNAME_MODELS) {
      if (model.targets && !model.targets.includes(lane.target)) continue

    test(lane.target + ': ' + model.name,
      async (t) => {
        const sdkroot = Path.join(tmp, lane.target)
        const corpus = structuredClone(CREDNAME_CORPUS)
        if (['c', 'cpp', 'rust', 'csharp'].includes(lane.target)) {
          const entry = corpus.primary.prepareAuth.basic.set[0]
          for (const spec of [entry.ctx.spec, entry.match.ctx.spec]) {
            Object.assign(spec.headers, { 'x-extra': 'header' })
            Object.assign(spec, { query: { keep: 'query' } })
          }
        }
        Fs.writeFileSync(Path.join(tmp, '.sdk', 'test', 'test.json'), JSON.stringify(corpus))
        Fs.rmSync(sdkroot, { recursive: true, force: true })
        await generateTo(lane.target, sdkroot, model.extra)

        const steps = lane.steps.filter((step) => !model.corpusOnly || step.corpus)
        ok(0 < steps.length, lane.target + ': no credential checks selected')
        const cmds = steps.map((step) => step.cmd())
        if (cmds.some((cmd) => null == cmd)) {
          return t.skip(
            'no usable ' + lane.target + ' toolchain here (' + lane.needs + ')')
        }

        const notready = null == lane.prepare ? null : lane.prepare(sdkroot)
        if (null != notready) {
          return t.skip(lane.target + ': ' + notready)
        }

        for (let at = 0; at < steps.length; at++) {
          const step = steps[at]
          const cmd = cmds[at]!
          const ran = run(cmd.bin, cmd.args, sdkroot, cmd.env)

          if (ran.unlaunchable) {
            return t.skip(lane.target + ': the toolchain could not be started ' +
              'here: ' + tail(ran.out, 3))
          }

          const gap = UNUSABLE.find((re) => re.test(ran.out))
          if (null != gap && !ran.ok) {
            return t.skip(lane.target + ': toolchain present but not usable (' +
              gap.source + '):\n' + tail(ran.out))
          }

          ok(true === step.byline || ran.ok,
            lane.target + ': ' + step.name + ' FAILED for ' + model.name +
            ' - the generated test names the credential instead of reading ' +
            'where prepareAuth put it:\n' + tail(ran.out))

          ok(step.ran.test(ran.out),
            lane.target + ': ' + step.name + ' did not report a passing ' +
            'prepareAuth case (' + step.ran.source + ') - it matched nothing ' +
            'and skipped, which every one of these frameworks exits zero ' +
            'for:\n' + tail(ran.out))
        }
      })
    }
  }

})
