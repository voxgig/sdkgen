import { cmp, File, Content, entityCollection, liveHint, pointFacts, liveStrict, liveStrictNote, fact } from '@voxgig/sdkgen'
import { KIT, nom } from '@voxgig/apidef'

const TestLive = cmp(function TestLive(props: any) {
  const model = props.ctx$.model
  const plan: any[] = []
  const ENVVAR = fact(model.main[KIT], 'env')
  for (const entity of Object.values(entityCollection(model)) as any[]) {
    if (entity.active === false) continue
    for (const [op, operation] of Object.entries(entity.op || {}) as any[]) {
      for (const point of operation.points || []) {
        // Only what the runner reads, not the whole point.
        const all: any = pointFacts(props.ctx$, point)
        const facts: any = {
          live: liveHint(point),
          security: model.main.kit.info?.auth === false ? [] : all.security,
          securitySource: all.securitySource,
          responses: all.responses,
        }
        const same = operation.points.filter((p: any) => JSON.stringify(p.q || {}) === JSON.stringify(point.q || {}))
        plan.push({ entity: entity.name, accessor: nom(entity, 'Name'), op,
          id: point.m + ' ' + point.o, contractVersion: 1, kind: point.k, graphql: point.gq, path: point.o, method: point.m,
          action: point.q?.$action, rename: point.r, args: point.g, facts, reachable: same.length === 1 })
      }
    }
  }
  if (!plan.some(p => p.facts.live)) return
  const server = fact(model.main[KIT], 'server').map((v: any) => JSON.stringify(v.name) + ': process.env[' + JSON.stringify(ENVVAR.server[v.name]) + '] ?? ' + JSON.stringify(v.dflt)).join(', ')
  File({ name: 'live.test.ts' }, () => Content(`import { test } from 'node:test'
import { SDK } from '..'
import { runLiveScenarios } from './live-scenarios'
import { loadEnvLocal } from './utility'
loadEnvLocal(__dirname + '/../${props.ctx$.stdrep.SDKREL}/.env.local')
${liveStrictNote(liveStrict(model, props.target.name), '//')}
test('live operation coverage', { skip: process.env.${ENVVAR.live} !== 'TRUE' }, async (t) => {
  await runLiveScenarios(SDK, ${JSON.stringify(plan, null, 2)}, '${ENVVAR.prefix}', { server: { ${server} }, secret: process.env.${ENVVAR.secret} }, { strict: ${liveStrict(model, props.target.name)}, t })
})
`))
})
export { TestLive }
