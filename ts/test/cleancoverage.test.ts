import { test, describe } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'


// Every SDK target classified for secret redaction (ADR-003), and the
// classification checked against the tree: a structural guard, declared as
// such. The build is the canary-sweep lane in generatedcompile.test.ts; this
// is what says a target has not been left out.

const SDK = Path.resolve(__dirname, '..', 'project', '.sdk')
const TM = Path.join(SDK, 'tm')
const CMP = Path.join(SDK, 'src', 'cmp')

const CONSUMER_TARGETS = ['go-cli', 'go-mcp', 'py-data']


type Row = {
  target: string
  // Files that must call clean: make_error, done, the log feature, the debug
  // feature. One file may serve several roles.
  error: string
  done: string
  log: string
  debug: string
  // How a call to clean is spelled in this target.
  call: RegExp
}

const CLEAN_CALL = /\bclean\w*\s*\(|\bclean_\w+\s*\(|\bClean\.\w*clean\w*\s*\(|\(:clean\b|:clean\)|\bu-clean\b|\bu_clean\b|\bcleanUtil\b|clean_util\b|\bclean\b.*\bctx\b/i

const FIXED: Row[] = [
  { target: 'ts', error: 'ts/src/utility/MakeErrorUtility.ts', done: 'ts/src/utility/DoneUtility.ts',
    log: 'ts/src/feature/log/LogFeature.ts', debug: 'ts/src/feature/debug/DebugFeature.ts', call: CLEAN_CALL },
  { target: 'js', error: 'js/src/utility/MakeErrorUtility.js', done: 'js/src/utility/DoneUtility.js',
    log: 'js/src/feature/log/LogFeature.js', debug: 'js/src/feature/debug/DebugFeature.js', call: CLEAN_CALL },
]

// A target here has not been ported yet, with the reason; it must be empty
// before a release that carries ADR-003 for the whole fleet.
const OUTSTANDING: Record<string, string> = {
  go: 'port in progress', py: 'port in progress', rb: 'port in progress',
  php: 'port in progress', perl: 'port in progress', java: 'port in progress',
  csharp: 'port in progress', kotlin: 'port in progress', scala: 'port in progress',
  swift: 'port in progress', lua: 'port in progress', c: 'port in progress',
  cpp: 'port in progress', zig: 'port in progress', rust: 'port in progress',
  clojure: 'port in progress', elixir: 'port in progress', ocaml: 'port in progress',
}


function sdkTargets(): string[] {
  return Fs.readdirSync(Path.join(SDK, 'model', 'target'))
    .filter((f) => f.endsWith('.aontu') && 'target-index.aontu' !== f)
    .map((f) => f.replace(/\.aontu$/, ''))
    .filter((t) => !CONSUMER_TARGETS.includes(t))
    .sort()
}


describe('secret redaction coverage is honest', () => {

  test('every SDK target is classified exactly once', () => {
    const fixed = FIXED.map((r) => r.target)
    const listed = fixed.concat(Object.keys(OUTSTANDING)).sort()
    deepStrictEqual(listed, sdkTargets(),
      'a target is missing from, or duplicated across, FIXED and OUTSTANDING')
  })


  for (const row of FIXED) {
    test(row.target + ': clean is called at each egress and the sweep is generated', () => {
      for (const role of ['error', 'done', 'log', 'debug'] as const) {
        const file = Path.join(TM, row[role])
        ok(Fs.existsSync(file), row.target + ': no ' + role + ' file at ' + row[role])
        const src = Fs.readFileSync(file, 'utf8')
        ok(row.call.test(src),
          row.target + ': ' + row[role] + ' (' + role + ') never calls clean')
      }

      const sweep = Path.join(CMP, row.target, 'TestClean_' + row.target + '.ts')
      ok(Fs.existsSync(sweep), row.target + ': no TestClean component at ' + sweep)
      const aggregator = Path.join(CMP, row.target, 'Test_' + row.target + '.ts')
      ok(Fs.readFileSync(aggregator, 'utf8').includes('TestClean'),
        row.target + ': Test_' + row.target + '.ts does not register TestClean')
    })
  }
})
