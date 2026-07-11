

const { BaseFeature } = require('../base/BaseFeature')


// Pagination support for list operations. On the way out (PreRequest) it
// stamps page/limit (or a cursor) into the request query; on the way back
// (PreResult) it reads the server's pagination signals — a `Link:
// rel="next"` header, `X-Next-Page`/`X-Total-Count` headers, or `next`/
// `cursor`/`hasMore` fields in the body — and records them on
// `ctx.result.paging`. Generated SDKs build auto-iteration on top of this
// (advance the cursor/page and re-issue the list call until `hasMore` is
// false). Parameter names and page size are configurable.
class PagingFeature extends BaseFeature {
  version = '0.0.1'
  name = 'paging'
  active = true

  _client
  _options = {}


  init(ctx, options) {
    this._client = ctx.client
    this._options = options || {}
    this.active = options.active
  }


  PreRequest(ctx) {
    if (!this._isList(ctx)) {
      return
    }
    const spec = ctx.spec
    if (null == spec) {
      return
    }
    if (null == spec.query) {
      spec.query = {}
    }

    const pageParam = this._options.pageParam || 'page'
    const limitParam = this._options.limitParam || 'limit'
    const cursorParam = this._options.cursorParam || 'cursor'

    // A per-call cursor/page from ctrl takes priority (used by auto-iteration).
    const paging = (ctx.ctrl && ctx.ctrl.paging) || {}

    if (null != paging.cursor) {
      spec.query[cursorParam] = paging.cursor
    }
    else if (null == spec.query[pageParam]) {
      spec.query[pageParam] = null != paging.page ? paging.page : (this._options.startPage || 1)
    }

    if (null != this._options.limit && null == spec.query[limitParam]) {
      spec.query[limitParam] = this._options.limit
    }
  }


  PreResult(ctx) {
    if (!this._isList(ctx)) {
      return
    }
    const result = ctx.result
    if (null == result) {
      return
    }

    const headers = result.headers || {}
    const body = result.body

    const paging = {
      page: this._num(this._header(headers, 'x-page')),
      totalCount: this._num(this._header(headers, 'x-total-count')),
      nextPage: this._num(this._header(headers, 'x-next-page')),
      next: undefined,
      cursor: undefined,
      hasMore: false,
    }

    // Link: <...>; rel="next"
    const link = this._header(headers, 'link')
    if (null != link) {
      const m = /<([^>]+)>\s*;\s*rel="?next"?/i.exec(link)
      if (m) {
        paging.next = m[1]
      }
    }

    // Body-level cursors.
    if (body && 'object' === typeof body) {
      if (null != body.next) { paging.next = paging.next || body.next }
      if (null != body.cursor) { paging.cursor = body.cursor }
      if (null != body.nextCursor) { paging.cursor = body.nextCursor }
      if ('boolean' === typeof body.hasMore) { paging.hasMore = body.hasMore }
    }

    paging.hasMore = paging.hasMore ||
      null != paging.next || null != paging.cursor || null != paging.nextPage

    result.paging = paging

    const client = this._client
    client._paging = { last: paging }
  }


  _isList(ctx) {
    const ops = this._options.ops || ['list']
    return ops.indexOf(ctx.op && ctx.op.name) >= 0
  }


  _header(headers, name) {
    const lower = name.toLowerCase()
    for (const k of Object.keys(headers)) {
      if (k.toLowerCase() === lower) {
        return headers[k]
      }
    }
    return undefined
  }


  _num(v) {
    if (null == v) {
      return undefined
    }
    const n = Number(v)
    return isNaN(n) ? undefined : n
  }
}


module.exports = {
  PagingFeature
}
