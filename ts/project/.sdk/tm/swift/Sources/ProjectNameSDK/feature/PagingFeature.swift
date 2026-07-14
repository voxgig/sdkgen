// Pagination support for list operations. On the way out (PreRequest) it
// stamps page/limit (or a cursor) into the request query; on the way back
// (PreResult) it reads the server's pagination signals - a `Link:
// rel="next"` header, `X-Page`/`X-Next-Page`/`X-Total-Count` headers, or
// `next`/`cursor`/`nextCursor`/`hasMore` fields in the body - and records
// them on `ctx.result.paging`. A per-call cursor/page from ctrl takes
// priority (used by auto-iteration). Parameter names (`pageParam`,
// `limitParam`, `cursorParam`), the page size (`limit`) and the start page
// (`startPage`, default 1) are configurable.

import Foundation

public final class PagingFeature: BaseFeature {
  private var client: ProjectNameSDK?
  private var options: VMap?

  // Activity tracking (mirrors the ts client._paging record).
  public var last: VMap?

  private static let linkNextRe = try! NSRegularExpression(
    pattern: "<([^>]+)>\\s*;\\s*rel=\"?next\"?", options: [.caseInsensitive])

  public override init() {
    super.init()
    version = "0.0.1"
    name = "paging"
    active = true
  }

  public override func initFeature(_ ctx: Context, _ options: VMap) {
    client = ctx.client
    self.options = options
    active = foptBool(options, "active", false)
  }

  public override func preRequest(_ ctx: Context) {
    if !active || !isList(ctx) {
      return
    }
    guard let spec = ctx.spec else {
      return
    }

    let pageParam = foptStr(options, "pageParam", "page")
    let limitParam = foptStr(options, "limitParam", "limit")
    let cursorParam = foptStr(options, "cursorParam", "cursor")

    // A per-call cursor/page from ctrl takes priority (auto-iteration).
    let paging = ctx.ctrl.paging

    var cursor: Value = .noval
    var hasCursor = false
    if let paging = paging {
      let c = gp(paging, "cursor")
      if !isNil(c) { cursor = c; hasCursor = true }
    }

    if hasCursor {
      spec.query.entries[cursorParam] = cursor
    } else if isNil(gp(spec.query, pageParam)) {
      var page: Value? = nil
      if let paging = paging {
        let p = gp(paging, "page")
        if !isNil(p) { page = p }
      }
      spec.query.entries[pageParam] = page ?? .int(Int64(foptInt(options, "startPage", 1)))
    }

    if !isNil(fopt(options, "limit")) && isNil(gp(spec.query, limitParam)) {
      spec.query.entries[limitParam] = .int(Int64(foptInt(options, "limit", 0)))
    }
  }

  public override func preResult(_ ctx: Context) {
    if !active || !isList(ctx) {
      return
    }
    guard let result = ctx.result else {
      return
    }

    let headers = result.headers
    let body = result.body

    let paging = VMap()
    paging.entries["hasMore"] = .bool(false)
    headerNum(headers, "x-page", paging, "page")
    headerNum(headers, "x-total-count", paging, "totalCount")
    headerNum(headers, "x-next-page", paging, "nextPage")

    // Link: <...>; rel="next"
    let (link, hasLink) = fheaderGet(headers, "link")
    if hasLink, let ls = link.asString {
      let range = NSRange(ls.startIndex..., in: ls)
      if let m = PagingFeature.linkNextRe.firstMatch(in: ls, options: [], range: range),
        m.numberOfRanges > 1, let g = Range(m.range(at: 1), in: ls) {
        paging.entries["next"] = .string(String(ls[g]))
      }
    }

    // Body-level cursors.
    if let bm = body.asMap {
      let next = gp(bm, "next")
      if !isNil(next) && isNil(gp(paging, "next")) {
        paging.entries["next"] = next
      }
      let cursor = gp(bm, "cursor")
      if !isNil(cursor) {
        paging.entries["cursor"] = cursor
      }
      let nextCursor = gp(bm, "nextCursor")
      if !isNil(nextCursor) {
        paging.entries["cursor"] = nextCursor
      }
      if let hmb = gp(bm, "hasMore").asBool {
        paging.entries["hasMore"] = .bool(hmb)
      }
    }

    let hasMoreNow = gp(paging, "hasMore").asBool ?? false
    if !hasMoreNow &&
      (!isNil(gp(paging, "next")) || !isNil(gp(paging, "cursor")) || !isNil(gp(paging, "nextPage"))) {
      paging.entries["hasMore"] = .bool(true)
    }

    result.paging = paging
    last = paging
  }

  private func isList(_ ctx: Context) -> Bool {
    let opname = ctx.op?.name ?? ""
    let ops = foptStrList(options, "ops") ?? ["list"]
    return ops.contains(opname)
  }

  private func headerNum(_ headers: VMap?, _ name: String, _ paging: VMap, _ key: String) {
    let (v, has) = fheaderGet(headers, name)
    if !has {
      return
    }
    if let s = v.asString {
      let n = fparseInt(s, -1)
      if n >= 0 {
        paging.entries[key] = .int(Int64(n))
      }
      return
    }
    switch v {
    case .int(let n): paging.entries[key] = .int(n)
    case .double(let d): paging.entries[key] = .int(Int64(d))
    default: break
    }
  }
}
