const assert = require('node:assert/strict')
const { DemoSDK } = require(process.argv[2] + '/DemoSDK')

async function main() {
  const seen = []
  const sdk = new DemoSDK({
    feature: { paging: { active: true } },
    utility: {
      fetcher: async (ctx, url) => {
        seen.push({ query: { ...ctx.spec.query }, ctrl: ctx.ctrl, url })
        return {
          status: 200,
          body: 'paging response',
          headers: new Headers(),
          json: async () => ({ has_more: true, next_cursor: 'planet-cursor' }),
        }
      },
    },
  })

  const planet = sdk.Planet()
  await planet.list({})
  await planet.list({})
  await sdk.History().list({})
  for (const call of seen) {
    assert.equal(call.query.page, 1)
    assert.equal(call.query.cursor, undefined)
  }
  assert.notEqual(seen[0].ctrl, seen[1].ctrl)
  assert.notEqual(seen[1].ctrl, seen[2].ctrl)
  assert.equal(sdk._rootctx.ctrl.paging, undefined)

  const ctrl = { paging: {} }
  await planet.list({}, ctrl)
  assert.equal(ctrl.paging.cursor, 'planet-cursor')
  await planet.list({}, ctrl)
  assert.equal(seen[4].query.cursor, 'planet-cursor')
  assert.equal(seen[3].ctrl, ctrl)
  assert.equal(seen[4].ctrl, ctrl)

  await planet.list({})
  assert.equal(seen[5].query.cursor, undefined)
  assert.equal(seen[5].query.page, 1)

  const { Context } = require(process.argv[2] + '/Context')
  const nested = new Context({}, { ...sdk._rootctx, ctrl })
  assert.equal(nested.ctrl, ctrl)
  console.log('paging: independent calls isolated; explicit continuation preserved')
}

main().catch((err) => { console.error(err); process.exitCode = 1 })
