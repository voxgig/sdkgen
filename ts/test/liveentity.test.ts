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
  const op = async (input: any) => {
    context.attempted()
    inputs.push(input)
    return { data: () => reply }
  }
  return {
    inputs,
    setup: {
      client: { [accessor]: () => ({ load: op, list: op }) },
      transport: { enter: (ctx: any) => { context = ctx } },
      idmap: {}, data: { new: {} }, now: 1,
    },
  }
}

const loadFlow = (name: string) => ({ step: [{ o: 'load', m: { id: name + '01' } }] })

const entity = (name: string, id: string, fields: string[], ex: string | number) => ({
  name, id: { field: id, name: 'id' },
  fields: Object.fromEntries(fields.map((n) => [n, { n }])),
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
