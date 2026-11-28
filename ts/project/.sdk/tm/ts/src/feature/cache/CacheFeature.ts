
import type { Context, FeatureOptions } from '../../types'
import type { ProjectNameSDK } from '../../ProjectNameSDK'

import { BaseFeature } from '../base/BaseFeature'
import { headerValue, isJsonMedia } from '../../utility/MediaUtility'


class CacheFeature extends BaseFeature {
  version = '0.0.1'
  name = 'cache'
  active = true

  _client?: ProjectNameSDK
  _options: any = {}
  _store: Map<string, any> = new Map()
  _key?: Promise<any>


  init(ctx: Context, options: FeatureOptions): void | Promise<any> {
    this._client = ctx.client
    this._options = options || {}
    this.active = (options as any).active

    if (!this.active) {
      return
    }

    this._store = new Map()
    this._key = cacheKey()

    const self = this
    const utility = ctx.utility
    const inner = utility.fetcher

    utility.fetcher = async function (ctx2: any, url: string, fetchdef: any) {
      return self._through(ctx2, url, fetchdef, inner)
    }
  }


  async _through(this: any, ctx: any, url: string, fetchdef: any, inner: any): Promise<any> {
    const method = ((fetchdef && fetchdef.method) || 'GET').toUpperCase()
    const methods = this._options.methods || ['GET']

    if (methods.indexOf(method) < 0) {
      if (SAFE_METHODS.indexOf(method) >= 0) {
        return inner(ctx, url, fetchdef)
      }
      try {
        return await inner(ctx, url, fetchdef)
      }
      finally {
        this._invalidate(url)
      }
    }

    const key = method + ' ' + url + ' ' + await this._digest(fetchdef && fetchdef.headers)
    const now = this._now()
    const hit = this._store.get(key)

    if (null != hit && hit.expiry > now) {
      this._track('hit')
      return this._replay(hit.snapshot)
    }

    const res = await inner(ctx, url, fetchdef)

    // A body that declares another type than JSON passes by, unread.
    if (this._cacheable(res) && !this._json(res)) {
      this._track('bypass')
      return res
    }

    if (this._cacheable(res)) {
      const snapshot = await this._snapshot(res)

      // A body that is not JSON is not stored, and the replay hands its text
      // on: the operation reports it as it would without the cache.
      if (snapshot.failed) {
        this._track('bypass')
        return this._replay(snapshot)
      }

      const ttl = cacheLifetime(snapshot.headers,
        null == this._options.ttl ? 5000 : this._options.ttl)
      if (ttl <= 0) {
        this._track('bypass')
        return this._replay(snapshot)
      }

      this._store.delete(key)
      this._evict()
      this._store.set(key, { expiry: now + ttl, scope: urlScope(url), snapshot })
      this._track('miss')
      return this._replay(snapshot)
    }

    this._track('bypass')
    return res
  }


  async _digest(this: any, headers: any): Promise<string> {
    const subtle = globalThis.crypto.subtle
    const mac = await subtle.sign('HMAC', await this._key,
      new TextEncoder().encode(headerText(headers)))
    return Array.from(new Uint8Array(mac), (b: number) => b.toString(16).padStart(2, '0')).join('')
  }


  _invalidate(this: any, url: string) {
    const path = urlScope(url)
    const collection = urlParent(path)
    for (const [key, entry] of this._store) {
      if (scopeUnder(entry.scope, path) || entry.scope === collection) {
        this._store.delete(key)
      }
    }
  }


  _cacheable(this: any, res: any): boolean {
    if (null == res || res instanceof Error) {
      return false
    }
    const status = res.status
    return 'number' === typeof status && status >= 200 && status < 300
  }


  _json(this: any, res: any): boolean {
    const type = headerValue(res.headers, 'content-type')
    return '' === type || isJsonMedia(type)
  }


