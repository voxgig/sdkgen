// What each vendored struct does with an OPTIONAL key the caller OMITTED —
// pinned per port.
//
// WHY THIS EXISTS
//
// The generated option spec (helpers/optspec) names every feature the target
// carries and gives each one the union
//
//   ['`$ONE`', <that feature's option spec>, '`$NIL`']
//
// because a spec value is also the value validate INSERTS when the key is
// absent. A bare map there would put an entry in `options.feature` for every
// feature the MODEL declares, not the ones the CALLER asked for — and
// `makeOptions` derives the feature ADD ORDER from that map's keys. The union
// is what keeps an omitted feature omitted.
//
// It only does that where the port agrees on what "omitted" means. Three did
// not, each in its own way, and none of it was visible until the spec started
// naming features:
//
//   go   materialised the whole entry, `$OPEN` marker and all, because it
//        wrote the trial result through a held grandparent with SetProp,
//        which deliberately preserves nil where setval deletes.
//   rb   left a nil-valued key, because setval carries a special case that
//        SETS nil in the grandparent branch where ts deletes in both.
//   php  wrote with ancestor `2` where ts uses `-2`, so it resurrected the
//        key AND invented a synthetic sibling carrying the trial store.
//
// All three are patched in place (see ts/test/vendored.test.ts's table) and
// this is what holds them. It is the same discipline as structnull.test.ts
// next door: a question every port answers, that nothing else asks.
//
// Unlike that file this is NOT a characterization test. There is one right
// answer — ts's, which is the reference — and a port that gives a different
// one is broken, not merely different.

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


function run(cmd: string, args: string[], cwd?: string) {
  const res = spawnSync(cmd, args,
    { encoding: 'utf8', cwd, timeout: 120000, killSignal: 'SIGKILL' })
  return {
    ok: 0 === res.status,
    out: (res.stdout || '') + (res.stderr || ''),
  }
}


// THE SPEC, as JSON, shaped like the generated option spec's `feature`
// block: the generic `$CHILD` entry the shipped spec has always had, plus one
// NAMED optional entry.
//
// Written to a FILE and read by every probe, rather than pasted into each
// one's source. Not only so six copies cannot drift: the sentinels are
// `$`-prefixed, and php and perl both INTERPOLATE `$CHILD` inside a
// double-quoted literal — the spec arrived with every sentinel blanked, and
// the probe then measured nothing.
const SPEC_JSON = JSON.stringify({
  feature: {
    '`$CHILD`': { '`$OPEN`': true, active: false },
    log: ['`$ONE`', {
      '`$OPEN`': true,
      active: ['`$ONE`', '`$BOOLEAN`', '`$NIL`'],
      level: ['`$ONE`', '`$STRING`', '`$NIL`'],
    }, '`$NIL`'],
  },
})


// Two lines, in a format every language can print without a JSON encoder.
// The keys are sorted and comma-joined, so `absent=` is the empty answer and
// `absent=log` is the defect.
type Answers = {
  // Validating `{}`: the omitted `log` entry must not appear.
  absent: string,

  // Validating `{feature: {log: {active: true}}}`: the union must still
  // accept a supplied entry. Without this half a port could "pass" by
  // dropping the key unconditionally.
  supplied: string,
}


const EXPECTED: Answers = { absent: '', supplied: 'log' }


