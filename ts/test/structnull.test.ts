// What each vendored struct does with a STORED null — pinned per port.
//
// WHY THIS EXISTS
//
// `auth: null` is the documented way to suppress auth outright, and the bug
// family it produced across a dozen targets came from one question nothing
// asked: when a key is present and holds a JSON null, is that "no value" or
// is it a value? Every port answers, none was asked, and they do not agree.
//
// They do not agree TODAY, in this tree:
//
//   port   stamp    getprop({x:null},'x','ALT')   haskey   validate({auth:null},…)
//   ────   ──────   ───────────────────────────   ──────   ───────────────────────
//   go     0.1.3    'ALT'                         false    returns the default
//   py     —        'ALT'                         false    returns the default
//   perl   —        'ALT'                         false    returns the default
//   js     0.3.2    'ALT'                         false    returns the default
//   rb     —        null                          true     returns the default
//   php    —        null                          true     THROWS
//
// Still three behaviours, now across six ports. js used to be the sixth row
// of the bottom group, on struct 0.0.10, which put it and `ts` (0.3.2) - the
// two targets every other language is held in parity WITH - in DIFFERENT
// classes. Resyncing js's vendored struct to the same commit ts came from is
// what moved it, and this test is what noticed: the row above was written
// from the old measurement and failed the moment the file changed.
//
// The remaining split is not subtle; it is the direct cause of the two
// auth-null failure modes catalogued in the migration guide. Where validate
// returns the default, the suppression silently becomes "use the default
// auth" and the withheld credential goes out (fail-open). Where it throws,
// construction dies instead (fail-closed).
//
// WHY THE SHARED CORPUS CANNOT DO THIS
//
// The corpus runs `minor.getprop` and `minor.haskey` on every port and sees
// none of it, because not one case stores a null: every entry is either an
// absent key or a non-null value. A case that DID store one would go red on
// half the tree - correctly, but it would gate the corpus on finishing the
// struct migration everywhere first. So the divergence is pinned HERE, per
// port, at its current value, and the corpus keeps its job.
//
// This is a CHARACTERIZATION test. The table is not a statement that these
// answers are right - three of them are on their way out. It fails when an
// answer CHANGES, which is the point: a resync that quietly moves a port
// between classes moves it between auth-null failure modes too, and the
// vendored signature pin next door cannot see a behaviour change at all.
//
// FORMER KNOWN DEFECT, now resynced away
//
// py used to answer correctly for a MAP and incorrectly for a LIST:
// `getprop([null], 0, 'ALT')` handed back the null where canonical gives
// 'ALT' (its list branch did `return val[key]`, an early return skipping
// the null rule). The tag resync (sdk-20260904-1610-0, struct python
// 0.1.1) brought upstream's isnode-shaped getprop, and the list case now
// answers 'ALT' — measured at the resync, and pinned by create-sdkgen's
// opt-in `struct/nullsem.aon` corpus section, which py can now opt into.
// py's MAP-question class below is unchanged by the resync.

import { test, describe, before, after } from 'node:test'
import { strictEqual } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import { spawnSync } from 'node:child_process'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


function toolchain(name: string): string | null {
  const res = spawnSync(name, ['--version'], { encoding: 'utf8' })
  return null == res.error ? name : null
}


// Bounded, and SIGKILL rather than the default SIGTERM: the go probe starts a
// toolchain that spawns children of its own, and a TERMed parent can return
// while they keep the runner. spawnSync blocks the only node thread, so a
// child that never exits takes the whole job down with it - which is what the
// gradle lane next door did on windows-latest.
function run(cmd: string, args: string[], cwd?: string) {
  const res = spawnSync(cmd, args,
    { encoding: 'utf8', cwd, timeout: 120000, killSignal: 'SIGKILL' })
  return {
    ok: 0 === res.status,
    out: (res.stdout || '') + (res.stderr || ''),
  }
}


// The three questions, as one line each, in a format every language can print
// without a JSON encoder: parsing `getprop=alt` is the same work in six
// languages and cannot disagree about how to spell `null`.
type Answers = {
  // Does getprop hand back the ALT (a stored null counts as "no value") or
  // the null itself (a stored null is a value)?
  getprop: 'alt' | 'null',

  // Does a key holding a null count as present?
  haskey: 'true' | 'false',

  // And the case that started this: validating {auth: null} against a spec
  // whose `auth` carries a default.
  validate: 'default' | 'throws',
}


