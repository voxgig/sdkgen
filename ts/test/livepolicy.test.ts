import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  liveStrict, liveStrictNote, liveFlowNeeds, guardFlowSteps,
  liveIdKey, liveExampleIds, liveQueryExamples, liveRouteExamples, liveStepExamples,
  flowLoadRoute, flowLoadReadsRecord, liveFlowRoutes, liveEntity, liveGetOnly, liveExcludedLines, liveExcludedSummary, LIVE_GETONLY_ENV,
  liveDirectGetOnly,
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

// direct() sends its query as given, so the key is the definition's name.
test('a live direct query keys each example by the name the API knows', () => {
  assert.deepEqual(liveQueryExamples(route('/elo-calculator', [], [
    { ...arg('query', 'opponent_rating', true, 1400), or: 'opponentRating' },
    { ...arg('query', 'k_factor', false, 32), or: 'kFactor' },
    arg('query', 'result', true, 'win')])), [['opponentRating', 1400], ['result', 'win']])
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


// proverb-mashup's shape: a record route keyed by the record's own lang
// and id, sorted before a parameter-free one, as apidef sorts them.
const field = (n: string, t = '`$STRING`') => ({ [n]: { n, t } })
const proverb = {
  name: 'proverb', id: { field: 'id', from: { id: 'id', lang: 'lang' }, parts: ['lang', 'id'] },
  fields: { ...field('id'), ...field('lang'), ...field('source', '`$OBJECT`') },
  op: { load: { points: [
    route('/proverbs/{lang}/{id}', [arg('param', 'id', true, 88), arg('param', 'lang', true, 'ro')]),
    route('/proverbs/random')] } },
}

test('a load of a listed record takes the route it can fill from that record', () => {
  const load = { o: 'load', m: {} }
  assert.deepEqual(flowLoadRoute(proverb, load), {
    route: 'GET /proverbs/{lang}/{id}', point: proverb.op.load.points[0],
    args: [{ name: 'lang', field: 'lang', idmap: ['lang'] }], offline: false,
  })
  // A binding is the fallback for a parameter the record carries.
  assert.deepEqual(flowLoadRoute(proverb, { o: 'load', m: { id: 'proverb01', lang: 'lang01' } })?.args,
    [{ name: 'lang', field: 'lang', idmap: ['lang', 'lang01'] }])
  // A parameter neither the record nor the step gives passes the route by.
  const bare = { ...proverb, fields: field('id'), id: { field: 'id' } }
  assert.equal(flowLoadRoute(bare, load), undefined)
  assert.deepEqual(flowLoadRoute(bare, { o: 'load', m: { lang: 'lang01' } })?.args,
    [{ name: 'lang', field: undefined, idmap: ['lang', 'lang01'] }])
  // Only a scalar field fills a route, and a dotted mapping reads into an object.
  assert.equal(flowLoadRoute({ ...bare, fields: { ...field('id'), ...field('lang', '`$OBJECT`') } }, load),
    undefined)
  assert.equal(flowLoadRoute({ ...proverb, id: { field: 'id', from: { lang: 'lang.code' } } }, load),
    undefined)
  // A record route is one that takes the id; an action route is never one.
  assert.equal(flowLoadRoute({ ...proverb, op: { load: { points: [route('/proverbs/random'),
    route('/proverbs/{lang}/{id}', [arg('param', 'id', true), arg('param', 'lang', true)],
      [], { q: { $action: 'one' } })] } } }, load), undefined)
  assert.equal(flowLoadRoute(proverb, { o: 'list' }), undefined)
})


// college-roi's shape: no id, loaded by a slug its record holds, which the
// fixture's idmap binding names no record by.
const slug = {
  name: 'slug', fields: { ...field('name'), ...field('slug') },
  op: { load: { points: [
    route('/colleges/{slug}.json', [arg('param', 'slug', true)]),
    route('/majors/{slug}.json', [arg('param', 'slug', true)])] } },
}

test('a load of an entity with no id keeps the route its step binds, read from the record offline', () => {
  const load = { o: 'load', m: { slug: 'slug01' } }
  assert.deepEqual(flowLoadRoute(slug, load), {
    route: 'GET /colleges/{slug}.json', point: slug.op.load.points[0],
    args: [{ name: 'slug', field: 'slug', idmap: ['slug', 'slug01'] }], offline: true,
  })
  assert.equal(flowLoadReadsRecord(slug, load), true)
  // A parameter the step does not bind is not added from the record, and an
  // id binding names no parameter of an entity that has no id.
  assert.equal(flowLoadRoute(slug, { o: 'load', m: {} }), undefined)
  assert.equal(flowLoadRoute(slug, { o: 'load', m: { id: 'slug01' } }), undefined)
  assert.equal(flowLoadReadsRecord(slug, { o: 'load', m: {} }), false)
  // A parameter the record holds no scalar for keeps the binding alone.
  const opaque = { ...slug, fields: { ...field('name'), ...field('slug', '`$OBJECT`') } }
  assert.deepEqual(flowLoadRoute(opaque, load)?.args, [{ name: 'slug', field: undefined, idmap: ['slug', 'slug01'] }])
  assert.equal(flowLoadReadsRecord(opaque, load), false)
  // A parameter-free route is the one an unbound step takes.
  assert.deepEqual(flowLoadRoute({ ...proverb, id: undefined }, { o: 'load', m: {} }), {
    route: 'GET /proverbs/random', point: proverb.op.load.points[1], args: [], offline: true,
  })
  // The live harness is not told an offline route, and a live step keeps its binding.
  const steps = [load]
  assert.deepEqual(liveFlowRoutes(slug, { step: steps }).step, steps)
  assert.deepEqual(liveStepExamples(slug, load), [])
})

test('the live harness and a live flow take the route the offline flow takes', () => {
  const steps = [{ o: 'list' }, { o: 'load', m: {} }]
  const annotated = liveFlowRoutes(proverb, { name: 'BasicProverbFlow', step: steps })
  assert.deepEqual(annotated.step, [{ o: 'list' },
    { o: 'load', m: {}, route: 'GET /proverbs/{lang}/{id}', record: { lang: 'lang' } }])
  assert.equal(annotated.name, 'BasicProverbFlow')
  assert.deepEqual(steps[1], { o: 'load', m: {} })

  // The record's route, wherever it sorts, not the first route examples fill.
  const keyed = { ...proverb, op: { load: { points: [
    route('/proverbs/random', [], [arg('query', 'seed', true, 'k3')]),
    route('/proverbs/{lang}/{id}', [arg('param', 'id', true), arg('param', 'lang', true)],
      [arg('query', 'format', true, 'json')])] } } }
  assert.deepEqual(liveStepExamples(keyed, { o: 'load' }), [['format', 'json']])
  assert.deepEqual(liveStepExamples({ ...keyed, id: undefined }, { o: 'load' }), [['seed', 'k3']])
})


const at = (m: string, o: string, extra: any = {}) => ({ points: [{ m, o, ...extra }] })

test('a GET-only run leaves out a step no GET route reaches, and a load only it gives a record', () => {
  assert.equal(LIVE_GETONLY_ENV, 'VOXGIG_GETONLY_GUARD')
  const game = { name: 'game', id: { field: 'id' },
    op: { create: at('POST', '/game'), load: at('GET', '/game/{gameId}') } }
  const plan = liveGetOnly(game, flow({ o: 'create' }, { o: 'load', m: { id: 'game01' } }))!
  assert.deepEqual(plan.excluded, [
    { id: 'game.create.0', reason: 'GET-only live run: needs POST /game' },
    { id: 'game.load.1', reason: 'GET-only live run: reads a record only game.create.0 gives' },
  ])
  assert.deepEqual(plan.flow.step, [])
  assert.deepEqual(liveExcludedLines(plan)[0],
    'LIVE STEP {"id":"game.create.0","state":"excluded","attempted":false,' +
    '"reason":"GET-only live run: needs POST /game"}')
  assert.equal(liveExcludedSummary(plan), 'Live coverage incomplete: ' +
    'game.create.0 excluded (GET-only live run: needs POST /game); ' +
    'game.load.1 excluded (GET-only live run: reads a record only game.create.0 gives)')
})

test('a GET-only run keeps the reads a list or nothing at all gives a record', () => {
  const planet = { name: 'planet', id: { field: 'id' }, op: {
    create: at('POST', '/planet'), list: at('GET', '/planet'), update: at('PUT', '/planet/{id}'),
    load: at('GET', '/planet/{id}'), remove: at('DELETE', '/planet/{id}') } }
  const plan = liveGetOnly(planet, flow({ o: 'create' }, { o: 'list' }, { o: 'update' }, { o: 'load' },
    { o: 'remove' }, { o: 'list', v: [{ apply: 'ItemNotExists' }] }))!
  assert.deepEqual(plan.excluded.map(({ id }) => id),
    ['planet.create.0', 'planet.update.2', 'planet.remove.4', 'planet.list.5'])
  assert.equal(plan.excluded[3].reason, 'GET-only live run: checks a removal this run does not make')
  assert.deepEqual(plan.flow.step.map((step: any) => step.o), ['list', 'load'])

  const chart = { name: 'chart', op: { create: at('POST', '/chart'), load: at('GET', '/sky') } }
  const kept = liveGetOnly(chart, flow({ o: 'create' }, { o: 'load' }))!
  assert.deepEqual(kept.excluded.map(({ id }) => id), ['chart.create.0'])
  assert.deepEqual(kept.flow.step.map((step: any) => step.o), ['load'])
})

test('a GET-only run changes nothing a GET can make, and counts steps as the live harness does', () => {
  const search = { name: 'search', op: {
    list: { points: [{ m: 'POST', o: '/search' }, { m: 'GET', o: '/search' }] },
    load: at('GET', '/search/{id}'), create: { points: [{ m: 'POST', o: '/x', a: false }] } } }
  assert.equal(liveGetOnly(search, flow({ o: 'list' }, { o: 'load' }, { o: 'create' })), undefined)

  const signal = { name: 'signal', op: { create: at('POST', '/signal'), list: at('GET', '/signal') } }
  const plan = liveGetOnly(signal, flow({ o: 'list', a: false }, { o: 'list', a: false, unreachable: true },
    { o: 'create' }))!
  assert.deepEqual(plan.excluded.map(({ id }) => id), ['signal.create.1'])
})

test('a required parameter with no example takes the first value its enum allows', () => {
  const parameters = [
    { name: 'asset', in: 'query', schema: { enum: ['BTC', 'ETH'] } },
    { name: 'chain', in: 'query', schema: { enum: ['eth'] } },
    { name: 'ccy', in: 'query', schema: { enum: ['EUR'] } },
    { name: 'kind', in: 'path', enum: ['spot'] },
    { name: 'tags', in: 'query', schema: { enum: [['a']] } },
  ]
  const ctx$ = { meta: { apidef: { operation: () => ({ protocol: 'http', parameters }) } } }
  const quote = { name: 'quote', op: { list: { points: [route('/quote/{kind}', [arg('param', 'kind', true)], [
    arg('query', 'asset', true), arg('query', 'chain', false), arg('query', 'ccy', true, 'USD'),
    arg('query', 'tags', true)])] } } }
  const live = liveEntity(ctx$, quote)
  const point = live.op.list.points[0]
  assert.deepEqual(point.g.params.map((a: any) => a.ex), ['spot'])
  assert.deepEqual(point.g.query.map((a: any) => a.ex), ['BTC', undefined, 'USD', undefined])
  assert.deepEqual(liveQueryExamples(point), [['asset', 'BTC'], ['ccy', 'USD']])
  assert.equal(quote.op.list.points[0].g.query[0].ex, undefined)
  assert.equal(liveEntity({}, quote), quote)
})


test('a GET-only direct test leaves to *_ENTID only an id that a create alone gives', () => {
  const game = { name: 'game', op: { create: at('POST', '/game'), load: at('GET', '/game/{gameId}') } }
  const seat = { name: 'seat', op: { load: at('GET', '/game/{game_id}/seat/{id}') } }
  const board = { name: 'board', op: { create: at('POST', '/board'), list: at('GET', '/board') } }
  const model = { main: { kit: { entity: { game, seat, board } } } }
  assert.deepEqual(liveDirectGetOnly(model, game, 'direct-load-game', ['game01']), [
    { key: 'game01', id: 'direct-load-game', reason: 'GET-only live run: needs game01, which only POST /game gives' },
  ])
  assert.deepEqual(liveDirectGetOnly(model, seat, 'direct-load-seat', ['game01', 'seat01', 'slug01'])
    .map(({ key }) => key), ['game01'])
  assert.deepEqual(liveDirectGetOnly(model, seat, 'direct-load-seat', ['board01']), [])
  const summary = liveExcludedSummary({ excluded: liveDirectGetOnly(model, game, 'direct-load-game', ['game01']) })
  assert.equal(summary, 'Live coverage incomplete: direct-load-game excluded ' +
    '(GET-only live run: needs game01, which only POST /game gives)')
})
