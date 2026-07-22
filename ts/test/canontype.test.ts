
import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual, ok } from 'node:assert'

import { canonToType, canonKey } from '../dist/sdkgen.js'

const { CANON_TYPE, CANON_ANY } = require('../dist/helpers/canonType.js')


const LANGS = [
  'ts', 'js', 'py', 'php', 'rb', 'lua', 'go',
  'csharp', 'java', 'kotlin', 'scala', 'swift', 'dart',
  'rust', 'c', 'cpp', 'elixir',
] as const

// Expected concrete type per (sentinel, language). Mirrors CANON_TYPE; this is
// the cross-language coverage the generators rely on — EVERY language with an
// EntityTypes emitter has a column here, pinned by hand (a change to the table
// must consciously change this test).
const EXPECT: Record<string, Record<string, string>> = {
  STRING: {
    ts: 'string', js: 'string', py: 'str', php: 'string', rb: 'String',
    lua: 'string', go: 'string', csharp: 'string', java: 'String',
    kotlin: 'String?', scala: 'String', swift: 'String', dart: 'String',
    rust: 'String', c: 'char*', cpp: 'std::string', elixir: 'String.t()',
  },
  INTEGER: {
    ts: 'number', js: 'number', py: 'int', php: 'int', rb: 'Integer',
    lua: 'number', go: 'int', csharp: 'long', java: 'Long',
    kotlin: 'Long?', scala: 'java.lang.Long', swift: 'Int', dart: 'int',
    rust: 'i64', c: 'int64_t', cpp: 'int64_t', elixir: 'integer()',
  },
  NUMBER: {
    ts: 'number', js: 'number', py: 'float', php: 'float', rb: 'Float',
    lua: 'number', go: 'float64', csharp: 'double', java: 'Double',
    kotlin: 'Double?', scala: 'java.lang.Double', swift: 'Double', dart: 'num',
    rust: 'f64', c: 'double', cpp: 'double', elixir: 'float()',
  },
  BOOLEAN: {
    ts: 'boolean', js: 'boolean', py: 'bool', php: 'bool', rb: 'Boolean',
    lua: 'boolean', go: 'bool', csharp: 'bool', java: 'Boolean',
    kotlin: 'Boolean?', scala: 'java.lang.Boolean', swift: 'Bool', dart: 'bool',
    rust: 'bool', c: 'bool', cpp: 'bool', elixir: 'boolean()',
  },
  NULL: {
    ts: 'null', js: 'null', py: 'None', php: 'null', rb: 'NilClass',
    lua: 'nil', go: 'any', csharp: 'object?', java: 'Object',
    kotlin: 'Any?', scala: 'Object', swift: 'Value', dart: 'Object',
    rust: 'Value', c: 'voxgig_value*', cpp: 'Value', elixir: 'nil',
  },
  ARRAY: {
    ts: 'any[]', js: 'Array', py: 'list', php: 'array', rb: 'Array',
    lua: 'table', go: '[]any', csharp: 'List<object?>', java: 'List<Object>',
    kotlin: 'List<Any?>?', scala: 'java.util.List[Object]', swift: '[Value]',
    dart: 'List<dynamic>', rust: 'Vec<Value>', c: 'voxgig_value*',
    cpp: 'std::vector<Value>', elixir: 'list()',
  },
  OBJECT: {
    ts: 'Record<string, any>', js: 'Object', py: 'dict', php: 'array',
    rb: 'Hash', lua: 'table', go: 'map[string]any',
    csharp: 'Dictionary<string, object?>', java: 'Map<String, Object>',
    kotlin: 'Map<String, Any?>?', scala: 'java.util.Map[String, Object]',
    swift: 'VMap', dart: 'Map<String, dynamic>',
    rust: 'std::collections::HashMap<String, Value>', c: 'voxgig_value*',
    cpp: 'std::map<std::string, Value>', elixir: 'map()',
  },
  ANY: {
    ts: 'any', js: '*', py: 'Any', php: 'mixed', rb: 'Object',
    lua: 'any', go: 'any', csharp: 'object?', java: 'Object',
    kotlin: 'Any?', scala: 'Object', swift: 'Value', dart: 'dynamic',
    rust: 'Value', c: 'voxgig_value*', cpp: 'Value', elixir: 'any()',
  },
}

