import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  liveStrict, liveStrictNote, liveFlowNeeds, guardFlowSteps,
  liveIdKey, liveExampleIds, liveQueryExamples, liveRouteExamples, liveStepExamples,
} from '../dist/sdkgen'

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


test('a step switched off for want of a route is marked for the live harness', () => {
  const action = (name: string) => ({ m: 'GET', o: '/signal/' + name, s: [], q: { $action: name } })
  const model = { main: { kit: {
    entity: { signal: { name: 'signal', fields: {}, op: { list: { points: [action('weak'), action('strong')] } } } },
    flow: { BasicSignalFlow: { entity: 'signal', step: [{ o: 'list' }, { o: 'list', a: false }] } },
  } } }
  assert.deepEqual(guardFlowSteps(model), [{ flow: 'BasicSignalFlow', step: 0, op: 'list' }])
  const [guarded, disabled] = model.main.kit.flow.BasicSignalFlow.step as any[]
  assert.deepEqual([guarded.a, guarded.unreachable], [false, true])
  assert.deepEqual([disabled.a, disabled.unreachable], [false, undefined])
})


const arg = (k: string, n: string, r: boolean, ex?: any) => ({ k, n, r, ...(undefined === ex ? {} : { ex }) })
const route = (o: string, params: any[] = [], query: any[] = [], extra: any = {}) =>
  ({ m: 'GET', o, g: { params, query }, ...extra })

test('a live id key is the one the live harness reads', () => {
  assert.equal(liveIdKey('product', 'id'), 'product01')
  assert.equal(liveIdKey('product', 'board_id'), 'board01')
  assert.equal(liveIdKey('product', 'slug'), 'slug01')
})

test('a direct test defaults each path parameter id to its example', () => {
  const entity = { name: 'product', op: {
    list: { points: [route('/api/{slug}.json', [arg('param', 'slug', true, 'php')])] },
    load: { points: [route('/api/{slug}/{id}', [arg('param', 'slug', true, 'other'),
      arg('param', 'id', true, 7), arg('param', 'shelf_id', true)])] },
  } }
  assert.deepEqual(liveExampleIds(entity), [['product01', 7], ['slug01', 'php']])
  assert.deepEqual(liveExampleIds({ name: 'thread', op: { list: { points: [
    route('/{board}/threads.json', [arg('param', 'board', true)])] } } }), [])
})

test('a live request sends the examples of its required query parameters only', () => {
  assert.deepEqual(liveQueryExamples(route('/offers', [], [
    arg('query', 'asset', true, 'BTC'), arg('query', 'chain', false, 'eth'),
    arg('query', 'limit', true), arg('query', 'ids', true, ['a'])])), [['asset', 'BTC']])
  assert.deepEqual(liveQueryExamples(undefined), [])
})

test('a live flow fills the route the live harness takes', () => {
  const release = { name: 'release', op: { list: { points: [
    route('/api/{slug}.json', [arg('param', 'slug', true, 'php')]), route('/api/products.json')] } } }
  assert.deepEqual(liveRouteExamples(release, 'list', []), [['slug', 'php']])
  assert.deepEqual(liveRouteExamples(release, 'list', ['slug']), [])

  const thread = { name: 'thread', op: { list: { points: [
    route('/{board}/threads.json', [arg('param', 'board', true)]), route('/all.json', [], [arg('query', 'q', true, 'x')])] } } }
  assert.deepEqual(liveRouteExamples(thread, 'list', []), [['q', 'x']])
  assert.deepEqual(liveRouteExamples({ name: 'none', op: { list: { points: [
    route('/{board}/threads.json', [arg('param', 'board', true)])] } } }, 'list', []), [])

  const actions = { name: 'signal', op: { list: { points: [
    route('/signal/weak', [], [arg('query', 'q', true, 'x')], { q: { $action: 'weak' } })] } } }
  assert.deepEqual(liveRouteExamples(actions, 'list', []), [])
})

test('a load of a known record fills only its required query', () => {
  const book = { name: 'book', id: { field: 'id' }, op: { load: { points: [
    route('/shelf/{shelf}/book/{id}', [arg('param', 'shelf', true, 's1'), arg('param', 'id', true, 'b1')],
      [arg('query', 'lang', true, 'en')])] } } }
  assert.deepEqual(liveStepExamples(book, { o: 'load' }), [['lang', 'en']])
  assert.deepEqual(liveStepExamples({ ...book, id: undefined }, { o: 'load', m: { shelf: 'shelf01' } }),
    [['id', 'b1'], ['lang', 'en']])
  assert.deepEqual(liveStepExamples(book, { o: 'update' }), [])
})
