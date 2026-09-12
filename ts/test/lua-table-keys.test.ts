import { test, describe } from 'node:test'
import { deepStrictEqual } from 'node:assert'

import Path from 'node:path'
import Fs from 'node:fs'


// `luaKey` lives in helpers/naming.ts and is exported from the package, next to
// `jsKey` which does the same job for ts/js. Its BEHAVIOUR is tested in
// helpers.test.ts. This guards the thing that behaviour test cannot see: that
// the lua components actually use it.
//
// They did not. Six README components each carried a private copy, all six
// identical and all six testing only `/^[A-Za-z_]\w*$/`. A Lua keyword matches
// that pattern, so `{ end = "end" }` was emitted as a bare key and does not
// parse — and the single missing condition was missing six times over.
//
// A seventh copy would reintroduce it, so the rule is: no local definition, and
// every caller imports the shared one.
const CMP_LUA = Path.join(__dirname, '..', 'project', '.sdk', 'src', 'cmp', 'lua')

// `function luaKey(` or `const luaKey =` — the two shapes the six copies used.
const LOCAL_DEF = /(?:^|\s)(?:function\s+luaKey\s*\(|const\s+luaKey\s*(?::[^=]*)?=)/m

const IMPORTS_IT = /import \{[^}]*\bluaKey\b[^}]*\} from '@voxgig\/sdkgen'/


function luaComponents(): Array<[string, string]> {
  return Fs.readdirSync(CMP_LUA)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => [f, Fs.readFileSync(Path.join(CMP_LUA, f), 'utf8')] as [string, string])
}


describe('lua table key guard', () => {

  test('no lua component defines its own key helper', () => {
    const definers = luaComponents()
      .filter(([, src]) => LOCAL_DEF.test(src))
      .map(([f]) => f)

    deepStrictEqual(definers, [],
      'luaKey must come from @voxgig/sdkgen — a local copy drifts from the keyword list')
  })


  test('every lua component that emits a key imports the shared helper', () => {
    const missing = luaComponents()
      .filter(([, src]) => /\bluaKey\(/.test(src))
      .filter(([, src]) => !IMPORTS_IT.test(src))
      .map(([f]) => f)

    deepStrictEqual(missing, [], 'these call luaKey without importing it')
  })


  test('the components that emit table keys are wired up', () => {
    // A regression here means a component stopped quoting keys altogether,
    // which the two tests above cannot distinguish from "does not need to".
    const callers = luaComponents()
      .filter(([, src]) => /\bluaKey\(/.test(src))
      .map(([f]) => f)
      .sort()

    deepStrictEqual(callers, [
      'ReadmeEntity_lua.ts',
      'ReadmeHowto_lua.ts',
      'ReadmeQuick_lua.ts',
      'ReadmeRef_lua.ts',
      'ReadmeTopQuick_lua.ts',
      'ReadmeTopTest_lua.ts',
    ])
  })

})
