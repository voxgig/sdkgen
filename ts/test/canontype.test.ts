
import { test, describe } from 'node:test'
import { strictEqual } from 'node:assert'

import { canonToType, canonKey } from '../dist/sdkgen.js'


const LANGS = ['ts', 'js', 'py', 'php', 'rb', 'lua', 'go'] as const

// Expected concrete type per (sentinel, language). Mirrors CANON_TYPE; this is
// the cross-language coverage the generators rely on (previously only the `ts`
// column was exercised).
const EXPECT: Record<string, Record<string, string>> = {
  STRING:  { ts: 'string', js: 'string', py: 'str', php: 'string', rb: 'String', lua: 'string', go: 'string' },
  INTEGER: { ts: 'number', js: 'number', py: 'int', php: 'int', rb: 'Integer', lua: 'number', go: 'int' },
  NUMBER:  { ts: 'number', js: 'number', py: 'float', php: 'float', rb: 'Float', lua: 'number', go: 'float64' },
  BOOLEAN: { ts: 'boolean', js: 'boolean', py: 'bool', php: 'bool', rb: 'Boolean', lua: 'boolean', go: 'bool' },
  NULL:    { ts: 'null', js: 'null', py: 'None', php: 'null', rb: 'NilClass', lua: 'nil', go: 'any' },
  ARRAY:   { ts: 'any[]', js: 'Array', py: 'list', php: 'array', rb: 'Array', lua: 'table', go: '[]any' },
  OBJECT:  { ts: 'Record<string, any>', js: 'Object', py: 'dict', php: 'array', rb: 'Hash', lua: 'table', go: 'map[string]any' },
  ANY:     { ts: 'any', js: '*', py: 'Any', php: 'mixed', rb: 'Object', lua: 'any', go: 'any' },
}

// Per-language "any" fallback for unknown / $ONE / missing sentinels.
const ANY: Record<string, string> = {
  ts: 'any', js: '*', py: 'Any', php: 'mixed', rb: 'Object', lua: 'any', go: 'any',
}


describe('canonKey', () => {
  test('strips backticks/$ and upper-cases', () => {
    strictEqual(canonKey('`$STRING`'), 'STRING')
    strictEqual(canonKey('$STRING'), 'STRING')
    strictEqual(canonKey('string'), 'STRING')
    strictEqual(canonKey('  `$Integer` '), 'INTEGER')
  })
  test('nullish -> empty', () => {
    strictEqual(canonKey(null), '')
    strictEqual(canonKey(undefined), '')
  })
})


describe('canonToType — every sentinel across every language', () => {
  for (const sentinel of Object.keys(EXPECT)) {
    test(`$${sentinel}`, () => {
      for (const lang of LANGS) {
        strictEqual(
          canonToType('`$' + sentinel + '`', lang),
          EXPECT[sentinel][lang],
          `${sentinel} / ${lang}`,
        )
      }
    })
  }

  test('unknown / $ONE / missing -> that language\'s any', () => {
    for (const lang of LANGS) {
      strictEqual(canonToType('`$ONE`', lang), ANY[lang], `$ONE / ${lang}`)
      strictEqual(canonToType('`$NOPE`', lang), ANY[lang], `unknown / ${lang}`)
      strictEqual(canonToType(undefined, lang), ANY[lang], `missing / ${lang}`)
    }
  })

  test('unknown language -> ts-style any, never throws', () => {
    strictEqual(canonToType('`$STRING`', 'cobol'), 'any')
  })
})
