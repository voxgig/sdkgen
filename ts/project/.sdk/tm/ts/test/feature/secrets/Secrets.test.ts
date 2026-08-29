// Behavioural tests for the secrets feature (vendored @voxgig/sekreto).
//
// The contract under test: the `apikey` OPTION keeps its exact old meaning
// and always wins, because SecretsFeature places it FIRST in the provider
// chain (a `memory` store named `options`) — explicit-beats-lookup falls
// out of sekreto's first-hit rule rather than from special-case logic.
// With the feature inactive nothing changes at all. With it active and the
// option unset, the chain (env, dotenv, a custom provider, a vault)
// supplies the credential instead.
//
// This file lives in the `feature/` container on purpose: `target add`
// trims it, along with the feature source and the vendored library, for a
// project whose model does not select `secrets`.

import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert'

import { SDK } from '../../utility/index'


const ENVPREFIX = 'PROJECTENV_TEST_SECRETS_'


// prepare() returns the fetchdef the transport would receive — the closest
// observable point to the wire for header assertions — and it awaits
// secrets resolution itself, because it bypasses the feature hook pipeline.
async function prepared(sdkopts: any): Promise<any> {
  const sdk = (SDK as any).test({}, sdkopts)
  const fetchdef = await sdk.prepare({ path: '/' })
  assert.ok(!(fetchdef instanceof Error), String(fetchdef))
  return { sdk, fetchdef }
}


// An env chain, the shape most of these tests use.
function envchain(extra?: any): any {
  return {
    feature: {
      secrets: Object.assign({
        active: true,
        providers: [{ kind: 'env', prefix: ENVPREFIX }],
      }, extra || {}),
    },
  }
}


