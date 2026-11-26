
import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import { readFileSync, readdirSync } from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'

import { SdkGen } from '../dist/sdkgen.js'

import { STAGE, SCAFFOLD, makeLog, layeredFs, makeModel, makeRoot } from './generateharness'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')

const CONSUMER_TARGETS = ['go-cli', 'go-mcp', 'py-data']

// What every primary-corpus runner says when it skips the prepareAuth section.
const REASON = "this SDK's config declares no auth, so it places no credential"

const BEARER = "main: kit: config: auth: { active: true, prefix: 'Bearer', in: 'header', name: 'Authorization' }"

// Each runner, the read of the generated config's auth that gates its skip,
// and the call that runs the section when it does not skip.
const RUNNERS: Record<string, { file: string, reads: RegExp, runs: RegExp }> = {
  ts: {
    file: 'ts/test/utility/PrimaryUtility.test.ts',
    reads: /if \(null == \(config as any\)\.options\?\.auth\) \{\s*return t\.skip\(/,
    runs: /runsection\('prepareAuth'/,
  },
  js: {
    file: 'js/test/utility/PrimaryUtility.test.js',
    reads: /if \(null == config\.options\?\.auth\) \{\s*return t\.skip\(/,
    runs: /runset\(cases,/,
  },
  go: {
    file: 'go/test/primary_utility_test.go',
    reads: /sdk\.MakeConfig\(\)\["options"\]\.\(map\[string\]any\); nil == options\["auth"\] \{\s*t\.Skip\(/,
    runs: /runsection\(t, "prepareAuth"/,
  },
  py: {
    file: 'py/test/test_primary_utility.py',
    reads: /if "auth" not in shared_config\(\)\.get\("options", \{\}\):\s*pytest\.skip\(/,
    runs: /runsection\('prepareAuth'/,
  },
  rb: {
    file: 'rb/test/primary_utility_test.rb',
    reads: /unless ProjectNameConfig\.shared_config\["options"\]\.key\?\("auth"\)\s*skip\(/,
    runs: /runsection\("prepareAuth"/,
  },
  php: {
    file: 'php/test/PrimaryUtilityTest.php',
    reads: /if \(!array_key_exists\('auth', ProjectNameConfig::shared_config\(\)\['options'\] \?\? \[\]\)\) \{\s*\$this->markTestSkipped\(/,
    runs: /runsection\('prepareAuth'/,
  },
  perl: {
    file: 'perl/t/primary_utility.t',
    reads: /skip\("[^"]+", 2\)\s*unless exists ProjectNameConfig::make_config\(\)->\{options\}\{auth\};/,
    runs: /runsection\('prepareAuth'/,
  },
  java: {
    file: 'java/test/PrimaryUtilityTest.java',
    reads: /Config\.sharedConfig\(\)\.get\("options"\)\);\s*Assumptions\.assumeTrue\(null != options && options\.containsKey\("auth"\),/,
    runs: /runsection\("prepareAuth"/,
  },
  lua: {
    file: 'lua/test/primary_utility_test.lua',
    reads: /if nil == \(require\("config_shared"\)\(\)\.options or \{\}\)\.auth then\s*pending\(/,
    runs: /runsection, "prepareAuth"/,
  },
  c: {
    file: 'c/tests/primary_corpus_test.c',
    reads: /voxgig_is_map\(mget\(mget\(shared_config\(\), "options"\), "auth"\)\)/,
    runs: /if \(places_credential\(\)\) \{\s*runset_with\("prepareAuth"/,
  },
  cpp: {
    file: 'cpp/test/primary_utility_test.cpp',
    reads: /if \(!getp\(getp\(sharedConfig\(\), Value\("options"\)\), Value\("auth"\)\)\.is_map\(\)\) \{\s*std::cout << "  SKIP \[prepareAuth\]: /,
    runs: /runsection\("prepareAuth"/,
  },
  rust: {
    file: 'rust/tests/primary_utility_test.rs',
    reads: /if !matches!\(getp\(&getp\(&RUSTCRATE::make_config\(\), "options"\), "auth"\), Value::Map\(_\)\) \{\s*println!\("SKIP prepareAuth: /,
    runs: /runsection\(&mut run, "prepareAuth"/,
  },
  zig: {
    file: 'zig/test/primary_utility_test.zig',
    reads: /if \(h\.getp\(h\.getp\(sdk\.make_config\(\), "options"\), "auth"\) != \.object\) \{\s*std\.debug\.print\("\\n  SKIP primary prepareAuth: /,
    runs: /\.name = "prepareAuth" \}, authSubject\)/,
  },
  ocaml: {
    file: 'ocaml/test/primary_utility_test.ml',
    reads: /match getp \(getp \(Sdk_config\.make_config \(\)\) "options"\) "auth" with\s*\| Map _ ->/,
    runs: /\(client_for r "prepareAuth"\) "prepareAuth"/,
  },
  csharp: {
    file: 'csharp/test/PrimaryUtilityTest.cs',
    reads: /if \(SdkConfig\.SharedConfig\(\)\["options"\] is not Dictionary<string, object\?> options \|\|\s*!options\.ContainsKey\("auth"\)\)\s*\{\s*Console\.WriteLine\("SKIP PrepareAuthBasic: /,
    runs: /runsection\("prepareAuth"/,
  },
  kotlin: {
    file: 'kotlin/test/PrimaryUtilityTest.kt',
    reads: /Assumptions\.assumeTrue\(\s*true == Helpers\.toMapAny\(Config\.sharedConfig\(\)\["options"\]\)\?\.containsKey\("auth"\),/,
    runs: /runsection\("prepareAuth"\)/,
  },
  scala: {
    file: 'scala/sdktest/PrimaryCorpus.scala',
    reads: /if \(SCALAPACKAGE\.core\.Config\.sharedConfig\(\)\.get\("options"\)\.asInstanceOf\[JMap\[String, Object\]\]\s*\.containsKey\("auth"\)\) \{\s*runset\("prepareAuth"[\s\S]*?\}\s*\}\s*else REPORT\.skip\("prepareAuth", /,
    runs: /runset\("prepareAuth", clientFor/,
  },
  swift: {
    file: 'swift/Tests/ProjectNameSDKTests/PrimaryUtilityTest.swift',
    reads: /guard nil != gp\(SdkConfig\.sharedConfig\(\), "options"\)\.asMap\?\.entries\["auth"\] else \{\s*throw XCTSkip\(/,
    runs: /runsection\("prepareAuth"\)/,
  },
  elixir: {
    file: 'elixir/test/primary_utility_test.exs',
    reads: /if nil == S\.getprop\(S\.getprop\(ProjectName\.Config\.shared_config\(\), "options"\), "auth"\) do\s*IO\.puts\("SKIP /,
    runs: /run\.runsetflags\.\(node, %\{name: "primary\.prepareAuth"\}/,
  },
  clojure: {
    file: 'clojure/test/sdk/test/primary.clj',
    reads: /\(if \(vs\/ismap \(vs\/getprop \(vs\/getprop \(config\/make-config\) "options"\) "auth"\)\)\s*\(runset "prepareAuth"[^\n]*\n\s*\(println "PRIMARY-SKIP prepareAuth - /,
    runs: /\(runset "prepareAuth" auth-sdk/,
  },
}


function sdkTargets(): string[] {
  return readdirSync(Path.resolve(SCAFFOLD, 'model', 'target'))
    .filter((f: string) => f.endsWith('.aontu') && 'target-index.aontu' !== f)
    .map((f: string) => f.replace(/\.aontu$/, ''))
    .filter((t: string) => !CONSUMER_TARGETS.includes(t))
    .sort()
}


async function generateConfigs(targets: string[], extra?: string): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})
  const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
  const cwd = process.cwd()
  process.chdir(SCAFFOLD)
  try {
    const res = await sdkgen.generate({ model: makeModel(targets, undefined, extra), root: makeRoot() })
    strictEqual(res.ok, true, 'generation did not report ok')
  }
  finally {
    process.chdir(cwd)
  }
  const configs: Record<string, string> = {}
  for (const [path, content] of Object.entries(vol.toJSON() as Record<string, string>)) {
    const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
    const target = rel.split('/')[0]
    if (targets.includes(target) && !rel.includes('feature/') &&
      /(^|\/)(sdk_)?config\.[a-z]+$/i.test(rel)) {
      configs[target] = content
    }
  }
  return configs
}


describe('primary corpus runners and an SDK that places no credential', () => {

  test('every SDK target names its runner', () => {
    deepStrictEqual(Object.keys(RUNNERS).sort(), sdkTargets())
  })

  // The skip is read from the config; a probe that finds nothing still fails.
  for (const [target, runner] of Object.entries(RUNNERS)) {
    test(target + ': the runner skips prepareAuth, naming why, only where the config declares no auth', () => {
      const src = readFileSync(Path.join(TM, runner.file), 'utf8')
      strictEqual(src.split(REASON).length - 1, 1, target + ': the skip does not give its reason once')
      ok(runner.reads.test(src), target + ': the skip is not gated on the config declaring no auth')
      ok(runner.runs.test(src), target + ': the section no longer runs')
    })
  }

  // With auth on, the auth block every runner reads is there, so none skips.
  test('every config declares auth exactly where PrepareAuth places a credential', async () => {
    const targets = sdkTargets()
    const on = await generateConfigs(targets, BEARER)
    const off = await generateConfigs(targets)
    for (const target of targets) {
      ok(/auth[\s\S]{1,120}prefix[\s\S]{1,40}Bearer/.test(String(on[target])),
        target + ': the config of an SDK with auth declares none')
      // An auth block takes the Bearer prefix by default, so none is here.
      ok(null != off[target] && !/Bearer/.test(off[target]),
        target + ': the config of an SDK with no auth declares some')
    }
  })
})
