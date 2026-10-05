import { test, describe, before, after } from 'node:test'
import { deepStrictEqual, ok, strictEqual } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import { spawnSync } from 'node:child_process'

import { memfs } from 'memfs'

import { SdkGen } from '../dist/sdkgen'
import {
  makeModel, makeRoot, layeredFs, makeLog, STAGE, SCAFFOLD, toolchain,
} from './generateharness'


const PKG = Path.resolve(__dirname, '..')
const TARGETS = ['ts', 'js']


// The univec fixture has live scenarios, so the scripts include test:live.
async function generateTo(target: string, root: string): Promise<any> {
  const model = makeModel([target], undefined, undefined, ['test'])
  Object.assign(model.main.kit,
    JSON.parse(Fs.readFileSync(Path.join(PKG, 'test/live-univec-model.json'), 'utf8')))
  const facts = JSON.parse(
    Fs.readFileSync(Path.join(PKG, 'test/live-univec-facts.json'), 'utf8'))

  const { fs, vol } = memfs({})
  const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
  const cwd = process.cwd()
  try {
    process.chdir(SCAFFOLD)
    await sdkgen.generate({
      model, root: makeRoot(),
      buildctx: { resolved: { operation: (m: string, p: string) => facts[m + ' ' + p] } },
    })
  }
  finally {
    process.chdir(cwd)
  }

  for (const [file, content] of Object.entries(vol.toJSON())) {
    const rel = Path.relative(STAGE, file).split(Path.sep).join('/')
    if (!rel.startsWith(target + '/') || null == content) continue
    const dest = Path.join(root, rel.slice(target.length + 1))
    Fs.mkdirSync(Path.dirname(dest), { recursive: true })
    Fs.writeFileSync(dest, content)
  }

  return JSON.parse(Fs.readFileSync(Path.join(root, 'package.json'), 'utf8'))
}


// What cmd.exe cannot run: a single-quoted word, sh variable expansion, a
// backtick, an inline assignment or a POSIX file command.
function posixOnly(script: string): string[] {
  const found: string[] = []
  const commands: string[] = ['']

  let quoted = false
  for (let i = 0; i < script.length; i++) {
    const c = script[i]
    if ('"' === c) quoted = !quoted
    else if (!quoted && '\'' === c) found.push('single quote')
    else if (!quoted && /[;&|]/.test(c)) {
      commands.push('')
      continue
    }
    commands[commands.length - 1] += c
  }

  if (script.includes('$')) found.push('$ expansion')
  if (script.includes('`')) found.push('backtick')

  for (const command of commands.map((c) => c.trim())) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(command)) found.push('inline assignment: ' + command)
    if (/^(rm|cp|mv|cat|mkdir|export)\b/.test(command)) found.push('command: ' + command)
  }

  return [...new Set(found)]
}


const PROBE: Record<string, Record<string, string>> = {
  ts: {
    'test/nested/probe.test.ts':
      "import { test } from 'node:test'\nimport { appendFileSync } from 'node:fs'\n" +
      "test('alpha', () => { appendFileSync('ran.txt', 'alpha\\n') })\n" +
      "test('beta', () => { appendFileSync('ran.txt', 'beta\\n') })\n",
    'test/utility/probe.test.ts':
      "import { test } from 'node:test'\nimport { appendFileSync } from 'node:fs'\n" +
      "test('utility', () => { appendFileSync('ran.txt', 'utility\\n') })\n",
    'test/live.test.ts':
      "import { test } from 'node:test'\nimport { appendFileSync } from 'node:fs'\n" +
      "test('live', () => { appendFileSync('ran.txt', 'live:' + process.env.DEMO_TEST_LIVE + '\\n') })\n",
  },
  js: {
    'test/nested/probe.test.js':
      "const { test } = require('node:test')\nconst { appendFileSync } = require('node:fs')\n" +
      "test('alpha', () => { appendFileSync('ran.txt', 'alpha\\n') })\n" +
      "test('beta', () => { appendFileSync('ran.txt', 'beta\\n') })\n",
    'test/utility/probe.test.js':
      "const { test } = require('node:test')\nconst { appendFileSync } = require('node:fs')\n" +
      "test('utility', () => { appendFileSync('ran.txt', 'utility\\n') })\n",
    'test/live.test.js':
      "const { test } = require('node:test')\nconst { appendFileSync } = require('node:fs')\n" +
      "test('live', () => { appendFileSync('ran.txt', 'live:' + process.env.DEMO_TEST_LIVE + '\\n') })\n",
  },
}


// What the generated scripts read, cleared of what an enclosing runner set:
// node --test its context, and `npm run test-some --pattern=<name>` its
// npm_config_pattern, which a nested npm passes on. Windows names ignore case.
const INHERITED = ['NODE_TEST_CONTEXT', 'npm_config_pattern', 'TEST_PATTERN', 'DEMO_TEST_LIVE']

function scriptEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const drop = INHERITED.map((name) => name.toLowerCase())
  return Object.fromEntries(
    Object.entries(base).filter(([name]) => !drop.includes(name.toLowerCase())))
}


// The generated tests need the project's .sdk data, so probes stand in for
// them: each records its name in ran.txt.
function useProbes(target: string, root: string) {
  const testDir = Path.join(root, 'test')
  for (const entry of Fs.readdirSync(testDir)) {
    if ('tsconfig.json' !== entry) Fs.rmSync(Path.join(testDir, entry), { recursive: true })
  }
  for (const [file, content] of Object.entries(PROBE[target])) {
    Fs.mkdirSync(Path.dirname(Path.join(root, file)), { recursive: true })
    Fs.writeFileSync(Path.join(root, file), content)
  }
}


describe('npm scripts', () => {
  let tmp = ''

  before(() => {
    tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-npmscripts-'))
  })

  after(() => {
    Fs.rmSync(tmp, { recursive: true, force: true })
  })


  for (const target of TARGETS) {
    test(target + ': no script uses syntax cmd.exe cannot run', async () => {
      const pkg = await generateTo(target, Path.join(tmp, target + '-scan'))
      ok(null != pkg.scripts['test:live'], 'the fixture produced no test:live script')

      const found: Record<string, string[]> = {}
      for (const [name, script] of Object.entries(pkg.scripts)) {
        const bad = posixOnly(String(script))
        if (0 < bad.length) found[name] = bad
      }
      deepStrictEqual(found, {})
    })


    // npm runs these through sh here and through cmd.exe on Windows CI.
    test(target + ': every script runs through the host shell', async (t) => {
      if (null == toolchain('npm')) return t.skip('needs npm')

      const root = Path.join(tmp, target + '-run')
      await generateTo(target, root)
      Fs.symlinkSync(Path.join(PKG, 'node_modules'), Path.join(root, 'node_modules'), 'dir')
      useProbes(target, root)

      // As under `npm run test-some --pattern=<name>`.
      const env = scriptEnv({ ...process.env, npm_config_pattern: 'outer' })

      const ran = Path.join(root, 'ran.txt')
      const npm = (args: string[], extra: NodeJS.ProcessEnv = {}) => {
        Fs.rmSync(ran, { force: true })
        const res = spawnSync('npm', ['run', ...args], {
          cwd: root, encoding: 'utf8', shell: true, env: { ...env, ...extra },
          maxBuffer: 64 * 1024 * 1024,
        })
        strictEqual(res.status, 0, 'npm run ' + args.join(' ') + ' failed:\n' +
          res.stdout + res.stderr)
        return Fs.existsSync(ran) ?
          Fs.readFileSync(ran, 'utf8').trim().split(/\r?\n/).sort() : []
      }

      if ('ts' === target) {
        Fs.mkdirSync(Path.join(root, 'dist-test'), { recursive: true })
        Fs.writeFileSync(Path.join(root, 'dist-test', 'stale.test.js'),
          "require('fs').appendFileSync('ran.txt', 'stale\\n')\n")
        npm(['build'])
        ok(!Fs.existsSync(Path.join(root, 'dist-test', 'stale.test.js')),
          'build left a stale test in dist-test/')
        ok(Fs.existsSync(Path.join(root, 'dist-test', 'nested', 'probe.test.js')),
          'build compiled no tests')
      }

      deepStrictEqual(npm(['test']), ['alpha', 'beta', 'live:undefined', 'utility'])
      deepStrictEqual(npm(['test-some']), ['alpha', 'beta', 'live:undefined', 'utility'])
      deepStrictEqual(npm(['test-some', '--pattern=alpha']), ['alpha'])
      deepStrictEqual(npm(['test-some'], { TEST_PATTERN: 'beta' }), ['beta'])
      deepStrictEqual(npm(['test:live']), ['live:TRUE'])
      deepStrictEqual(npm(['test-utility']), ['utility'])

      Fs.rmSync(Path.join(root, 'node_modules'), { force: true })
      const leftovers = ['node_modules/pkg/index.js', 'yarn.lock', 'package-lock.json']
      for (const file of leftovers) {
        Fs.mkdirSync(Path.dirname(Path.join(root, file)), { recursive: true })
        Fs.writeFileSync(Path.join(root, file), '')
      }
      npm(['clean'])
      const cleaned = ['node_modules', 'yarn.lock', 'package-lock.json',
        ...('ts' === target ? ['dist', 'dist-test'] : [])]
      deepStrictEqual(cleaned.filter((p) => Fs.existsSync(Path.join(root, p))), [])
    })
  }
})
