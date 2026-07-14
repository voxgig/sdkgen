package SCALAPACKAGE.feature

import java.util.{LinkedHashMap, Map => JMap}
import java.util.regex.{Matcher, Pattern}
import SCALAPACKAGE.core.{Context, SdkClient}

// Pagination support for list operations. On the way out (PreRequest) it
// stamps page/limit (or a cursor) into the request query; on the way back
// (PreResult) it reads the server's pagination signals — a `Link:
// rel="next"` header, `X-Page`/`X-Next-Page`/`X-Total-Count` headers, or
// `next`/`cursor`/`nextCursor`/`hasMore` fields in the body — and records
// them on `ctx.result.paging`. A per-call cursor/page from ctrl takes
// priority (used by auto-iteration). Parameter names (`pageParam`,
// `limitParam`, `cursorParam`), the page size (`limit`) and the start page
// (`startPage`, default 1) are configurable.
class PagingFeature extends BaseFeature("paging", "0.0.1", true) {

  private var client: SdkClient = null
  private var options: JMap[String, Object] = null

  // Activity tracking (mirrors the ts client._paging record).
  var last: JMap[String, Object] = null

  private val LINK_NEXT_RE: Pattern =
    Pattern.compile("<([^>]+)>\\s*;\\s*rel=\"?next\"?", Pattern.CASE_INSENSITIVE)

  override def init(ctx: Context, options: JMap[String, Object]): Unit = {
    this.client = ctx.client
    this.options = options
    this.active = FeatureOptions.foptBool(options, "active", false)
  }

  override def preRequest(ctx: Context): Unit = {
    if (!this.active || !isList(ctx)) {
      return
    }
    val spec = ctx.spec
    if (spec == null) {
      return
    }
    if (spec.query == null) {
      spec.query = new LinkedHashMap[String, Object]()
    }

    val pageParam = FeatureOptions.foptStr(this.options, "pageParam", "page")
    val limitParam = FeatureOptions.foptStr(this.options, "limitParam", "limit")
    val cursorParam = FeatureOptions.foptStr(this.options, "cursorParam", "cursor")

    // A per-call cursor/page from ctrl takes priority (auto-iteration).
    var paging: JMap[String, Object] = if (ctx.ctrl == null) null else ctx.ctrl.paging
    if (paging == null) {
      paging = new LinkedHashMap[String, Object]()
    }

    val cursor = paging.get("cursor")
    if (cursor != null) {
      spec.query.put(cursorParam, cursor)
    } else if (spec.query.get(pageParam) == null) {
      val page = paging.get("page")
      if (page != null) {
        spec.query.put(pageParam, page)
      } else {
        spec.query.put(pageParam, java.lang.Integer.valueOf(FeatureOptions.foptInt(this.options, "startPage", 1)))
      }
    }

    if (this.options.get("limit") != null && spec.query.get(limitParam) == null) {
      spec.query.put(limitParam, java.lang.Integer.valueOf(FeatureOptions.foptInt(this.options, "limit", 0)))
    }
  }

  override def preResult(ctx: Context): Unit = {
    if (!this.active || !isList(ctx)) {
      return
    }
    val result = ctx.result
    if (result == null) {
      return
    }

    val headers = result.headers
    val body = result.body

    val paging = new LinkedHashMap[String, Object]()
    paging.put("hasMore", java.lang.Boolean.FALSE)
    headerNum(headers, "x-page", paging, "page")
    headerNum(headers, "x-total-count", paging, "totalCount")
    headerNum(headers, "x-next-page", paging, "nextPage")

    // Link: <...>; rel="next"
    val link = FeatureOptions.fheaderGet(headers, "link")
    link match {
      case s: String =>
        val m = LINK_NEXT_RE.matcher(s)
        if (m.find()) {
          paging.put("next", m.group(1))
        }
      case _ =>
    }

    // Body-level cursors.
    body match {
      case bm0: JMap[_, _] =>
        val bm = bm0.asInstanceOf[JMap[String, Object]]
        if (bm.get("next") != null && paging.get("next") == null) {
          paging.put("next", bm.get("next"))
        }
        if (bm.get("cursor") != null) {
          paging.put("cursor", bm.get("cursor"))
        }
        if (bm.get("nextCursor") != null) {
          paging.put("cursor", bm.get("nextCursor"))
        }
        bm.get("hasMore") match {
          case b: java.lang.Boolean => paging.put("hasMore", b)
          case _ =>
        }
      case _ =>
    }

    if (!(java.lang.Boolean.TRUE == paging.get("hasMore"))
        && (paging.get("next") != null || paging.get("cursor") != null
            || paging.get("nextPage") != null)) {
      paging.put("hasMore", java.lang.Boolean.TRUE)
    }

    result.paging = paging
    this.last = paging
  }

  private def isList(ctx: Context): Boolean = {
    var opname = ""
    if (ctx.op != null) {
      opname = ctx.op.name
    }
    var ops = FeatureOptions.foptStrList(this.options, "ops")
    if (ops == null) {
      ops = java.util.List.of("list")
    }
    val it = ops.iterator()
    while (it.hasNext) {
      if (it.next().equals(opname)) {
        return true
      }
    }
    false
  }

  private def headerNum(headers: JMap[String, Object], name: String,
      paging: JMap[String, Object], key: String): Unit = {

    val v = FeatureOptions.fheaderGet(headers, name)
    if (v == null) {
      return
    }
    v match {
      case s: String =>
        val n = FeatureOptions.fparseInt(s, -1)
        if (n >= 0) {
          paging.put(key, java.lang.Integer.valueOf(n))
        }
        return
      case _ =>
    }
    v match {
      case num: java.lang.Number => paging.put(key, java.lang.Integer.valueOf(num.intValue()))
      case _ =>
    }
  }
}
