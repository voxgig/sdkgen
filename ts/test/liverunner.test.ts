import { test } from 'node:test'
import assert from 'node:assert/strict'
const { runLiveSteps, assertLiveReport } = require('../project/.sdk/tm/js/test/live-runner')

test('live steps publish cleanup data even when a later assertion fails', async () => {
  const order: string[] = []
  const report = await runLiveSteps([
    { id: 'create', run: async (ctx: any) => {
      order.push('create'); ctx.attempted(); ctx.publish({ id: 'new01', key: 'SECRET_SENTINEL' })
      throw new Error('assertion failed SECRET_SENTINEL')
    } },
    { id: 'independent', run: async (ctx: any) => { order.push('read'); ctx.attempted() } },
    { id: 'cleanup', cleanup: true, needs: ['create'], run: async (ctx: any) => {
      assert.equal(ctx.values.get('create').id, 'new01'); order.push('cleanup'); ctx.attempted()
    } },
  ])
  assert.deepEqual(order, ['create', 'read', 'cleanup'])
  assert.equal(report.failed, 1)
  assert.equal(report.passed, 2)
  assert(!JSON.stringify(report).includes('SECRET_SENTINEL'))
  assert.throws(() => assertLiveReport(report), /Live coverage incomplete/)
})

test('dependencies can precede their producer without halting independent work', async () => {
  const order: string[] = []
  const report = await runLiveSteps([
    { id: 'dependent', needs: ['producer'], run: async (ctx: any) => {
      assert.equal(ctx.values.get('producer'), 42); order.push('dependent'); ctx.attempted()
    } },
    { id: 'producer', run: async (ctx: any) => { order.push('producer'); ctx.attempted(); ctx.publish(42) } },
    { id: 'other', run: async (ctx: any) => { order.push('other'); ctx.attempted() } },
  ])
  assert.deepEqual(order, ['producer', 'other', 'dependent'])
  assertLiveReport(report)
})

test('cycles and missing dependencies are blocked after independent steps run', async () => {
  const report = await runLiveSteps([
    { id: 'a', needs: ['b'], run: async () => assert.fail('cycle ran') },
    { id: 'b', needs: ['a'], run: async () => assert.fail('cycle ran') },
    { id: 'c', needs: ['absent'], run: async () => assert.fail('missing dependency ran') },
    { id: 'independent', run: async (ctx: any) => { ctx.attempted() } },
  ])
  assert.equal(report.passed, 1)
  assert.equal(report.blocked, 3)
  assert.throws(() => assertLiveReport(report))
})

test('an empty, excluded, or unattempted plan cannot claim live success', async () => {
  const empty = await runLiveSteps([])
  const excluded = await runLiveSteps([{ id: 'excluded', excluded: 'disabled', run: async () => assert.fail('excluded ran') }])
  const unattempted = await runLiveSteps([{ id: 'unattempted', run: async () => {} }])
  assert.equal(excluded.excluded, 1)
  assert.equal(unattempted.blocked, 1)
  for (const report of [empty, excluded, unattempted]) assert.throws(() => assertLiveReport(report))
})

test('invalid published output blocks dependent work but remains available for cleanup', async () => {
  const report = await runLiveSteps([
    { id: 'produce', run: async (ctx: any) => { ctx.attempted(); ctx.publish({id:'owned'}); throw Error('invalid vector') } },
    { id: 'dependent', needs: ['produce'], run: async () => assert.fail('invalid output consumed') },
    { id: 'cleanup', cleanup:true, needs:['produce'], run: async (ctx: any) => { assert.equal(ctx.values.get('produce').id,'owned');ctx.attempted() } },
    { id: 'independent', run: async (ctx: any) => ctx.attempted() },
  ])
  assert.equal(report.failed,1);assert.equal(report.blocked,1);assert.equal(report.passed,2)
})
