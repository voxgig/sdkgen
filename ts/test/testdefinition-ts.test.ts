import { test, describe } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import Os from 'node:os'
import Path from 'node:path'

import { transform } from 'sucrase'


const CMP = Path.resolve(__dirname, '..', 'project', '.sdk', 'src', 'cmp', 'ts', 'TestDefinition_ts.ts')
const TSC = Path.resolve(__dirname, '..', 'node_modules', '.bin', 'tsc')


// The shipped component, rendered with the given plan: its sdkgen imports are
// shimmed, since the point is the text it writes.
function render(plan: any[]): string {
  const js = transform(readFileSync(CMP, 'utf8'), {
    transforms: ['typescript', 'imports'],
    filePath: CMP,
  }).code
  let out = ''
  const sdkgen = {
    cmp: (fn: any) => fn,
    File: (_opts: any, fn: () => void) => fn(),
    Content: (text: string) => { out += text },
    definitionPlan: () => plan,
  }
  const mod: any = { exports: {} }
  new Function('exports', 'require', 'module', js)(
    mod.exports, (p: string) => '@voxgig/sdkgen' === p ? sdkgen : require(p), mod)
  mod.exports.TestDefinition({ ctx$: {} })
  return out
}


// Points of many shapes, as a large API's are: tsc types an array literal of
// them as the union of every element's type.
function bigPlan(size: number): any[] {
  const plan: any[] = []
  for (let i = 0; i < size; i++) {
    const point: any = { entity: 'e' + i, op: 'load', method: 'GET', path: '/e' + i + '/{id}' }
    point['k' + (i % 400)] = 0 === i % 3 ? i : 'x'
    if (0 !== i % 7) point.sample = { ['f' + (i % 50)]: [i, 'y'] }
    plan.push(point)
  }
  plan[0].sample = { text: 'a `tick`, ${x}, "quotes", back\\slash,   and </script>' }
  return plan
}


// Type-check one generated test beside stand-ins for the modules it imports.
function typecheck(source: string): string {
  const dir = mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-testdefinition-'))
  try {
    mkdirSync(Path.join(dir, 'test'))
    writeFileSync(Path.join(dir, 'index.ts'), 'export const SDK: any = undefined\n')
    writeFileSync(Path.join(dir, 'test', 'definition-runner.ts'),
      'export async function runDefinitionPoint(_sdk: any, _point: any): Promise<void> {}\n')
    writeFileSync(Path.join(dir, 'test', 'utility.ts'),
      'export function isControlSkipped(..._args: any[]): { skip: boolean, reason?: string } ' +
      '{ return { skip: false } }\n')
    writeFileSync(Path.join(dir, 'test', 'node-test.d.ts'), "declare module 'node:test' {\n" +
      '  export function describe(name: string, fn: () => void): void\n' +
      '  export function test(name: string, fn: (t: any) => any): void\n}\n')
    writeFileSync(Path.join(dir, 'test', 'definition.test.ts'), source)
    const res = spawnSync(TSC, ['--noEmit', '--strict', '--types', '', '--target', 'es2021',
      '--module', 'commonjs', 'test/node-test.d.ts', 'test/definition.test.ts'],
    { cwd: dir, encoding: 'utf8' })
    return (res.stdout ?? '') + (res.stderr ?? '') + (null == res.error ? '' : String(res.error))
  }
  finally {
    rmSync(dir, { recursive: true, force: true })
  }
}


describe('TestDefinition_ts', () => {
  const plan = bigPlan(1800)
  const source = render(plan)

  test('the plan is written as JSON and reads back unchanged', () => {
    const m = /\nconst PLAN: any\[\] = JSON\.parse\(("(?:[^"\\\n]|\\.)*")\)\n/.exec(source)
    ok(null != m, 'PLAN is not a JSON.parse of one string literal')
    deepStrictEqual(JSON.parse(JSON.parse(m![1])), plan)
  })

  test('a plan of 1,800 routes type-checks', () => {
    const out = typecheck(source)
    ok('' === out.trim(), out)
  })

  test('the same plan as an array literal fails with TS2590', () => {
    const literal = source.replace(/\nconst PLAN: any\[\] = JSON\.parse\([^\n]*\)\n/,
      () => '\nconst PLAN: any[] = ' + JSON.stringify(plan, null, 2) + '\n')
    ok(literal !== source)
    const out = typecheck(literal)
    ok(out.includes('TS2590'),
      'the synthetic plan no longer reaches the union limit as a literal: enlarge it\n' + out)
  })
})