const PORTS: {
  target: string,
  needs: string,
  exec: (tmp: string, spec: string) => { ok: boolean, out: string } | null,
}[] = [
  {
    target: 'ts',
    needs: 'node (always present - this suite runs on it)',
    exec: (tmp, spec) => {
      const dir = Fs.mkdtempSync(Path.join(tmp || Os.tmpdir(), 'oneabsence-ts-'))
      Fs.copyFileSync(
        Path.join(TM, 'ts', 'src', 'utility', 'StructUtility.ts'),
        Path.join(dir, 'StructUtility.ts'))
      Fs.writeFileSync(Path.join(dir, 'probe.ts'), `
import Fs from 'node:fs'
import { validate } from './StructUtility.ts'
const SRC = Fs.readFileSync(${JSON.stringify(spec)}, 'utf8')
const spec = () => JSON.parse(SRC)
const keys = (d: any) => {
  const out: any = validate(d, spec())
  return Object.keys(out.feature || {}).sort().join(',')
}
console.log('absent=' + keys({}))
console.log('supplied=' + keys({feature: {log: {active: true}}}))
`)
      return run(process.execPath, [Path.join(dir, 'probe.ts')])
    },
  },
  {
    target: 'js',
    needs: 'node (always present - this suite runs on it)',
    exec: (_tmp, spec) => run(process.execPath, ['-e', `
const Fs = require('node:fs')
const S = require(${JSON.stringify(Path.join(TM, 'js', 'src', 'utility', 'StructUtility.js'))})
const SRC = Fs.readFileSync(${JSON.stringify(spec)}, 'utf8')
const spec = () => JSON.parse(SRC)
const keys = (d) => Object.keys((S.validate(d, spec()) || {}).feature || {}).sort().join(',')
console.log('absent=' + keys({}))
console.log('supplied=' + keys({feature: {log: {active: true}}}))
`]),
  },
  {
    target: 'py',
    needs: 'python3',
    exec: (_tmp, spec) => {
      const py = toolchain('python3') || toolchain('python')
      if (null == py) return null
      // -B, or importing from the template tree writes a __pycache__ INTO
      // the shipped scaffold (structnull.test.ts records the same rule).
      return run(py, ['-B', '-c', `
import sys, json
sys.path.insert(0, ${JSON.stringify(Path.join(TM, 'py', 'pkg', 'utility'))})
from voxgig_struct import validate
SRC = open(${JSON.stringify(spec)}).read()
def keys(d):
    out = validate(d, json.loads(SRC))
    f = (out or {}).get('feature') or {}
    return ','.join(sorted(f.keys()))
print('absent=' + keys({}))
print('supplied=' + keys({'feature': {'log': {'active': True}}}))
`])
    },
  },
  {
    target: 'perl',
    needs: 'perl',
    exec: (_tmp, spec) => {
      const pl = toolchain('perl')
      if (null == pl) return null
      return run(pl, ['-e', `
use lib ${JSON.stringify(Path.join(TM, 'perl', 'lib'))};
use Voxgig::Struct;
open(my $fh, '<', ${JSON.stringify(spec)}) or die $!;
my $SRC = do { local $/; <$fh> };
close $fh;
sub keys_of {
  my ($d) = @_;
  my $out = Voxgig::Struct::validate($d, Voxgig::Struct::parse_json($SRC));
  my $f = (ref($out) eq 'HASH' && ref($out->{feature}) eq 'HASH') ? $out->{feature} : {};
  return join(',', sort keys %$f);
}
print 'absent=', keys_of({}), "\\n";
print 'supplied=', keys_of({feature => {log => {active => Voxgig::Struct::JTRUE()}}}), "\\n";
`])
    },
  },
  {
    target: 'rb',
    needs: 'ruby',
    exec: (_tmp, spec) => {
      const rb = toolchain('ruby')
      if (null == rb) return null
      return run(rb, ['-e', `
require 'json'
require ${JSON.stringify(Path.join(TM, 'rb', 'utility', 'struct', 'voxgig_struct'))}
SRC = File.read(${JSON.stringify(spec)})
def keys_of(d)
  out = VoxgigStruct.validate(d, JSON.parse(SRC))
  f = (out.is_a?(Hash) && out['feature'].is_a?(Hash)) ? out['feature'] : {}
  f.keys.sort.join(',')
end
puts 'absent=' + keys_of({})
puts 'supplied=' + keys_of({'feature' => {'log' => {'active' => true}}})
`])
    },
  },
  {
    target: 'php',
    needs: 'php',
    exec: (_tmp, spec) => {
      const php = toolchain('php')
      if (null == php) return null
      return run(php, ['-r', `
require ${JSON.stringify(Path.join(TM, 'php', 'utility', 'struct', 'Struct.php'))};
$SRC = file_get_contents(${JSON.stringify(spec)});
function keys_of($SRC, $d) {
  $out = \\Voxgig\\Struct\\Struct::validate($d, json_decode($SRC, true));
  $f = is_array($out) && isset($out['feature']) && is_array($out['feature'])
    ? $out['feature'] : [];
  $k = array_keys($f);
  sort($k);
  return implode(',', $k);
}
echo 'absent=' . keys_of($SRC, []) . PHP_EOL;
echo 'supplied=' . keys_of($SRC, ['feature' => ['log' => ['active' => true]]]) . PHP_EOL;
`])
    },
  },
  {
    target: 'csharp',
    needs: 'dotnet',
    exec: (tmp, spec) => {
      const dotnet = toolchain('dotnet')
      if (null == dotnet) return null

      // A project around the VENDORED COPY and nothing else the target pulls
      // in — structnull.test.ts builds its csharp probe the same way. The
      // spec is read through System.Text.Json and converted into the loose
      // object model the struct port validates against.
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
      Fs.writeFileSync(Path.join(dir, 'Program.cs'), `using System.Text.Json;
using Voxgig.Struct;

static object? Conv(JsonElement el) => el.ValueKind switch
{
  JsonValueKind.Object => new Dictionary<string, object?>(
      el.EnumerateObject().ToDictionary(p => p.Name, p => Conv(p.Value))),
  JsonValueKind.Array => el.EnumerateArray().Select(Conv).ToList(),
  JsonValueKind.String => el.GetString(),
  JsonValueKind.Number => (object)el.GetDouble(),
  JsonValueKind.True => true,
  JsonValueKind.False => false,
  _ => null,
};

var src = File.ReadAllText(${JSON.stringify(spec)});
Dictionary<string, object?> Spec() =>
  (Dictionary<string, object?>)Conv(JsonSerializer.Deserialize<JsonElement>(src))!;

string KeysOf(Dictionary<string, object?> data) {
  var outv = StructUtils.Validate(data, Spec());
  var m = outv as Dictionary<string, object?>;
  var f = m != null && m.TryGetValue("feature", out var fv)
    ? fv as Dictionary<string, object?> : null;
  return f == null ? "" : string.Join(",", f.Keys.OrderBy(k => k));
}

Console.WriteLine("absent=" + KeysOf(new Dictionary<string, object?>()));
Console.WriteLine("supplied=" + KeysOf(new Dictionary<string, object?> {
  ["feature"] = new Dictionary<string, object?> {
    ["log"] = new Dictionary<string, object?> { ["active"] = true } } }));
`)
      // The spec path is baked in rather than copied beside the assembly:
      // `dotnet run` chooses its own working directory, and a .csproj.user
      // dropped here to influence the build is read as a project file.
      return run(dotnet, ['run', '--project', dir, '-v', 'q', '--nologo'], dir)
    },
  },
  {
    target: 'go',
    needs: 'go',
    exec: (tmp, spec) => {
      const go = toolchain('go')
      if (null == go) return null

      // A module around the VENDORED COPY and nothing else the target pulls
      // in — structnull.test.ts builds its go probe the same way.
      const dir = Path.join(tmp, 'go')
      Fs.mkdirSync(Path.join(dir, 'struct'), { recursive: true })
      Fs.copyFileSync(
        Path.join(TM, 'go', 'utility', 'struct', 'voxgigstruct.go'),
        Path.join(dir, 'struct', 'voxgigstruct.go'))
      Fs.writeFileSync(Path.join(dir, 'go.mod'), 'module oneabsence\n\ngo 1.21\n')
      Fs.copyFileSync(spec, Path.join(dir, 'spec.json'))
      Fs.writeFileSync(Path.join(dir, 'main.go'), `package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"

	vs "oneabsence/struct"
)

func spec() map[string]any {
	src, err := os.ReadFile("spec.json")
	if err != nil {
		panic(err)
	}
	var out map[string]any
	if err := json.Unmarshal(src, &out); err != nil {
		panic(err)
	}
	return out
}

func keysOf(data map[string]any) string {
	out, err := vs.Validate(data, spec())
	if err != nil {
		return "ERR:" + err.Error()
	}
	m, _ := out.(map[string]any)
	f, _ := m["feature"].(map[string]any)
	keys := make([]string, 0, len(f))
	for k := range f {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return strings.Join(keys, ",")
}

func main() {
	fmt.Println("absent=" + keysOf(map[string]any{}))
	fmt.Println("supplied=" + keysOf(map[string]any{
		"feature": map[string]any{"log": map[string]any{"active": true}}}))
}
`)
      return run(go, ['run', '.'], dir)
    },
  },
  {
    target: 'java',
    needs: 'javac and java',
    exec: (tmp, spec) => {
      const javac = toolchain('javac')
      const java = toolchain('java')
      if (null == javac || null == java) return null

      // The vendored source carries the JAVAPACKAGE placeholder `target add`
      // substitutes; the probe substitutes its own so the file compiles
      // outside a generated SDK.
      const dir = Path.join(tmp, 'java')
      const pkgdir = Path.join(dir, 'probe', 'utility', 'struct')
      Fs.mkdirSync(pkgdir, { recursive: true })
      Fs.mkdirSync(Path.join(dir, 'probe', 'utility'), { recursive: true })

      const sub = (from: string, to: string) => Fs.writeFileSync(to,
        Fs.readFileSync(from, 'utf8').replace(/JAVAPACKAGE/g, 'probe'))

      sub(Path.join(TM, 'java', 'utility', 'struct', 'Struct.java'),
        Path.join(pkgdir, 'Struct.java'))
      sub(Path.join(TM, 'java', 'utility', 'Json.java'),
        Path.join(dir, 'probe', 'utility', 'Json.java'))

      Fs.writeFileSync(Path.join(dir, 'Probe.java'), `import java.nio.file.*;
import java.util.*;
import probe.utility.Json;
import probe.utility.struct.Struct;

public class Probe {
  static String SRC = "";

  @SuppressWarnings("unchecked")
  static String keysOf(Map<String,Object> data) {
    Object out = Struct.validate(data, (Map<String,Object>) Json.parse(SRC));
    Object f = (out instanceof Map) ? ((Map<String,Object>) out).get("feature") : null;
    Map<String,Object> fm = (f instanceof Map) ? (Map<String,Object>) f
      : new LinkedHashMap<String,Object>();
    List<String> keys = new ArrayList<>(fm.keySet());
    Collections.sort(keys);
    return String.join(",", keys);
  }

  public static void main(String[] args) throws Exception {
    SRC = new String(Files.readAllBytes(Paths.get(${JSON.stringify(spec)})), "UTF-8");
    System.out.println("absent=" + keysOf(new LinkedHashMap<String,Object>()));
    Map<String,Object> log = new LinkedHashMap<>();
    log.put("active", true);
    Map<String,Object> feature = new LinkedHashMap<>();
    feature.put("log", log);
    Map<String,Object> data = new LinkedHashMap<>();
    data.put("feature", feature);
    System.out.println("supplied=" + keysOf(data));
  }
}
`)
      const built = run(javac, ['-d', Path.join(dir, 'out'),
        Path.join(dir, 'Probe.java'),
        Path.join(dir, 'probe', 'utility', 'Json.java'),
        Path.join(pkgdir, 'Struct.java')], dir)
      if (!built.ok) return built

      return run(java, ['-cp', Path.join(dir, 'out'), 'Probe'], dir)
    },
  },
]


