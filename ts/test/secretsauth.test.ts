import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import { readFileSync, readdirSync } from 'node:fs'
import Path from 'node:path'

import { SCAFFOLD } from './generateharness'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')

const CONSUMER_TARGETS = ['go-cli', 'go-mcp', 'py-data']

// What every secrets suite says when it skips, as the primary corpus runners
// say it for their prepareAuth section.
const REASON = "this SDK's config declares no auth, so it places no credential"

// The line each suite's auth-off case prints, whose counts the lanes read.
const AUTHOFF = 'secrets: auth off by '

// The secret every suite's Basic cases pass beside the credential.
const SECRET = 'PASS01'

// Each suite, the read of the generated config's auth that gates its skip,
// and what makes the gate cover the whole suite: one gate before every test
// (`before`), a test count that every test's own guard must match (`each`), or
// a check on the suite's shape (`whole`).
type Suite = {
  file: string
  gate: RegExp
  before?: RegExp
  each?: { test: RegExp, guarded: RegExp }
  whole?: (src: string) => string | null
}

const count = (src: string, re: RegExp): number => (src.match(re) || []).length

// Every top-level describe but the auth-off one carries the skip.
const describesSkip = (src: string): string | null => {
  const all = count(src, /^describe\(/gm)
  const skipped = count(src, /^describe\('[^']+', \{ skip: NOAUTH \}, \(\) => \{$/gm)
  const off = count(src, /^describe\('secrets with auth off', \(\) => \{$/gm)
  return 1 < all && 1 === off && all === skipped + off ? null
    : skipped + ' of ' + all + ' describe blocks skip, ' + off + ' runs with auth off'
}

const SUITES: Record<string, Suite> = {
  ts: {
    file: 'ts/test/feature/secrets/Secrets.test.ts',
    gate: /const NOAUTH = null == \(config as any\)\.options\?\.auth \?\s*"[^"]+" : false/,
    whole: describesSkip,
  },
  js: {
    file: 'js/test/feature/secrets/Secrets.test.js',
    gate: /const NOAUTH = null == config\.options\?\.auth \?\s*"[^"]+" : false/,
    whole: describesSkip,
  },
  go: {
    file: 'go/test/feature/secrets/secrets_feature_test.go',
    gate: /if options, _ := sdk\.MakeConfig\(\)\["options"\]\.\(map\[string\]any\); nil == options\["auth"\] \{\s*t\.Skip\(/,
    each: {
      test: /^func Test(?!AuthOff\b)\w+\(t \*testing\.T\) \{$/gm,
      guarded: /^func Test\w+\(t \*testing\.T\) \{\n\tskipWithoutAuth\(t\)\n/gm,
    },
  },
  py: {
    file: 'py/test/feature/secrets/test_secrets.py',
    gate: /^NOAUTH = "auth" not in shared_config\(\)\.get\("options", \{\}\)\nplacing = pytest\.mark\.skipif\(\s*NOAUTH, reason=/m,
    whole: (src) => {
      const classes = count(src, /^class Test\w+\(unittest\.TestCase\):$/gm)
      const placed = count(src, /^@placing\nclass Test\w+\(unittest\.TestCase\):$/gm)
      const off = count(src, /^class TestSecretsAuthOff\(unittest\.TestCase\):$/gm)
      return 1 < classes && 1 === off && classes === placed + off ? null
        : placed + ' of ' + classes + ' test classes skip, ' + off + ' runs with auth off'
    },
  },
  rb: {
    file: 'rb/test/feature/secrets/secrets_feature_test.rb',
    gate: /def setup\s*return if name\.start_with\?\("test_auth_off_"\)\s*unless ProjectNameConfig\.shared_config\["options"\]\.key\?\("auth"\)\s*skip\(/,
    whole: (src) => 1 !== count(src, /< Minitest::Test$/gm) ? 'not one test class'
      : 1 === count(src, /^ {2}def test_auth_off_\w+$/gm) ? null : 'not one auth-off test',
  },
  php: {
    file: 'php/test/feature/secrets/SecretsTest.php',
    gate: /protected function setUp\(\): void\s*\{\s*\$test = method_exists\(\$this, 'name'\) \? \$this->name\(\) : \$this->getName\(\);\s*if \('testAuthOffPlacesNoCredentialAndBuysNoToken' === \$test\) \{\s*return;\s*\}\s*if \(!array_key_exists\('auth', ProjectNameConfig::shared_config\(\)\['options'\] \?\? \[\]\)\) \{\s*\$this->markTestSkipped\(/,
    whole: (src) => 1 !== count(src, /extends TestCase$/gm) ? 'not one test class'
      : 1 === count(src, /public function testAuthOffPlacesNoCredentialAndBuysNoToken\(\): void/g)
        ? null : 'not one auth-off test',
  },
  perl: {
    file: 'perl/t/feature/secrets/secrets.t',
    gate: /^if \(!exists ProjectNameConfig::make_config\(\)->\{options\}\{auth\}\) \{\s*auth_off\('config'\);\s*SKIP: \{\s*skip\("[^"]+", 1\);\s*\}\s*done_testing;\s*exit 0;\s*\}/m,
    before: /^(SKIP: )?\{$|^subtest\b/m,
    whole: (src) => 1 === count(src, /^auth_off\('option', 'auth' => undef\);$/gm)
      ? null : 'the auth-off case does not run where the config declares auth',
  },
  java: {
    file: 'java/test/feature/secrets/SecretsFeatureTest.java',
    gate: /@BeforeEach\s*public void \w+\(TestInfo test\) \{\s*if \(test\.getTestMethod\(\)\.map\(m -> m\.getName\(\)\.startsWith\("authOff_"\)\)\.orElse\(false\)\) \{\s*return;\s*\}\s*Map<String, Object> options = Helpers\.toMapAny\(Config\.sharedConfig\(\)\.get\("options"\)\);\s*Assumptions\.assumeTrue\(null != options && options\.containsKey\("auth"\),/,
    whole: (src) => 1 === count(src, /public void authOff_\w+\(\)/g) ? null : 'not one auth-off test',
  },
  kotlin: {
    file: 'kotlin/test/feature/secrets/SecretsTest.kt',
    gate: /@BeforeEach\s*fun \w+\(test: TestInfo\) \{\s*if \(true == test\.testMethod\.map \{ it\.name\.startsWith\("authOff"\) \}\.orElse\(false\)\) \{\s*return\s*\}\s*Assumptions\.assumeTrue\(\s*true == Helpers\.toMapAny\(Config\.sharedConfig\(\)\["options"\]\)\?\.containsKey\("auth"\),/,
    whole: (src) => 1 === count(src, /fun authOff\w+\(\)/g) ? null : 'not one auth-off test',
  },
  scala: {
    file: 'scala/sdktest/feature/secrets/SecretsTestMain.scala',
    gate: /def main\(args: Array\[String\]\): Unit = \{\s*(\/\/[^\n]*\n\s*)*val declared = SCALAPACKAGE\.core\.Config\.sharedConfig\(\)\.get\("options"\)\.asInstanceOf\[JMap\[String, Object\]\]\s*\.containsKey\("auth"\)\s*if \(!declared\) \{\s*println\("SKIP secrets: [^"]+"\)\s*\}\s*val placing: List\[\(String, \(\) => Unit\)\] = List\(/,
    whole: (src) => /val cases: List\[\(String, \(\) => Unit\)\] =\s*\(if \(declared\) placing else Nil\) :\+ \("authOff" -> \(\(\) => testAuthOff\(declared\)\)\)/.test(src)
      ? null : 'the auth-off case is not run whatever the config declares',
  },
  lua: {
    file: 'lua/test/feature/secrets/secrets_feature_test.lua',
    gate: /^describe\("secrets", function\(\)\s*(--[^\n]*\n\s*)*if nil == \(require\("config_shared"\)\(\)\.options or \{\}\)\.auth then\s*pending\("[^"]+"\)\s*return\s*end/m,
    whole: (src) => 2 === count(src, /^describe\(/gm) &&
      1 === count(src, /^describe\("secrets with auth off", function\(\)$/gm)
      ? null : 'not the gated describe and the auth-off one',
  },
  swift: {
    file: 'swift/Tests/ProjectNameSDKTests/feature/secrets/SecretsFeatureTest.swift',
    gate: /override func setUpWithError\(\) throws \{\s*try super\.setUpWithError\(\)\s*guard nil != gp\(SdkConfig\.sharedConfig\(\), "options"\)\.asMap\?\.entries\["auth"\]\s*\|\| name\.contains\("testAuthOff"\) else \{\s*throw XCTSkip\(/,
    whole: (src) => 1 !== count(src, /: XCTestCase \{$/gm) ? 'not one test class'
      : 1 === count(src, /func testAuthOff\w+\(\)/g) ? null : 'not one auth-off test',
  },
  csharp: {
    file: 'csharp/test/feature/secrets/SecretsFeatureTest.cs',
    gate: /if \(DeclaresAuth\(\)\)\s*\{\s*return false;\s*\}\s*Console\.WriteLine\("SKIP " \+ test \+ ": [^"]+"\);\s*return true;\s*\}\s*private static bool DeclaresAuth\(\) =>\s*SdkConfig\.SharedConfig\(\)\["options"\] is Dictionary<string, object\?> options &&\s*options\.ContainsKey\("auth"\);/,
    each: {
      test: /^ {4}\[(Fact|Theory)\b[^\n]*\n {4}public void (?!AuthOff)/gm,
      guarded: /^ {4}\[Fact\]\n {4}public void \w+\(\)\n {4}\{\n {8}if \(SkippedWithoutAuth\(\)\) return;\n/gm,
    },
  },
  rust: {
    file: 'rust/tests/feature/secrets/main.rs',
    gate: /fn skipped_without_auth\(\) -> bool \{\s*if declares_auth\(\) \{\s*return false;\s*\}\s*println!\("SKIP secrets: [^"]+"\);\s*true\s*\}\s*fn declares_auth\(\) -> bool \{\s*matches!\(getp\(&getp\(&RUSTCRATE::make_config\(\), "options"\), "auth"\), Value::Map\(_\)\)\s*\}/,
    each: {
      test: /^#\[test\]\nfn (?!auth_off_)/gm,
      guarded: /^#\[test\]\nfn \w+\(\) \{\n {4}if skipped_without_auth\(\) \{\n {8}return;\n {4}\}\n/gm,
    },
  },
  zig: {
    file: 'zig/test/feature/secrets/secrets_test.zig',
    gate: /fn placesCredential\(\) bool \{\s*if \(h\.getp\(h\.getp\(sdk\.make_config\(\), "options"\), "auth"\) == \.object\) return true;\s*std\.debug\.print\("\\n {2}SKIP secrets: [^"]+\\n", \.\{\}\);\s*return false;/,
    each: {
      test: /^test "(?!auth off)/gm,
      guarded: /^test "[^"]*" \{\n {4}if \(!present\(\) or !placesCredential\(\)\) return error\.SkipZigTest;\n/gm,
    },
  },
  c: {
    file: 'c/tests/feature/secrets/secrets_test.c',
    gate: /int main\(void\) \{\s*(\/\/[^\n]*\n\s*)*if \(!voxgig_is_map\(getpath2\(shared_config\(\), "options", "auth"\)\)\) \{\s*printf\("SKIP \[secrets\]: [^"]+\\n"\);\s*RUN\(t_auth_off\);\s*TEST_SUMMARY\("secrets"\);\s*\}/,
    whole: (src) => 2 === count(src, /^ {2,4}RUN\(t_auth_off\);$/gm) ? null : 'the auth-off case is not run in both branches',
  },
  cpp: {
    file: 'cpp/test/feature/secrets/secrets_test.cpp',
    gate: /int main\(\) \{\s*(\/\/[^\n]*\n\s*)*if \(!getp\(getp\(sharedConfig\(\), Value\("options"\)\), Value\("auth"\)\)\.is_map\(\)\) \{\s*std::cout << " {2}SKIP \[secrets\]: [^"]+\\n";\s*RUN\(t_auth_off\);\s*return sdktest::summary\("secrets_test"\);\s*\}/,
    whole: (src) => 2 === count(src, /^ {2,4}RUN\(t_auth_off\);$/gm) ? null : 'the auth-off case is not run in both branches',
  },
  ocaml: {
    file: 'ocaml/test/feature/secrets/t_secrets.ml',
    gate: /let places_credential =\s*match getp \(getp \(Sdk_config\.make_config \(\)\) "options"\) "auth" with Map _ -> true \| _ -> false[\s\S]*?let test \(name : string\) \(f : unit -> unit\) : unit =\s*if places_credential then begin/,
    whole: (src) => 2 === count(src, /Testutil\.test /g) &&
      1 === count(src, /Testutil\.test "secrets\.auth_off\./g)
      ? null : 'a case other than the auth-off one bypasses the gated test wrapper',
  },
  clojure: {
    file: 'clojure/test/sdk/test/feature/secrets.clj',
    gate: /\(defn run \[rec\]\s*\(if \(vs\/ismap \(vs\/getprop \(vs\/getprop \(config\/make-config\) "options"\) "auth"\)\)\s*\(do \(run-checks rec\)\s*\(auth-off rec true\)\)\s*\(do \(println "SKIP secrets: [^"]+"\)\s*\(auth-off rec false\)\s*:skipped\)\)\)/,
    whole: () => /\(when \(and \(zero\? @ran\) \(not= :skipped outcome\)\)/.test(
      readFileSync(Path.join(TM, 'clojure/test/sdk/test_runner.clj'), 'utf8'))
      ? null : 'the runner fails a suite that skips',
  },
  elixir: {
    file: 'elixir/test/feature/secrets/secrets_test.exs',
    gate: /@noauth if\(nil == S\.getprop\(S\.getprop\(ProjectName\.Config\.shared_config\(\), "options"\), "auth"\),\s*do: "[^"]+"\)\s*if @noauth, do: IO\.puts\("SKIP secrets: " <> @noauth\)/,
    before: /^\s*(test|describe) "/m,
    whole: (src) => {
      const all = count(src, /^ {2}describe "/gm)
      const gated = count(src, /^ {2}describe "[^"]+" do\n {4}if @noauth, do: @describetag\(skip: @noauth\)$/gm)
      const off = count(src, /^ {2}describe "secrets with auth off" do$/gm)
      return 1 < all && 1 === off && all === gated + off ? null
        : gated + ' of ' + all + ' describe blocks skip, ' + off + ' runs with auth off'
    },
  },
}


function sdkTargets(): string[] {
  return readdirSync(Path.resolve(SCAFFOLD, 'model', 'target'))
    .filter((f: string) => f.endsWith('.aontu') && 'target-index.aontu' !== f)
    .map((f: string) => f.replace(/\.aontu$/, ''))
    .filter((t: string) => !CONSUMER_TARGETS.includes(t))
    .sort()
}


// With auth on, every config declares the auth each gate reads (pinned in
// primaryauth.test.ts), so no suite skips. Either way each suite runs its
// auth-off case: off by the config where it declares no auth, else by
// `auth: null`.
describe('secrets suites and an SDK that places no credential', () => {

  test('every SDK target names its secrets suite', () => {
    deepStrictEqual(Object.keys(SUITES).sort(), sdkTargets())
  })

  for (const [target, suite] of Object.entries(SUITES)) {
    test(target + ': the secrets suite skips, naming why, only where the config declares no auth', () => {
      const src = readFileSync(Path.join(TM, suite.file), 'utf8')
      strictEqual(src.split(REASON).length - 1, 1, target + ': the skip does not give its reason once')

      const gate = suite.gate.exec(src)
      ok(null != gate, target + ': the skip is not gated on the config declaring no auth')

      if (null != suite.before) {
        const first = src.search(suite.before)
        ok(0 < first && gate.index < first, target + ': a test runs before the gate')
      }

      if (null != suite.each) {
        const tests = count(src, suite.each.test)
        ok(0 < tests, target + ': no tests found')
        strictEqual(count(src, suite.each.guarded), tests,
          target + ': a test does not open with the gate')
      }

      if (null != suite.whole) {
        strictEqual(suite.whole(src), null, target)
      }
    })

    test(target + ': the secrets suite asserts auth off places nothing, and Basic keeps the secret', () => {
      const src = readFileSync(Path.join(TM, suite.file), 'utf8')
      strictEqual(src.split(AUTHOFF).length - 1, 1,
        target + ': the auth-off case does not print its line once')
      ok(src.includes(SECRET), target + ': no case passes a secret beside the credential')
    })
  }
})
