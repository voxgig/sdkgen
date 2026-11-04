import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fs from 'node:fs'
import Path from 'node:path'
import { transform } from 'sucrase'


// The ts twin runs from its own source beside the js one, so each case pins both.
function tsTemplate(name: string, deps: Record<string, any> = {}): any {
  const dir = Path.resolve(__dirname, '../project/.sdk/tm/ts/test')
  const file = Path.join(dir, name + '.ts')
  const code = transform(Fs.readFileSync(file, 'utf8'),
    { transforms: ['typescript', 'imports'], filePath: file }).code
  const mod: any = { exports: {} }
  new Function('exports', 'require', 'module', '__dirname', code)(
    mod.exports, (p: string) => deps[p] ?? require(p), mod, dir)
  return mod.exports
}

const tsRunner = tsTemplate('live-runner')
const TWINS: [string, any][] = [
  ['ts', tsTemplate('live-entity', {
    './live-runner': tsRunner, './utility': tsTemplate('utility'),
    './live-contract': tsTemplate('live-contract', { './live-runner': tsRunner }),
  }).runLiveEntity],
  ['js', require('../project/.sdk/tm/js/test/live-entity').runLiveEntity],
]


// A client whose every operation answers `reply`, recording each input; the
// live transport only hands it the step's context to mark as attempted.
function liveSetup(accessor: string, reply: any) {
  let context: any
  const inputs: any[] = []
  const op = (wrap: (reply: any) => any) => async (input: any) => {
    context.attempted()
    inputs.push(input)
    return wrap(reply)
  }
  const item = (record: any) => ({ data: () => record })
  return {
    inputs,
    setup: {
      client: { [accessor]: () => ({
        load: op(item),
        list: op((records: any) => (Array.isArray(records) ? records : [records]).map(item)),
      }) },
      transport: { enter: (ctx: any) => { context = ctx } },
      idmap: {}, data: { new: {} }, now: 1,
    },
  }
}

const loadFlow = (name: string) => ({ step: [{ o: 'load', m: { id: name + '01' } }] })

const entity = (name: string, id: string, fields: string[], ex: string | number, added: string[] = []) => ({
  name, id: { field: id, name: 'id' },
  fields: Object.fromEntries([...fields.map((n) => [n, { n }]), ...added.map((n) => [n, { n, syn: true }])]),
  op: { load: { points: [{ m: 'GET', o: '/' + name + '/{id}',
    g: { params: [{ k: 'param', n: 'id', r: true, ex }] } }] } },
})

async function quietly(run: () => Promise<any>) {
  const log = console.log
  console.log = () => {}
  try { return await run() }
  finally { console.log = log }
}


for (const [twin, runLiveEntity] of TWINS) {
  test(twin + ': a live load of a record whose schema declares no identity field checks only that one came back', async () => {
    const { setup, inputs } = liveSetup('Saying', { author: 'Salvador Dali', quote: 'Intelligence...' })
    await quietly(() => runLiveEntity(setup, entity('saying', 'id', ['author', 'quote'], 2),
      loadFlow('saying'), 'Saying', {}, { strict: true }))
    assert.deepEqual(inputs, [{ id: 2 }])
  })


  test(twin + ': a live load is not compared on an identity field the model adds', async () => {
    const { setup, inputs } = liveSetup('Motto', { author: 'Salvador Dali', quote: 'Intelligence...' })
    await quietly(() => runLiveEntity(setup, entity('motto', 'id', ['author', 'quote'], 2, ['id']),
      loadFlow('motto'), 'Motto', {}, { strict: true }))
    assert.deepEqual(inputs, [{ id: 2 }])

    // The same field, declared by the record's own schema, is compared.
    const declared = liveSetup('Motto', { author: 'Salvador Dali', quote: 'Intelligence...' })
    await assert.rejects(quietly(() => runLiveEntity(declared.setup,
      entity('motto', 'id', ['author', 'id', 'quote'], 2), loadFlow('motto'), 'Motto', {}, { strict: true })),
    /Response identity mismatch/)
  })


  test(twin + ': a live load by the parts of an identity sends and compares no id', async () => {
    const announcement = {
      name: 'announcement',
      id: { field: 'id', name: 'id', parts: ['currency', 'indicator'],
        from: { currency: 'currency', indicator: 'indicator' } },
      fields: { currency: { n: 'currency' }, id: { n: 'id' }, indicator: { n: 'indicator' } },
      op: { load: { points: [{ m: 'GET', o: '/announcements/{currency}/{indicator}', g: { params: [
        { k: 'param', n: 'currency', r: true, ex: 'USD' }, { k: 'param', n: 'indicator', r: true, ex: 'inflation' },
      ] } }] } },
    }
    const { setup, inputs } = liveSetup('Announcement', { currency: 'USD', indicator: 'inflation' })
    await quietly(() => runLiveEntity(setup, announcement, { step: [{ o: 'load' }] }, 'Announcement', {},
      { strict: true }))
    assert.deepEqual(inputs, [{ currency: 'USD', indicator: 'inflation' }])
  })


  test(twin + ': a live list takes the first route it can fill, without a binding that route does not take', async () => {
    const point = (o: string, n: string, ex: any) =>
      ({ m: 'GET', o, g: { params: [{ k: 'param', n, r: true, ex }] } })
    const episode = { name: 'episode', fields: { episode_number: { n: 'episode_number' } }, op: { list: { points: [
      point('/episodes/random/{count}', 'count', 1), point('/episode/{episodeNumber}', 'episode_number', 420),
    ] } } }
    const { setup, inputs } = liveSetup('Episode', [{ episode_number: 7 }])
    await quietly(() => runLiveEntity(setup, episode,
      { step: [{ o: 'list', m: { episode_number: 'episode_number01' } }] }, 'Episode', {}, { strict: true }))
    assert.deepEqual(inputs, [{ count: 1 }])
  })


  test(twin + ': a live load compares an identity by its string form', async () => {
    const year = entity('year', 'year', ['year', 'summary'], '1969')
    const { setup, inputs } = liveSetup('Year', { year: 1969, summary: 'moon' })
    await quietly(() => runLiveEntity(setup, year, loadFlow('year'), 'Year', {}, { strict: true }))
    assert.deepEqual(inputs, [{ id: '1969' }])

    // The comparison still runs: another record fails the step.
    const other = liveSetup('Year', { year: 1970, summary: 'later' })
    await assert.rejects(quietly(() => runLiveEntity(other.setup, year, loadFlow('year'), 'Year', {},
      { strict: true })), /Response identity mismatch/)
  })
}
