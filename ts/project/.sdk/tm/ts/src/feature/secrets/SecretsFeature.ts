import type { Context, FeatureOptions } from '../../types'

import { BaseFeature } from '../base/BaseFeature'
import { fetcher } from '../../utility/FetcherUtility'
import { Sekreto, envkey } from './sekreto'
// The plugin DEFINITIONS the model selected for this feature, emitted by
// Config generically from the catalogue's active `plugin.def` entries.
// Upstream sekreto's contract since the registry was retired: a kind not
// passed in `plugins` is unknown to that Sekreto, so the model's choice of
// plugin groups IS the SDK's provider vocabulary.
import { FEATURE_PLUGINS } from '../../Config'


const REDIRECT_MAX = 5


// The next URL of a redirect that keeps its method, when that URL is on the
// exchange's own origin. Any other redirect would drop the body or leave it.
function moved(url: string, at: string, res: any): string | undefined {
  const status = null == res ? 0 : res.status
  if (307 !== status && 308 !== status) {
    return undefined
  }

  const headers = res.headers
  const location = null == headers ? undefined :
    'function' === typeof headers.get ? headers.get('location') : headers.location

  if ('string' !== typeof location || '' === location) {
    return undefined
  }

  try {
    const next = new URL(location, at)
    return next.origin === new URL(url).origin ? next.href : undefined
  }
  catch (_err) {
    return undefined
  }
}


class SecretsFeature extends BaseFeature {
  version = '0.1.0'
  name = 'secrets'

  _client: any
  _declared: boolean = false
  _basic: boolean = false
  _sekreto?: Sekreto
  _secretname: string = 'apikey'
  _resolving?: Promise<void>
  _cache: boolean = true

  _exchange: any = null
  _refresh?: string
  _buying?: Promise<string>


  init(ctx: Context, fopts: FeatureOptions): void {
    const client = ctx.client
    const options = ctx.options

    this._client = client

    // What PrepareAuth was generated from: the config declares auth only
    // where it places a credential, and Basic only where it composes one.
    const declared = ctx.config?.options?.auth
    this._declared = null != declared
    this._basic = true === declared?.basic

    this._secretname = 'string' === typeof (fopts as any).name &&
      '' !== (fopts as any).name ? (fopts as any).name : 'apikey'

    const xopts = (fopts as any).exchange
    this._exchange = (null != xopts && true === xopts.active) ? {
      path: 'string' === typeof xopts.path ? xopts.path : 'auth/token',
      method: 'string' === typeof xopts.method ? xopts.method : 'POST',
      request: 'string' === typeof xopts.request ? xopts.request : 'refresh_token',
      response: 'string' === typeof xopts.response ? xopts.response : 'access_token',
      statuses: Array.isArray(xopts.statuses) ? xopts.statuses : [401],
      retries: 'number' === typeof xopts.retries ? xopts.retries : 1,
      redirect: 'same-origin' === xopts.redirect ? 'same-origin' : 'refuse',
    } : null

    const providers: any[] = []

    const explicit = null == this._exchange ?
      options.apikey :
      (null == xopts ? undefined : xopts.refresh)

    if ('string' === typeof explicit && '' !== explicit) {
      this._register(explicit)
      providers.push({
        kind: 'memory',
        name: 'options',
        values: { [envkey(this._secretname)]: explicit },
      })
    }

    for (const p of ((fopts as any).providers || [])) {
      providers.push(p)
    }

    this._cache = false !== (fopts as any).cache

    this._sekreto = new Sekreto({
      providers,
      plugins: FEATURE_PLUGINS[this.name] || [],
      cache: this._cache,
    })

    ;(client as any)._secrets = this

    if (null != this._exchange) {
      const self = this
      const utility = ctx.utility
      const inner = utility.fetcher

      utility.fetcher = async function (ctx2: any, url: string, fetchdef: any) {
        return self._withRefresh(ctx2, url, fetchdef, inner)
      }
    }
  }


  sekreto(): any {
    return this._sekreto
  }


  // PrepareAuth's decision: auth the config declares, not suppressed by `auth: null`.
  _authon(): boolean {
    return this._declared && null != this._client._options.auth
  }


  _register(value: any): void {
    const ctx = this._client._rootctx
    if (null != ctx && null != ctx.utility && 'function' === typeof ctx.utility.cleanAdd) {
      ctx.utility.cleanAdd(ctx, value)
    }
  }


  PreSpec(_ctx: Context) {
    return this.resolve()
  }


  resolve(): Promise<void> {
    if (null == this._resolving) {
      const inflight = this._resolveonce()
        .then(
          (hit: boolean) => {
            if (!this._cache || !hit) {
              this._resolving = undefined
            }
          },
          (err: any) => {
            this._resolving = undefined
            throw err
          })

      this._resolving = inflight
    }

    return this._resolving
  }


