import { test, describe } from 'node:test'
import { deepStrictEqual } from 'node:assert'

import { exportedNames, missingExports } from '../dist/helpers/exportnames.js'


const SOURCE = [
  "import { x } from './x'",
  'export function one() { }',
  'export async function two() { }',
  'export const three = 3',
  'export class Four<T> { }',
  'export interface Five { }',
  'export type Six = string',
  'export {',
  '  seven,',
  '  eight as Eight,',
  '  type Nine,',
  '}',
  'export type { Ten } from \'./ten\'',
  '  export const indented = 1',
  'const text = `',
  'export class ${name}Entity { }',
  'export { ${names} }',
  '`',
].join('\n')


describe('exportnames', () => {

  test('reads declarations and export lists, not generated text', () => {
    deepStrictEqual([...exportedNames(SOURCE)].sort(), [
      'Eight', 'Five', 'Four', 'Nine', 'Six', 'Ten', 'one', 'seven', 'three', 'two',
    ])
  })


  test('names what the incoming copy exports and the local one lacks', () => {
    deepStrictEqual(missingExports(
      'export {\n  a,\n  b,\n  c,\n}\n', 'export {\n  a,\n  c,\n  d,\n}\n'), ['b'])
    deepStrictEqual(missingExports('export const a = 1\n', 'export function a() { }\n'), [])
  })
})
