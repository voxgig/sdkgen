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
  // The files that must call clean; one file may serve several roles.
  error: string
  done: string
  log: string
  debug: string
  // How a call to clean is spelled in this target.
  call: RegExp
}

const CLEAN_CALL = /clean\w*\s*\(|\bclean_\w+\s*\(|\bClean\.\w*clean\w*\s*\(|\(:clean\b|:clean\)|\bu-clean\b|\bu_clean\b|\bcleanUtil\b|clean_util\b|\bclean\b.*\bctx\b/i

const FIXED: Row[] = [
  { target: 'ts', error: 'ts/src/utility/MakeErrorUtility.ts', done: 'ts/src/utility/DoneUtility.ts',
    log: 'ts/src/feature/log/LogFeature.ts', debug: 'ts/src/feature/debug/DebugFeature.ts', call: CLEAN_CALL },
  { target: 'js', error: 'js/src/utility/MakeErrorUtility.js', done: 'js/src/utility/DoneUtility.js',
    log: 'js/src/feature/log/LogFeature.js', debug: 'js/src/feature/debug/DebugFeature.js', call: CLEAN_CALL },
  { target: 'py', error: 'py/pkg/utility/make_error.py', done: 'py/pkg/utility/done.py',
    log: 'py/pkg/feature/log_feature.py', debug: 'py/pkg/feature/debug_feature.py', call: CLEAN_CALL },
  { target: 'rb', error: 'rb/utility/make_error.rb', done: 'rb/utility/done.rb',
    log: 'rb/feature/log_feature.rb', debug: 'rb/feature/debug_feature.rb', call: CLEAN_CALL },
  { target: 'java', error: 'java/utility/MakeError.java', done: 'java/utility/Done.java',
    log: 'java/feature/LogFeature.java', debug: 'java/feature/DebugFeature.java', call: CLEAN_CALL },
  { target: 'php', error: 'php/utility/MakeError.php', done: 'php/utility/Done.php',
    log: 'php/feature/LogFeature.php', debug: 'php/feature/DebugFeature.php', call: CLEAN_CALL },
  { target: 'cpp', error: 'cpp/utility/pipeline.hpp', done: 'cpp/utility/pipeline.hpp',
    log: 'cpp/feature/log.hpp', debug: 'cpp/feature/debug.hpp', call: CLEAN_CALL },
  { target: 'go', error: 'go/utility/make_error.go', done: 'go/utility/done.go',
    log: 'go/feature/log_feature.go', debug: 'go/feature/debug_feature.go', call: CLEAN_CALL },
  { target: 'c', error: 'c/utility/make_error.c', done: 'c/utility/done.c',
    log: 'c/feature/log.c', debug: 'c/feature/debug.c', call: CLEAN_CALL },
  { target: 'rust', error: 'rust/utility/make_error.rs', done: 'rust/utility/done.rs',
    log: 'rust/feature/log.rs', debug: 'rust/feature/debug.rs', call: CLEAN_CALL },
  { target: 'lua', error: 'lua/utility/make_error.lua', done: 'lua/utility/done.lua',
    log: 'lua/feature/log_feature.lua', debug: 'lua/feature/debug_feature.lua', call: CLEAN_CALL },
  { target: 'zig', error: 'zig/core/utility.zig', done: 'zig/core/utility.zig',
    log: 'zig/feature/log.zig', debug: 'zig/feature/debug.zig', call: CLEAN_CALL },
]

// Not yet ported, with the reason; empty before a fleet-wide release.
const OUTSTANDING: Record<string, string> = { perl: 'port in progress',
  csharp: 'port in progress', kotlin: 'port in progress', scala: 'port in progress',
  swift: 'port in progress',
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
