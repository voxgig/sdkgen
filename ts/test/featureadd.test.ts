// `feature add <name>` — the per-target source fan-out.
//
// WHAT WENT WRONG
//
// The fan-out copied a feature's per-target source with NO replace map, while
// `target add` copies the same target's `tm/<t>` tree WITH
// `templateReplacements`. So a feature source file carrying `ProjectName`
// arrived substituted or raw depending only on which action wrote it last:
//
//   target add ts   -> tm/ts/src/feature/log/LogFeature.ts   (substituted)
//   feature add log -> tm/ts/src/feature/log/LogFeature.ts   (RAW, overwrites)
//
// leaving `import type { ProjectNameSDK } from '../../ProjectNameSDK'` in a
// project whose SDK class is `DemoSDK` — a file that cannot compile, from a
// placeholder the toolchain is supposed to have consumed.
//
// This is the exact writer/writer disagreement `helpers/stdrep.ts` exists to
// prevent ("ONE definition, because two consumers must agree exactly"); the
// fan-out was the one writer that did not share the map.

import { test, describe } from 'node:test'
import { ok } from 'node:assert'

import {
  makeProject, targetRef, target_add, feature_add, ROOT,
} from './actionharness'


// A ts feature whose source names the SDK class, so substitution is visible.
const FEATURE = 'log'
const SOURCE = 'tm/ts/src/feature/log/LogFeature.ts'


async function addTargetThenFeature() {
  const project = makeProject({
    target: { ts: { name: 'ts' } },
    feature: { [FEATURE]: { name: FEATURE, active: true } },
  })

  await target_add([targetRef('ts')], project.actx)
  await feature_add([FEATURE], project.actx)

  return project
}


describe('feature add fan-out', () => {

  test('feature source is SUBSTITUTED, not raw', async () => {
    const project = await addTargetThenFeature()
    const src = project.fs.readFileSync(ROOT + '/' + SOURCE, 'utf8')

    ok(!src.includes('ProjectName'),
      'raw ProjectName survived into the project: ' +
      String(src).split('\n').filter((l: string) => l.includes('ProjectName'))
        .slice(0, 3).join(' | '))
    ok(src.includes('DemoSDK'),
      'the SDK class name was never substituted')
  })


  test('the fan-out agrees with what target add wrote', async () => {
    // The real invariant: whichever action writes the file last, the bytes
    // are the same. Previously the second writer undid the first.
    const first = makeProject({
      target: { ts: { name: 'ts' } },
      feature: { [FEATURE]: { name: FEATURE, active: true } },
    })
    await target_add([targetRef('ts')], first.actx)
    const afterTarget = first.fs.readFileSync(ROOT + '/' + SOURCE, 'utf8')

    const second = await addTargetThenFeature()
    const afterFeature = second.fs.readFileSync(ROOT + '/' + SOURCE, 'utf8')

    ok(afterTarget === afterFeature,
      'target add and feature add write different bytes for the same file')
  })


  test('feature add is idempotent', async () => {
    const project = await addTargetThenFeature()
    const once = project.fs.readFileSync(ROOT + '/' + SOURCE, 'utf8')

    await feature_add([FEATURE], project.actx)
    const twice = project.fs.readFileSync(ROOT + '/' + SOURCE, 'utf8')

    ok(once === twice, 'a second feature add changed the file')
  })
})