describe('vendored struct optional-key absence', () => {

  let tmp = ''
  let spec = ''

  before(() => {
    tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-oneabsence-'))
    spec = Path.join(tmp, 'spec.json')
    Fs.writeFileSync(spec, SPEC_JSON)
  })

  after(() => {
    if ('' !== tmp) Fs.rmSync(tmp, { recursive: true, force: true })
  })


  for (const port of PORTS) {

    test(port.target + ': an omitted optional entry stays omitted', (t) => {
      const ran = port.exec(tmp, spec)
      if (null == ran) {
        return t.skip('no usable ' + port.target + ' toolchain here (' +
          port.needs + ')')
      }

      // A probe that CRASHED must not read as a wrong answer: the parse below
      // would find no lines and report every field missing, which sends the
      // reader to struct rather than to the probe.
      strictEqual(ran.ok, true,
        port.target + ': the absence probe did not run:\n' + ran.out)

      const got: Record<string, string> = {}
      for (const line of ran.out.split('\n')) {
        const at = line.indexOf('=')
        if (0 < at) got[line.slice(0, at).trim()] = line.slice(at + 1).trim()
      }

      strictEqual(
        JSON.stringify({ absent: got.absent, supplied: got.supplied }),
        JSON.stringify(EXPECTED),
        port.target + ": an optional `['`$ONE`', <spec>, '`$NIL`'] entry no " +
        'longer behaves like the ts reference. `absent` must be empty — a ' +
        'feature the caller did not name must not appear in options.feature, ' +
        'because makeOptions derives the feature add order from those keys. ' +
        'Probe output:\n' + ran.out)
    })
  }
})