// Per-language "any" fallback for unknown / missing sentinels.
const ANY: Record<string, string> = {
  ts: 'any', js: '*', py: 'Any', php: 'mixed', rb: 'Object',
  lua: 'any', go: 'any', csharp: 'object?', java: 'Object',
  kotlin: 'Any?', scala: 'Object', swift: 'Value', dart: 'dynamic',
  rust: 'Value', c: 'voxgig_value*', cpp: 'Value', elixir: 'any()',
}

// The union ($ONE) sentinel as apidef's validator produces it:
// ['`$ONE`', [member, ...]].
const UNION = (...members: any[]) => ['`$ONE`', members]


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

  test('EXPECT pins the full CANON_TYPE table (no drift either way)', () => {
    deepStrictEqual(Object.keys(CANON_TYPE).sort(), Object.keys(EXPECT).sort())
    for (const sentinel of Object.keys(CANON_TYPE)) {
      deepStrictEqual(
        Object.keys(CANON_TYPE[sentinel]).sort(), [...LANGS].sort(),
        `CANON_TYPE.${sentinel} columns`,
      )
    }
    deepStrictEqual(Object.keys(CANON_ANY).sort(), [...LANGS].sort())
  })

  test('unknown / bare $ONE / missing -> that language\'s any', () => {
    for (const lang of LANGS) {
      // A BARE `$ONE` string (no member list) is not a valid union form.
      strictEqual(canonToType('`$ONE`', lang), ANY[lang], `$ONE / ${lang}`)
      strictEqual(canonToType('`$NOPE`', lang), ANY[lang], `unknown / ${lang}`)
      strictEqual(canonToType(undefined, lang), ANY[lang], `missing / ${lang}`)
    }
  })

  test('unknown language -> ts-style any, never throws', () => {
    strictEqual(canonToType('`$STRING`', 'cobol'), 'any')
  })
})


describe('canonToType — $ONE unions', () => {
  const u = UNION('`$STRING`', '`$INTEGER`')

  test('languages with union syntax render a joined member list', () => {
    strictEqual(canonToType(u, 'ts'), 'string | number')
    strictEqual(canonToType(u, 'js'), 'string|number')
    strictEqual(canonToType(u, 'py'), 'str | int')
    strictEqual(canonToType(u, 'lua'), 'string|number')
    strictEqual(canonToType(u, 'elixir'), 'String.t() | integer()')
  })

  test('languages without anonymous unions degrade to their any', () => {
    for (const lang of ['php', 'rb', 'go', 'csharp', 'java', 'kotlin',
      'scala', 'swift', 'dart', 'rust', 'c', 'cpp']) {
      strictEqual(canonToType(u, lang), ANY[lang], `union / ${lang}`)
    }
  })

  test('members dedupe; nested unions flatten recursively', () => {
    // number | number -> number
    strictEqual(canonToType(UNION('`$NUMBER`', '`$INTEGER`'), 'ts'), 'number')
    // nested: string | (integer | boolean)
    strictEqual(
      canonToType(UNION('`$STRING`', UNION('`$INTEGER`', '`$BOOLEAN`')), 'ts'),
      'string | number | boolean',
    )
  })

  test('unknown member (apidef literal "Any") -> that language\'s any member', () => {
    strictEqual(canonToType(UNION('`$STRING`', 'Any'), 'ts'), 'string | any')
  })

  test('degenerate arrays fall back to any', () => {
    strictEqual(canonToType([], 'ts'), 'any')
    strictEqual(canonToType(['`$ONE`'], 'ts'), 'any')
    strictEqual(canonToType(['nope', []], 'ts'), 'any')
    strictEqual(canonToType(UNION(), 'ts'), 'any')
  })
})