const PORTS: {
  target: string,
  stamp: string,
  needs: string,
  answers: Answers,
  exec: (tmp: string) => { ok: boolean, out: string } | null,
}[] = [
  {
    target: 'py',
    stamp: '0.1.1',
    needs: 'python3',
    answers: { getprop: 'alt', haskey: 'false', validate: 'default' },
    exec: () => {
      const py = toolchain('python3') || toolchain('python')
      if (null == py) return null

      // -B, or importing from the template tree writes a __pycache__ INTO the
      // shipped scaffold - which then ships, until junk.test.ts catches it.
      return run(py, ['-B', '-c', `
import sys
sys.path.insert(0, ${JSON.stringify(Path.join(TM, 'py', 'pkg', 'utility'))})
import voxgig_struct as S
print('getprop=' + ('alt' if 'ALT' == S.getprop({'x': None}, 'x', 'ALT') else 'null'))
print('haskey=' + ('true' if S.haskey({'x': None}, 'x') else 'false'))
try:
    S.validate({'auth': None}, {'auth': {'prefix': ''}})
    print('validate=default')
except Exception:
    print('validate=throws')
`])
    },
  },
  {
    target: 'perl',
    stamp: '0.1.1',
    needs: 'perl',
    answers: { getprop: 'alt', haskey: 'false', validate: 'default' },
    exec: () => {
      const pl = toolchain('perl')
      if (null == pl) return null
      // perl models JSON null as a blessed singleton, not undef, so the
      // stored null has to be JNULL - `undef` would be a different question.
      return run(pl, ['-e', `
use lib ${JSON.stringify(Path.join(TM, 'perl', 'lib'))};
use Voxgig::Struct;
my $N = Voxgig::Struct::JNULL();
my $g = Voxgig::Struct::getprop({x => $N}, 'x', 'ALT');
print 'getprop=', ((defined $g && "$g" eq 'ALT') ? 'alt' : 'null'), "\\n";
print 'haskey=', (Voxgig::Struct::haskey({x => $N}, 'x') ? 'true' : 'false'), "\\n";
my $r = eval { Voxgig::Struct::validate({auth => $N}, {auth => {prefix => ''}}) };
print 'validate=', ($@ ? 'throws' : 'default'), "\\n";
`])
    },
  },
  {
    target: 'rb',
    stamp: 'unstamped',
    needs: 'ruby',
    answers: { getprop: 'null', haskey: 'true', validate: 'default' },
    exec: () => {
      const rb = toolchain('ruby')
      if (null == rb) return null
      return run(rb, ['-e', `
require ${JSON.stringify(Path.join(TM, 'rb', 'utility', 'struct', 'voxgig_struct'))}
S = VoxgigStruct
puts 'getprop=' + ('ALT' == S.getprop({'x' => nil}, 'x', 'ALT') ? 'alt' : 'null')
puts 'haskey=' + (S.haskey({'x' => nil}, 'x') ? 'true' : 'false')
begin
  S.validate({'auth' => nil}, {'auth' => {'prefix' => ''}})
  puts 'validate=default'
rescue StandardError
  puts 'validate=throws'
end
`])
    },
  },
  {
    target: 'php',
    stamp: 'unstamped',
    needs: 'php',
    answers: { getprop: 'null', haskey: 'true', validate: 'throws' },
    exec: () => {
      const php = toolchain('php')
      if (null == php) return null
      return run(php, ['-r', `
require ${JSON.stringify(Path.join(TM, 'php', 'utility', 'struct', 'Struct.php'))};
use Voxgig\\Struct\\Struct;
echo 'getprop=' . ('ALT' === Struct::getprop(['x' => null], 'x', 'ALT') ? 'alt' : 'null') . PHP_EOL;
echo 'haskey=' . (Struct::haskey(['x' => null], 'x') ? 'true' : 'false') . PHP_EOL;
try {
  Struct::validate(['auth' => null], ['auth' => ['prefix' => '']]);
  echo 'validate=default' . PHP_EOL;
}
catch (\\Throwable $e) { echo 'validate=throws' . PHP_EOL; }
`])
    },
  },
  {
    // The go/py READER class combined with the php VALIDATE class - a
    // combination no other port pins: getprop/haskey answer the new way
    // while validate on a stored null THROWS (fail-closed). Resynced to
    // struct 0.1.1 at the vendor tag.
    target: 'csharp',
    stamp: '0.1.1',
    needs: 'dotnet',
    answers: { getprop: 'alt', haskey: 'false', validate: 'throws' },
    exec: (tmp) => {
      const dotnet = toolchain('dotnet')
      if (null == dotnet) return null

      const dir = Path.join(tmp, 'csharp')
      Fs.mkdirSync(dir, { recursive: true })
      Fs.copyFileSync(
        Path.join(TM, 'csharp', 'utility', 'struct', 'Struct.cs'),
        Path.join(dir, 'Struct.cs'))
      Fs.writeFileSync(Path.join(dir, 'probe.csproj'), `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName>probe</AssemblyName>
  </PropertyGroup>
</Project>
`)
      Fs.writeFileSync(Path.join(dir, 'Program.cs'), `using Voxgig.Struct;

var m = new Dictionary<string, object?> { ["x"] = null };
Console.WriteLine("getprop=" +
  ("ALT" == StructUtils.GetProp(m, "x", "ALT") as string ? "alt" : "null"));
Console.WriteLine("haskey=" + (StructUtils.HasKey(m, "x") ? "true" : "false"));
try
{
  StructUtils.Validate(
    new Dictionary<string, object?> { ["auth"] = null },
    new Dictionary<string, object?> {
      ["auth"] = new Dictionary<string, object?> { ["prefix"] = "" } });
  Console.WriteLine("validate=default");
}
catch (Exception)
{
  Console.WriteLine("validate=throws");
}
`)
      return run(dotnet, ['run', '--project', dir, '-v', 'q', '--nologo'], dir)
    },
  },
  {
    // The REFERENCE target's own vendored copy, which the first pass never
    // rowed — "add a row per newly vendored struct port" literally applies
    // here. TypeScript is transpiled in-process with the repo's own
    // compiler; no toolchain beyond node is needed.
    target: 'ts',
    stamp: '0.3.4',
    needs: 'node (always present - this suite runs on it)',
    answers: { getprop: 'alt', haskey: 'false', validate: 'default' },
    exec: (tmp) => {
      // Node >=23.6 strips erasable TS syntax from FILES natively, which
      // is exactly enough for the vendored utility (typescript-the-package
      // is v7 here and no longer exposes transpileModule).
      const dir = Fs.mkdtempSync(Path.join(tmp || Os.tmpdir(), 'structnull-ts-'))
      Fs.copyFileSync(
        Path.join(TM, 'ts', 'src', 'utility', 'StructUtility.ts'),
        Path.join(dir, 'StructUtility.ts'))
      const probe = `
import { getprop, haskey, validate } from './StructUtility.ts'
console.log('getprop=' + ('ALT' === getprop({x: null}, 'x', 'ALT') ? 'alt' : 'null'))
console.log('haskey=' + (haskey({x: null}, 'x') ? 'true' : 'false'))
try {
  validate({auth: null}, {auth: {prefix: ''}})
  console.log('validate=default')
}
catch (e) { console.log('validate=throws') }
`
      Fs.writeFileSync(Path.join(dir, 'probe.ts'), probe)
      return run(process.execPath, [Path.join(dir, 'probe.ts')])
    },
  },
  {
    target: 'js',
    stamp: '0.1.4 (0.3.x behaviour)',
    needs: 'node (always present - this suite runs on it)',
    answers: { getprop: 'alt', haskey: 'false', validate: 'default' },
    exec: () => {
      return run(process.execPath, ['-e', `
const S = require(${JSON.stringify(Path.join(TM, 'js', 'src', 'utility', 'StructUtility.js'))})
console.log('getprop=' + ('ALT' === S.getprop({x: null}, 'x', 'ALT') ? 'alt' : 'null'))
console.log('haskey=' + (S.haskey({x: null}, 'x') ? 'true' : 'false'))
try {
  S.validate({auth: null}, {auth: {prefix: ''}})
  console.log('validate=default')
}
catch (e) { console.log('validate=throws') }
`])
    },
  },
  {
    target: 'go',
    stamp: '0.1.0',
    needs: 'go',
    answers: { getprop: 'alt', haskey: 'false', validate: 'default' },
    exec: (tmp) => {
      const go = toolchain('go')
      if (null == go) return null

      // go needs a module around the vendored file. Built here rather than
      // in the target's own module so this asks about the VENDORED COPY and
      // nothing else the target pulls in.
      const dir = Path.join(tmp, 'go')
      Fs.mkdirSync(Path.join(dir, 'struct'), { recursive: true })
      Fs.copyFileSync(
        Path.join(TM, 'go', 'utility', 'struct', 'voxgigstruct.go'),
        Path.join(dir, 'struct', 'voxgigstruct.go'))
      Fs.writeFileSync(Path.join(dir, 'go.mod'), 'module structnull\n\ngo 1.21\n')
      Fs.writeFileSync(Path.join(dir, 'main.go'), `package main

import (
	"fmt"

	vs "structnull/struct"
)

func main() {
	m := map[string]any{"x": nil}
	if s, ok := vs.GetProp(m, "x", "ALT").(string); ok && "ALT" == s {
		fmt.Println("getprop=alt")
	} else {
		fmt.Println("getprop=null")
	}
	if vs.HasKey(m, "x") {
		fmt.Println("haskey=true")
	} else {
		fmt.Println("haskey=false")
	}
	_, err := vs.Validate(map[string]any{"auth": nil},
		map[string]any{"auth": map[string]any{"prefix": ""}})
	if nil == err {
		fmt.Println("validate=default")
	} else {
		fmt.Println("validate=throws")
	}
}
`)
      return run(go, ['run', '.'], dir)
    },
  },
]