  // Resolve once, reporting whether a credential came out of it. That
  // boolean is the whole of what resolve() needs to tell a cacheable HIT
  // from a miss it must not retain.
  private async _resolveonce(): Promise<boolean> {
    if (null == this._sekreto || !this._authon()) {
      return false
    }

    const found = await this._sekreto.try(this._secretname)
    this._register(found)

    if (null == this._exchange) {
      if (undefined !== found) {
        // The same live-mutation seam TestFeature uses for the transport:
        // prepareAuth reads client.options() (a clone of _options), so the
        // resolved value lands where the sync auth path already looks.
        this._client._options.apikey = found
      }
      return undefined !== found
    }

    // Exchanging: what the chain resolved is the REFRESH token, kept for
    // every later purchase. A miss is not fatal here — an explicit
    // `apikey` may already hold a usable access token, and the API is
    // what gets to say whether it does.
    this._refresh = undefined === found ? undefined : String(found)

    const apikey = this._client._options.apikey
    if ('string' === typeof apikey && '' !== apikey) {
      // A starting access token was supplied. Spend it: if it is stale the
      // API answers 401 and the transport wrapper buys another, which is
      // the same path expiry takes anyway.
      return true
    }

    this._client._options.apikey = await this._buy()

    return true
  }


  private _buy(): Promise<string> {
    if ('live' !== this._client._mode) {
      return Promise.resolve('test-' + this._exchange.response)
    }

    if (null != this._buying) {
      return this._buying
    }

    const buying = this._buyonce()
      .then(
        (token: string) => {
          this._buying = undefined
          return token
        },
        (err: any) => {
          this._buying = undefined
          throw err
        })

    this._buying = buying

    return buying
  }


  private async _buyonce(): Promise<string> {
    const x = this._exchange

    if (null == this._refresh || "" === this._refresh) {
      throw new Error(
        "secrets: no refresh token: the provider chain has no '" +
        this._secretname + "', and feature.secrets.exchange.refresh is unset")
    }

    const options = this._client.options()

    const base = String(options.base || "").replace(/\/+$/, "")
    const url = base + "/" + String(x.path).replace(/^\/+/, "")

    const fetch = options.system && options.system.fetch

    if ("function" !== typeof fetch) {
      throw new Error("secrets: no fetch implementation for the token exchange")
    }

    const fetchdef = {
      method: x.method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [x.request]: this._refresh }),
      // Never followed by the client: a redirect would carry the refresh token on.
      redirect: 'manual',
    }

    // The SDK transport beneath every wrapper; its GET-only refusal fails the op.
    const send = async (at: string) => {
      const sent: any = await fetcher(this._client._rootctx, at, fetchdef)
      if (sent instanceof Error) {
        throw sent
      }
      return sent
    }

    let res = await send(url)

    // By option alone, and only while the exchange stays on its own origin.
    let at = url
    for (let hops = 0; 'same-origin' === x.redirect && hops < REDIRECT_MAX; hops++) {
      const next = moved(url, at, res)
      if (null == next) {
        break
      }
      at = next
      res = await send(at)
    }

    const status = null == res ? 0 : res.status

    if (200 > status || 300 <= status) {
      throw new Error(
        "secrets: token exchange failed: " + status + " from " + url)
    }

    const body = "function" === typeof res.json ? await res.json() : res.body
    const token = null == body ? undefined : body[x.response]

    if ("string" !== typeof token || "" === token) {
      throw new Error(
        "secrets: token exchange returned no '" + x.response + "' field from " + url)
    }

    this._register(token)

    return token
  }


  async _withRefresh(
    this: any, ctx: any, url: string, fetchdef: any, inner: any
  ): Promise<any> {
    const x = this._exchange
    const max = null == x ? 0 : x.retries

    if (!this._authon()) {
      return inner(ctx, url, fetchdef)
    }

    let attempt = 0

    for (; ;) {
      const used = this._client._options.apikey

      const res = await inner(ctx, url, fetchdef)

      if (attempt >= max || !this._spent(res)) {
        return res
      }

      const current = this._client._options.apikey
      let token: string

      if ('string' === typeof current && '' !== current && current !== used) {
        token = current
      }
      else {
        try {
          token = await this._buy()
        }
        catch (err: any) {
          // The purchase failed: answer with the API's own refusal rather
          // than this one. The caller asked for data, and the 401 is the
          // more useful of the two — the exchange error is a symptom.
          return res
        }

        this._client._options.apikey = token
      }

      this._reauth(fetchdef, token)

      attempt++
    }
  }


  _spent(this: any, res: any): boolean {
    if (null == res || res instanceof Error) {
      return false
    }
    const statuses = this._exchange.statuses
    return statuses.indexOf(res.status) >= 0
  }


  _reauth(this: any, fetchdef: any, token: string) {
    if (null == fetchdef || null == fetchdef.headers) {
      return
    }

    if (!this._authon()) {
      delete fetchdef.headers.authorization
      return
    }

    const auth = this._client._options.auth

    // The header prepareAuth wrote: auth.name, lower-cased.
    const name = "string" === typeof auth.name && "" !== auth.name ?
      auth.name.toLowerCase() : "authorization"

    const value = this._basic && true === auth.basic ? this._pair(token) : token
    const prefix = auth.prefix
    fetchdef.headers[name] = prefix ? prefix + " " + value : value
  }


  // Under Basic the token is the key half, as apikey is: prepareAuth's pair.
  _pair(this: any, token: string): string {
    const secret = this._client._options.secret
    const pair = Buffer.from(token + ":" + (null == secret ? "" : secret)).toString("base64")
    this._register(pair)
    return pair
  }
}


export {
  SecretsFeature
}
