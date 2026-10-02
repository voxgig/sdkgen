import { test } from 'node:test'
import assert from 'node:assert/strict'
import { liveStrict, liveStrictNote, liveFlowNeeds } from '../dist/sdkgen'

const model = (global?: boolean, go?: boolean) => ({ main: { kit: {
  test: null == global ? {} : { live: { strict: global } },
  target: { go: null == go ? {} : { test: { live: { strict: go } } }, ts: {} },
} } })

test('live strictness defaults to true and a target overrides the model', () => {
  assert.equal(liveStrict(model(), 'ts'), true)
  assert.equal(liveStrict(model(false), 'ts'), false)
  assert.equal(liveStrict(model(false, true), 'go'), true)
  assert.equal(liveStrict(model(true, false), 'go'), false)
  assert.equal(liveStrict(model(false, true), 'ts'), false)
  assert.equal(liveStrict({}), true)
})

test('the strictness note states the value and what it does', () => {
  assert.equal(liveStrictNote(true, '//', '  '), [
    '  // main.kit.test.live.strict is true (the default is true): a live',
    '  // request that fails, or a live test missing an input it needs,',
    '  // fails the test.',
    '  // An account with no record for a test to read skips it either way.',
  ].join('\n'))
  assert.match(liveStrictNote(false, '#'), /^# main\.kit\.test\.live\.strict is false .*\n.*\n# skips the test with the reason\.\n/)
})

const flow = (...step: any[]) => ({ step })

test('a flow that creates its record needs only the ids its steps bind', () => {
  const entity = { name: 'moon', id: { field: 'id' } }
  assert.deepEqual(liveFlowNeeds(entity, flow(
    { o: 'create', m: { planet_id: 'planet01' } },
    { o: 'list', m: { planet_id: 'planet01', key$: 'm' } },
    { o: 'update', d: { title: 'title' } },
    { o: 'load' }, { o: 'remove' },
  )), { keys: ['planet01', 'title'] })
})

test('a create-less flow lists its record, or says why it cannot run live', () => {
  const entity = { name: 'metric', id: { field: 'id' } }
  assert.deepEqual(liveFlowNeeds(entity, flow({ o: 'list', m: { account_id: 'account01' } }, { o: 'load' })),
    { keys: ['account01'], discover: { account_id: 'account01' } })
  assert.deepEqual(liveFlowNeeds(entity, flow({ o: 'list' })), { keys: [] })
  assert.deepEqual(liveFlowNeeds(entity, flow({ o: 'load' })),
    { keys: [], blocked: 'the flow loads a metric record it has no list to find' })
  assert.deepEqual(liveFlowNeeds(entity, flow({ o: 'list' }, { o: 'update', d: {} })),
    { keys: [], blocked: 'the flow updates a metric record it did not create' })
  assert.deepEqual(liveFlowNeeds({ name: 'ambient' }, flow({ o: 'load' })), { keys: [] })
})