describe('vendored struct null semantics', () => {

  let tmp = ''

  before(() => {
    tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-structnull-'))
  })

  after(() => {
    if ('' !== tmp) Fs.rmSync(tmp, { recursive: true, force: true })
  })


  for (const port of PORTS) {

    test(port.target + ': a stored null still means what it meant', (t) => {
      const ran = port.exec(tmp)
      if (null == ran) {
        return t.skip('no usable ' + port.target + ' toolchain here (' +
          port.needs + ')')
      }

      // A probe that CRASHED must not read as a changed answer: the parse
      // below would just find no lines and report every field as missing,
      // which sends the reader looking at struct rather than at the probe.
      strictEqual(ran.ok, true,
        port.target + ': the null-semantics probe did not run:\n' + ran.out)

      const got: Record<string, string> = {}
      for (const line of ran.out.split('\n')) {
        const at = line.indexOf('=')
        if (0 < at) got[line.slice(0, at).trim()] = line.slice(at + 1).trim()
      }

      // Compared as one object so a failure prints all three at once: which
      // fields moved together is what says whether a port changed CLASS or
      // just drifted on one question.
      strictEqual(
        JSON.stringify({
          getprop: got.getprop, haskey: got.haskey, validate: got.validate,
        }),
        JSON.stringify(port.answers),
        port.target + ' (vendored ' + port.stamp + ') changed how it treats a ' +
        'STORED null. That moves it between auth-null failure modes - see the ' +
        'table at the top of this file. If the change is an intended resync, ' +
        'update the row AND check makeOptions/prepareAuth for that target ' +
        'still suppress. Probe output:\n' + ran.out)
    })
  }


  // The pin is only worth having if it covers the ports whose disagreement it
  // documents. Without this, deleting a row silently shrinks the table to the
  // ports that happen to agree.
  test('every port in the documented table has a row', () => {
    const documented = ['go', 'py', 'perl', 'rb', 'php', 'js', 'ts', 'csharp'].sort()
    const rows = PORTS.map((p) => p.target).sort()

    strictEqual(JSON.stringify(rows), JSON.stringify(documented),
      'the table at the top of this file and the PORTS list have diverged')
  })
})