describe('secrets', () => {

  beforeEach(() => {
    delete process.env[ENVPREFIX + 'APIKEY']
  })


  test('inactive: apikey option behaves exactly as before', async () => {
    const { sdk, fetchdef } = await prepared({ apikey: 'OPTKEY01' })
    assert.equal(fetchdef.headers['authorization'], 'OPTKEY01')

    // No feature, no instance: the accessor is the only way in.
    assert.equal(sdk.secrets(), undefined)
  })


  test('inactive: no apikey means no authorization header', async () => {
    const { fetchdef } = await prepared({})
    assert.equal(fetchdef.headers['authorization'], undefined)
  })


  test('active: apikey option still wins over the chain', async () => {
    process.env[ENVPREFIX + 'APIKEY'] = 'ENVKEY01'
    const { sdk, fetchdef } = await prepared(
      Object.assign({ apikey: 'OPTKEY01' }, envchain()))

    assert.equal(fetchdef.headers['authorization'], 'OPTKEY01')

    // The explicit option is a real store, not a special case: a directed
    // read names it like any other.
    assert.equal(await sdk.secrets().getfrom('options', 'apikey'), 'OPTKEY01')
  })


  // The three ways an apikey can be "not given", pinned together because
  // they are easy to conflate and only one of them is a suppression.
  //
  // makeOptions normalises an omitted apikey to '' before features
  // initialise, so by init time omitted and explicit-empty are
  // indistinguishable — both defer to the chain, deliberately.

  test('active: an OMITTED apikey defers to the chain', async () => {
    process.env[ENVPREFIX + 'APIKEY'] = 'ENVKEY01'
    const { fetchdef } = await prepared(envchain())
    assert.equal(fetchdef.headers['authorization'], 'ENVKEY01')
  })


  test('active: an explicitly EMPTY apikey also defers to the chain', async () => {
    process.env[ENVPREFIX + 'APIKEY'] = 'ENVKEY01'
    const { fetchdef } = await prepared(
      Object.assign({ apikey: '' }, envchain()))
    assert.equal(fetchdef.headers['authorization'], 'ENVKEY01')
  })


  // `auth: null` — the documented way to disable auth outright, which
  // prepareAuth honours before it ever reads the apikey.
  //
  // STRUCT 0.3.2 CHANGED THIS, silently. Under 0.0.10, getprop returned a
  // stored null as null, so validate saw `auth: null` as a non-map and
  // REJECTED it ("Expected field auth to be map, but found no value") for
  // any SDK whose optspec supplies an `auth` default. Under 0.3.2 getprop
  // treats a stored null as "no value", so the optspec default fires
  // instead and `auth: null` quietly becomes `auth: { prefix: '' }` — auth
  // stays ON, and the chain is still consulted.
  //
  // Pinned here because no corpus entry can catch it: corpus nulls travel
  // as the '__NULL__' string, so real-JSON-null semantics are invisible to
  // every port's shared fixtures.
  test('active: auth null is absorbed by the optspec default (struct 0.3.2)',
    async () => {
      process.env[ENVPREFIX + 'APIKEY'] = 'ENVKEY01'
      const { sdk, fetchdef } = await prepared(
        Object.assign({ auth: null }, envchain()))

      // Not a throw, and not a suppression: the default auth config applies.
      assert.equal(fetchdef.headers['authorization'], 'ENVKEY01')
      assert.equal(sdk.options().apikey, 'ENVKEY01')
    })


  test('active: custom provider objects are accepted verbatim', async () => {
    const asked: string[] = []
    const { fetchdef } = await prepared({
      feature: {
        secrets: {
          active: true,
          providers: [{
            lookup(name: string) { asked.push(name); return 'CUSTOM01' },
            describe() { return 'custom:test' },
          }],
        },
      },
    })
    assert.equal(fetchdef.headers['authorization'], 'CUSTOM01')
    assert.deepEqual(asked, ['apikey'])
  })


  test('active: a miss everywhere leaves the header off', async () => {
    const { sdk, fetchdef } = await prepared(envchain())
    assert.equal(fetchdef.headers['authorization'], undefined)
    assert.equal(sdk.options().apikey, '')
  })


  // sekreto's miss-vs-error invariant: a MISS falls through to the next
  // provider, an ERROR does not. A broken vault must never degrade into an
  // unauthenticated request.
  //
  // On the DIRECT path the error is RETURNED, not thrown: _rawRequest
  // awaits prepare() outside its try, and direct()/graphql() are documented
  // to return a value or an Error and never reject.
  test('active: a provider ERROR is returned by prepare, not thrown',
    async () => {
      const sdk = (SDK as any).test({}, {
        feature: {
          secrets: {
            active: true,
            providers: [{
              lookup(_name: string): string { throw new Error('vault unreachable') },
              describe() { return 'broken:test' },
            }],
          },
        },
      })

      const out = await sdk.prepare({ path: '/' })

      assert.ok(out instanceof Error, 'expected an Error value, got ' + String(out))
      assert.match(String(out.message), /vault unreachable/)
    })


  test('active: secret name is configurable', async () => {
    process.env[ENVPREFIX + 'API_TOKEN'] = 'TOKKEY01'
    try {
      const { fetchdef } = await prepared(envchain({ name: 'api.token' }))
      assert.equal(fetchdef.headers['authorization'], 'TOKKEY01')
    }
    finally {
      delete process.env[ENVPREFIX + 'API_TOKEN']
    }
  })


  test('active: sekreto is live for arbitrary secrets and redaction', async () => {
    const { sdk } = await prepared({
      feature: {
        secrets: {
          active: true,
          providers: [{ kind: 'memory', values: { DB_PASSWORD: 'dbpass01' } }],
        },
      },
    })

    const secrets = sdk.secrets()
    assert.equal(await secrets.get('db.password'), 'dbpass01')
    assert.equal(
      secrets.redact('the password is dbpass01, keep it safe'),
      'the password is [redacted], keep it safe')
  })


  // The bridge that makes the whole design work: resolution is async, the
  // auth header is built synchronously, and entity ops await
  // featureHook('PreSpec') before makeSpec — so that is where the lookup
  // happens and still lands in time.
  //
  // The entity is discovered from the SDK's own config rather than named,
  // because this file is a TEMPLATE: it ships to every project, and no
  // project's entity names are known here.
  test('active: entity ops resolve via the PreSpec hook', async () => {
    process.env[ENVPREFIX + 'APIKEY'] = 'ENVKEY02'

    const sdk = (SDK as any).test({}, envchain())

    const names = Object.keys(sdk.options().entity || {})
    if (0 === names.length) {
      // An SDK with no entities has no PreSpec path to exercise.
      return
    }

    // Before any op, nothing has been resolved.
    assert.equal(sdk.options().apikey, '')

    const name = names[0]
    const accessor = name.charAt(0).toUpperCase() + name.slice(1)

    // The op itself may fail (no seeded data, no live API) — irrelevant
    // here. What matters is that the awaited PreSpec hook ran and the
    // credential reached the live options before the spec was built.
    try {
      await sdk[accessor]().list()
    }
    catch (_err) { }

    assert.equal(sdk.options().apikey, 'ENVKEY02',
      'the entity op did not resolve the secret through PreSpec')
  })

})
