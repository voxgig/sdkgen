import { test, describe } from 'node:test'
import { deepStrictEqual } from 'node:assert'

const { spans } = require('../dist/helpers/markdown.js')


// Wrapping splits a paragraph at spaces; a code span with spaces in it is one
// word, so no wrapped line breaks inside it.
describe('markdown spans', () => {
  test('a code span with spaces is one word', () => {
    deepStrictEqual(spans('so branch on `getp(&result, "ok") == Value::Bool(true)`.'),
      ['so', 'branch', 'on', '`getp(&result, "ok") == Value::Bool(true)`.'])
  })
  test('plain words and spans without spaces are split as before', () => {
    deepStrictEqual(spans('a `b` c `d e` f'), ['a', '`b`', 'c', '`d e`', 'f'])
  })
})
