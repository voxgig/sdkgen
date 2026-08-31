
import { test, describe, before, after } from 'node:test'
import { deepStrictEqual, strictEqual, throws, ok } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import {
  resolvePath,
  requirePath,
  isAuthActive,
  resolveAuthPrefix,
  resolveAuthExchange,
  configDefinition,
} from '../dist/utility.js'


describe('utility', () => {

  describe('isAuthActive', () => {

    test('defaults to active when nothing declared', () => {
      strictEqual(isAuthActive({}), true)
    })

    test('info.auth === false opts out', () => {
      strictEqual(isAuthActive({ main: { kit: { info: { auth: false } } } }), false)
    })

    test('config.auth.active === false opts out', () => {
      strictEqual(
        isAuthActive({ main: { kit: { config: { auth: { active: false } } } } }),
        false,
      )
    })

    test('config.auth.active === true stays active', () => {
      strictEqual(
        isAuthActive({ main: { kit: { config: { auth: { active: true } } } } }),
        true,
      )
    })

    test('info present but auth not disabled stays active', () => {
      strictEqual(isAuthActive({ main: { kit: { info: { auth: true } } } }), true)
    })
  })


  // apidef recognises an API's access-token exchange in the spec and records
  // it as model facts; a feature receives them by declaring
  // `spec: { authexchange: '<options-key>' }`. Pinned here because the whole
  // point is that a project does NOT restate its own API's token endpoint —
  // if the overlay silently stops happening, the generated config keeps the
  // generic default and nothing fails loudly.
  describe('resolveAuthExchange', () => {

    test('null when the spec describes no exchange', () => {
      strictEqual(resolveAuthExchange({}), null)
      strictEqual(
        resolveAuthExchange({ main: { kit: { info: { security: {} } } } }), null)
    })

    test('returns the recorded exchange facts', () => {
      deepStrictEqual(
        resolveAuthExchange({
          main: {
            kit: {
              info: {
                security: {
                  prefix: 'Bearer',
                  exchange: {
                    path: 'auth/token', method: 'POST',
                    request: 'refresh_token', response: 'access_token',
                  },
                },
              },
            },
          },
        }),
        {
          path: 'auth/token', method: 'POST',
          request: 'refresh_token', response: 'access_token',
        },
      )
    })
  })


  // The overlay itself: a feature that declares the fact gets it merged over
  // its own declared defaults; one that does not is untouched.
  describe('configDefinition spec-fact overlay', () => {

    const modelWith = (featureExtra: any) => ({
      const: { Name: 'Demo' },
      name: 'demo',
      main: {
        kit: {
          entity: {},
          config: { headers: {} },
          info: {
            servers: [{ url: 'http://x/api' }],
            security: {
              exchange: {
                path: 'auth/token', method: 'POST',
                request: 'refresh_token', response: 'access_token',
              },
            },
          },
          feature: {
            secrets: {
              name: 'secrets',
              active: true,
              config: {
                options: {
                  active: false,
                  exchange: {
                    active: false,
                    path: 'oauth/token',
                    method: 'POST',
                    request: 'refresh_token',
                    response: 'access_token',
                  },
                },
              },
              ...featureExtra,
            },
          },
        },
      },
    })

    test('spec facts overlay the declared defaults', () => {
      const { def } = configDefinition(modelWith({ spec: { authexchange: 'exchange' } }))
      const ex = def.feature.secrets.options.exchange
      // The spec says where THIS API's endpoint is; the declared
      // 'oauth/token' was only ever a generic guess.
      strictEqual(ex.path, 'auth/token')
      strictEqual(ex.method, 'POST')
      strictEqual(ex.request, 'refresh_token')
      strictEqual(ex.response, 'access_token')
    })

    test('activation is NOT overlaid - it stays the project\'s call', () => {
      const { def } = configDefinition(modelWith({ spec: { authexchange: 'exchange' } }))
      strictEqual(def.feature.secrets.options.exchange.active, false)
    })

    test('a feature that does not declare the fact is untouched', () => {
      const { def } = configDefinition(modelWith({}))
      strictEqual(def.feature.secrets.options.exchange.path, 'oauth/token')
    })

    test('no exchange in the model leaves the defaults alone', () => {
      const model: any = modelWith({ spec: { authexchange: 'exchange' } })
      delete model.main.kit.info.security
      const { def } = configDefinition(model)
      strictEqual(def.feature.secrets.options.exchange.path, 'oauth/token')
    })
  })


  describe('resolveAuthPrefix', () => {

    test('defaults to Bearer when nothing declared', () => {
      strictEqual(resolveAuthPrefix({}), 'Bearer')
    })

    test('spec-derived info.security.prefix wins over the default', () => {
      strictEqual(
        resolveAuthPrefix({ main: { kit: { info: { security: { prefix: 'OAuth' } } } } }),
        'OAuth',
      )
    })

    test('config.auth.prefix overrides the spec-derived value', () => {
      strictEqual(
        resolveAuthPrefix({
          main: {
            kit: {
              config: { auth: { prefix: 'Token' } },
              info: { security: { prefix: 'OAuth' } },
            },
          },
        }),
        'Token',
      )
    })

    test('empty string is a valid resolved prefix (raw credential)', () => {
      strictEqual(
        resolveAuthPrefix({ main: { kit: { info: { security: { prefix: '' } } } } }),
        '',
      )
    })

    test('security present without prefix falls back to Bearer', () => {
      strictEqual(
        resolveAuthPrefix({ main: { kit: { info: { security: { type: 'apiKey' } } } } }),
        'Bearer',
      )
    })
  })


  describe('resolvePath', () => {

    test('joins under <folder>/.sdk/dist', () => {
      strictEqual(
        resolvePath({ folder: '/x' }, 'a/b'),
        Path.join('/x', '.sdk', 'dist', 'a/b'),
      )
    })
  })


  describe('requirePath', () => {
    let dir: string
    let distdir: string

    before(() => {
      dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-req-'))
      distdir = Path.join(dir, '.sdk', 'dist')
      Fs.mkdirSync(distdir, { recursive: true })
      Fs.writeFileSync(Path.join(distdir, 'good.js'), 'module.exports = { hello: "world" }')
      Fs.writeFileSync(Path.join(distdir, 'boom.js'), 'throw new Error("load failure")')
    })

    after(() => {
      Fs.rmSync(dir, { recursive: true, force: true })
    })

    function makeCtx() {
      const warns: any[] = []
      return { ctx$: { folder: dir, log: { warn: (o: any) => warns.push(o) } }, warns }
    }

    test('loads an existing module', () => {
      const { ctx$ } = makeCtx()
      deepStrictEqual(requirePath(ctx$, 'good'), { hello: 'world' })
    })

    test('missing module + ignore returns undefined and warns', () => {
      const { ctx$, warns } = makeCtx()
      strictEqual(requirePath(ctx$, 'nope', { ignore: true }), undefined)
      strictEqual(warns.length, 1)
      strictEqual(warns[0].point, 'require-missing')
    })

    test('missing module without ignore throws', () => {
      const { ctx$ } = makeCtx()
      throws(() => requirePath(ctx$, 'nope'))
    })

    test('a module that throws while loading propagates even with ignore', () => {
      // The core of the fix: `ignore` must NOT swallow load-time errors,
      // only genuine "module not found" resolution failures.
      const { ctx$, warns } = makeCtx()
      throws(() => requirePath(ctx$, 'boom', { ignore: true }), /load failure/)
      strictEqual(warns.length, 0)
      ok(true)
    })
  })

})