  async _snapshot(this: any, res: any): Promise<any> {
    let data: any = undefined
    let text: any = undefined
    let unread: any = undefined
    let failed = false
    if ('function' === typeof res.text) {
      try {
        text = await res.text()
        data = '' === text.trim() ? undefined : JSON.parse(text)
      }
      catch (err: any) {
        // Unread, or not JSON: the replay's text() hands the same failure on.
        failed = true
        unread = null == text ? err : undefined
      }
    }
    else if ('function' === typeof res.json) {
      try { data = await res.json() } catch (_e) { data = undefined }
    }
    const headers: any = {}
    if (res.headers && 'function' === typeof res.headers.forEach) {
      res.headers.forEach((v: any, k: any) => headers[k] = v)
    }
    return { status: res.status, statusText: res.statusText, data, headers, text, unread, failed }
  }


  _replay(this: any, snapshot: any): any {
    const headers = snapshot.headers || {}
    return {
      status: snapshot.status,
      statusText: snapshot.statusText,
      body: 'not-used',
      json: async () => snapshot.data,
      ...(null == snapshot.text && null == snapshot.unread ? {} : {
        text: async () => {
          if (null != snapshot.unread) {
            throw snapshot.unread
          }
          return snapshot.text
        },
      }),
      headers: {
        get(key: string) { return headers[String(key).toLowerCase()] },
        forEach(callback: any) {
          Object.keys(headers).forEach((k) => callback(headers[k], k, this))
        },
      },
    }
  }


  _evict(this: any) {
    const max = null == this._options.max ? 256 : this._options.max
    while (this._store.size >= max) {
      const oldest = this._store.keys().next().value
      if (null == oldest) {
        break
      }
      this._store.delete(oldest)
    }
  }


  _now(this: any): number {
    const now = this._options.now
    if ('function' === typeof now) {
      return now()
    }
    return Date.now()
  }


  _track(this: any, kind: string) {
    const client: any = this._client
    if (null == client._cache) {
      client._cache = { hit: 0, miss: 0, bypass: 0 }
    }
    client._cache[kind]++
  }
}


const SAFE_METHODS = ['GET', 'HEAD']

const UNSTORED = ['no-store', 'private', 'no-cache']


// A fresh random secret per client: the key holds a digest of the headers,
// never a header value.
function cacheKey(): Promise<any> {
  const crypto = globalThis.crypto
  return crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}


function headerText(headers: any): string {
  const pairs: string[][] = []
  for (const name of Object.keys(headers || {})) {
    if (null != headers[name]) {
      pairs.push([name.toLowerCase(), String(headers[name])])
    }
  }
  pairs.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)
  return pairs.map((p) => p[0] + ':' + p[1] + '\n').join('')
}


// The configured ttl, capped by the response's Cache-Control; zero when the
// response may not be stored.
function cacheLifetime(headers: Record<string, any>, ttl: number): number {
  let control = ''
  for (const name of Object.keys(headers || {})) {
    if ('cache-control' === name.toLowerCase()) {
      control = String(headers[name])
    }
  }
  let life = ttl
  for (const part of control.toLowerCase().split(',')) {
    const directive = part.trim()
    if (UNSTORED.indexOf(directive) >= 0) {
      return 0
    }
    const age = directive.match(/^max-age\s*=\s*"?(\d+)"?$/)
    if (null != age) {
      life = Math.min(life, Number(age[1]) * 1000)
    }
  }
  return life
}


function urlScope(url: string): string {
  let scope = String(url).split(/[?#]/)[0]
  while (scope.endsWith('/')) {
    scope = scope.slice(0, -1)
  }
  return scope
}


function urlParent(scope: string): string {
  const scheme = scope.indexOf('://')
  const root = scheme < 0 ? 0 : scope.indexOf('/', scheme + 3)
  if (root < 0) {
    return scope
  }
  const cut = scope.lastIndexOf('/')
  return scope.slice(0, cut < root ? root : cut)
}


function scopeUnder(scope: string, prefix: string): boolean {
  return scope === prefix || scope.startsWith(prefix + '/')
}


export {
  CacheFeature
}
